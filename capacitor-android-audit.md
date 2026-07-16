# Capacitor Android — Audit initial (2026-07-16)

## Setup réalisé

| Élément | Valeur |
|---|---|
| Capacitor | 7.6.8 |
| App ID | `fr.noxvtc.app` |
| App name | NoX VTC |
| Mode | Remote URL → `https://app.noxvtc.fr` |
| webDir | `www/` (placeholder, non utilisé en mode remote) |
| Android compileSdk | 35 (Android 15) |
| minSdk | 23 (Android 6.0+) |
| Java requis | 21 (Temurin 21.0.7+6 installé dans ~/java/) |
| Android SDK | ~/Android/Sdk — platform-tools, platforms;android-34, build-tools;34.0.0 |
| APK debug | `android/app/build/outputs/apk/debug/app-debug.apk` (3.9 MB) |

L'APK est installable via `adb install app-debug.apk` ou transfert direct sur le téléphone.

---

## Point 1 — OAuth Google (`/auth/callback`)

**Statut : ⚠️ RISQUE — à tester**

### Ce qui se passe en théorie
Supabase OAuth Google ouvre une **Chrome Custom Tab** (pas la WebView principale) pour
afficher la page de connexion Google. Une fois l'utilisateur authentifié, Google redirige
vers `https://app.noxvtc.fr/auth/callback?code=...`.

### Le problème probable
La redirection de Google arrive dans le système Chrome, PAS dans la WebView Capacitor.
Le résultat : Chrome s'ouvre avec la page `/auth/callback`, mais l'app reste bloquée sur
l'écran de connexion. La session n'est pas propagée dans la WebView.

### Solution à prévoir (si confirmé en test)
Configurer un **Android App Link** (`https://app.noxvtc.fr/auth/callback`) avec un
fichier Digital Asset Links (`/.well-known/assetlinks.json`) sur le domaine. Ceci force
Android à router la redirection OAuth vers l'app Capacitor plutôt que Chrome.

Coût : ajouter un `<intent-filter>` dans `AndroidManifest.xml` + publier le JSON sur
le domaine avec le SHA-256 de la clé de signature de l'APK.

**Auth magic link (email OTP)** : même risque. Le lien d'email pointe vers
`https://app.noxvtc.fr/auth/confirmed?...` — même correction nécessaire.

---

## Point 2 — Cloudflare Turnstile

**Statut : ⚠️ RISQUE — comportement imprévisible en WebView**

### Ce qui se passe
Turnstile est utilisé sur `/register`. Il charge `challenges.cloudflare.com` dans un
`<iframe>` (CSP autorisé : `frame-src https://challenges.cloudflare.com`).

### Le problème probable
Cloudflare Turnstile en mode **managed** détecte l'environnement d'exécution. Les WebViews
Android sont connues pour être marquées comme "non-humaines" par Turnstile, ce qui
déclenche soit :
- Un challenge interactif supplémentaire (CAPTCHA visuel) → mauvaise UX
- Un blocage silencieux → l'inscription est impossible

Le user-agent Android WebView par défaut (`Dalvik/...`ou `wv` dans le UA string) est un
signal fort pour Cloudflare.

### Solution à prévoir (si confirmé en test)
Option A : Overrider le user-agent WebView pour correspondre à Chrome Android standard.
Modifier `MainActivity.java` :
```java
WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
// Dans onCreate :
// getIntent().putExtra(BridgeActivity.USER_AGENT, "Mozilla/5.0 ...")
```

Option B : Passer Turnstile en mode `invisible` côté serveur si l'UA est WebView.

Option C : Désactiver Turnstile sur mobile (user-agent check côté Next.js) et utiliser
uniquement la vérification email OTP comme protection anti-bot.

---

## Point 3 — Bannière Axeptio

**Statut : ✅ PROBABLEMENT OK**

### Pourquoi ça devrait fonctionner
- L'app charge `https://app.noxvtc.fr` — la WebView utilise ce domaine comme origine
- Axeptio stocke son état dans `localStorage` et cookies du domaine `app.noxvtc.fr`
- La CSP autorise déjà `script-src https://static.axept.io https://*.axept.io`
  et `frame-src https://*.axept.io`
- En mode remote URL, la WebView Capacitor a un cookie store complet (pas de limitation
  comme avec `capacitor://localhost`)

### À vérifier en test
- La bannière s'affiche au premier lancement (pas de consentement pré-sauvegardé)
- Les préférences persistent entre les fermetures de l'app (cookie store conservé)

---

## Point 4 — Persistance de session Supabase

**Statut : ✅ PROBABLEMENT OK**

### Pourquoi ça devrait fonctionner
Supabase SSR utilise des cookies sur le domaine `app.noxvtc.fr`. La WebView Capacitor
en mode `server.url` stocke les cookies exactement comme Chrome, liés au domaine
`https://app.noxvtc.fr`. La session survit aux fermetures d'app (le WebView cookie store
est persisté sur disque par Android).

### À vérifier en test
- Ouvrir l'app connecté → fermer → rouvrir → pas de re-login demandé
- Vérifier que `SameSite=Lax` sur les cookies Supabase n'interfère pas
  (ne devrait pas, car origin = `https://app.noxvtc.fr` dans les deux sens)

---

## Point 5 — Content Security Policy

**Statut : ⚠️ RISQUE FAIBLE — bridge Capacitor potentiellement bloqué**

### Ce qui se passe
Le middleware Next.js génère une CSP stricte avec nonce par requête :
```
script-src 'self' 'nonce-{nonce}' https://challenges.cloudflare.com ...
```
Aucun `'unsafe-inline'` ni `'unsafe-eval'`.

### Le bridge Capacitor
En mode `server.url`, Capacitor injecte son bridge JavaScript via
`WebViewClient.evaluateJavascript()` (injection native Java → JS) — ce mécanisme
**bypass la CSP** (pas une balise `<script>` dans le DOM, c'est une exécution directe
par Android). Le bridge Capacitor fonctionne donc indépendamment de la CSP.

### Ce qui peut casser
1. Si des plugins Capacitor injectent des scripts via `<script>` tags sans nonce
   → bloqués par la CSP. À surveiller en DevTools (Chrome → `chrome://inspect`).

2. La console DevTools Android peut montrer des erreurs CSP pour des scripts tiers
   que le navigateur web tolère mais que la WebView rejette différemment.

### Comment monitorer
Activer le debug WebView en branchant le téléphone en USB :
```
chrome://inspect/#devices
```
Puis observer la console pendant la navigation.

---

## Résumé priorités de correction

| # | Point | Verdict | Priorité |
|---|---|---|---|
| 1 | OAuth Google / magic link | ⚠️ Risque fort | P0 — bloque l'inscription/connexion |
| 2 | Cloudflare Turnstile | ⚠️ Risque fort | P1 — bloque l'inscription |
| 3 | Axeptio | ✅ OK probable | P3 — à confirmer |
| 4 | Session Supabase | ✅ OK probable | P3 — à confirmer |
| 5 | CSP | ⚠️ Risque faible | P2 — à surveiller en console |

**Les corrections P0+P1 (OAuth + Turnstile) sont nécessaires avant distribution.**
Les P2+P3 peuvent être confirmés ou infirmés lors du test sur device réel.

---

## Commandes utiles pour la suite

```bash
# Build APK debug
export JAVA_HOME=/home/nox/java/jdk-21.0.7+6
export ANDROID_HOME=/home/nox/Android/Sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
cd ~/projet_nox/nox/android
./gradlew assembleDebug

# APK produit :
# android/app/build/outputs/apk/debug/app-debug.apk

# Sync après modif capacitor.config.ts :
cd ~/projet_nox/nox
npx cap sync android

# Inspector Chrome pour debug WebView :
# 1. Activer USB debugging sur le téléphone
# 2. Brancher USB
# 3. Ouvrir chrome://inspect/#devices sur PC
```

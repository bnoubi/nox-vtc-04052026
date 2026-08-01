# Audit — Feature flag `disable_auto_trial`

## 1. Points d'insertion toujours d'actualité ?

### Trigger `ensure_user_bootstrap`

Fichier : `supabase/migrations/20260625000003_ensure_user_bootstrap_on_login.sql`

Le trigger se déclenche sur `AFTER UPDATE ON auth.users WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)` — c'est-à-dire à chaque premier login (et à chaque login si last_sign_in_at change). Il initialise la ligne `subscriptions` avec :

```sql
INSERT INTO public.subscriptions (user_id, plan, status, target_plan, trial_started_at, trial_ends_at)
VALUES (NEW.id, 'TEAM', 'trial', 'solo', now(), now() + interval '14 days')
ON CONFLICT (user_id) DO NOTHING;
```

C'est **le bon endroit** pour injecter la logique conditionnelle : si `disable_auto_trial = true`, insérer `SOLO/active` avec `trial_started_at = NULL`, `trial_ends_at = NULL`.

### Backfill dans `auth/callback/route.ts`

Le backfill (lignes 93-107) hardcode également `plan: 'TEAM', status: 'trial'` via un upsert avec `ignoreDuplicates: true`. Il couvre les flows magic link PKCE, OTP et OAuth Google. Comme il utilise `ignoreDuplicates: true`, si le trigger a déjà inséré la bonne ligne, le backfill ne l'écrase pas — mais l'ordre n'est pas garanti.

**Conclusion** : les deux points restent valides. Ils doivent être mis à jour de façon cohérente dans la même implémentation.

---

## 2. L'onboarding suppose-t-il une capacité illimitée ?

### Véhicule — `handleAddVehicle`

L'onboarding crée ou met à jour exactement **1 véhicule** via upsert (cherche le premier existant, update ou insert). Pas d'appel à `getPlanLimits`. Limite SOLO = 1 véhicule. **Pas de conflit.**

### Chauffeur — `handleAddDriver`

Même logique idempotente : 1 seul chauffeur créé. Limite SOLO = 1 chauffeur. **Pas de conflit.**

### Absence de `getPlanLimits` pendant l'onboarding

Aucun appel à `getPlanLimits` dans `OnboardingComponent.tsx`. Les vérifications de limites existent dans le dashboard (`quick-actions.tsx`, `tab-settings.tsx`) mais pas pendant l'onboarding.

**Conclusion** : un utilisateur SOLO/active passe l'onboarding sans blocage. Les steps chauffeur/véhicule créent exactement 1 entrée chacun, conforme aux limites Starter.

---

## 3. Textes codés en dur mentionnant l'essai

### `app/api/onboarding/welcome/route.ts` ⚠️ PROBLÈME MAJEUR

La route envoie **systématiquement** deux emails : `welcomeEmail` + `trialStartEmail`. Il n'y a pas de condition sur `subscription.status`. Un utilisateur SOLO/active recevra quand même l'email "Votre essai gratuit de 14 jours est activé". Mensonger et problématique.

```typescript
// Ligne 34-36 — fallback hardcodé même sans essai
const trialEndsAt = subscription?.trial_ends_at
  ? new Date(subscription.trial_ends_at)
  : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
```

**Action requise** : conditionner l'envoi de `trialStartEmail` sur `subscription.status === 'trial'`. Pour SOLO/active, envoyer uniquement `welcomeEmail` (ou un email alternatif "bienvenue sur l'offre Starter").

### `emails/trial-start.tsx` ⚠️

Subject : `"Votre essai gratuit de 14 jours est activé, ${prenom} !"` — valeur fixe.
Corps : `"votre période d'essai gratuit de 14 jours est maintenant active"` — valeur fixe.
Ces textes ne sont pas dérivés de `subscriptions.status`.

### `emails/trial-ending.tsx` — OK

Le cron `expire-trials` cible uniquement `status = 'trial'`. Un utilisateur SOLO/active ne sera jamais sélectionné. Pas de risque.

### Frontend — OK (tout est conditionnel)

- `header.tsx` : `const isTrial = subscriptionStatus === "trial"` — badge "Essai" absent si SOLO/active
- `tab-settings.tsx` : tous les blocs `isTrial` sont conditionnels, se comportent correctement avec SOLO/active
- `tab-dashboard.tsx` : bannière alerte essai conditionnelle sur `isTrial`

**Conclusion** : seul `onboarding/welcome/route.ts` est un problème réel. Tout le reste du frontend est conditionnel et se comportera correctement.

---

## 4. Initialisation du wallet

Le trigger `ensure_user_bootstrap` initialise **3 tables** au premier login :

1. `user_accounts` (plan='SOLO', tokens=0, onboarding_status='not_started')
2. `wallets` (balance=0)
3. `subscriptions` (plan='TEAM', status='trial', ...)

Le wallet est créé **indépendamment du plan d'abonnement**. Un utilisateur SOLO/active aura un wallet à `balance=0` dès sa création.

**Conclusion** : aucun risque sur le wallet. Même si le plan est modifié par le flag, le wallet est toujours initialisé.

---

## 5. `target_plan` — valeur correcte pour un non-essai

### Où `target_plan` est lu

- **TypeScript (`lib/plans.ts`)** : `target_plan` n'est pas lu par `effectivePlan()`. La fonction se base sur `sub.plan` et `sub.status`.
- **SQL (cron expire-trials)** : `plan = COALESCE(NULLIF(target_plan, ''), 'solo')` — uniquement pour les subscriptions `status = 'trial'`.

### Valeur recommandée

Pour un utilisateur créé directement en SOLO/active : `target_plan = 'solo'` (ou NULL).
- `'solo'` est préférable à NULL car le cron `COALESCE(NULLIF(target_plan, ''), 'solo')` retombe sur `'solo'` dans les deux cas — et `'solo'` est plus explicite en base.
- Aucun crash possible : le cron d'expiration ne touchera jamais cet utilisateur.

**Conclusion** : insérer `target_plan = 'solo'` pour les utilisateurs créés via le flag. Valeur cohérente, aucun risque.

---

## 6. Occurrences de `status === 'trial'` et `plan === 'TEAM'`

Résultats grep dans les fichiers sources (hors node_modules, .next, android) :

| Fichier | Ligne | Extrait | SOLO/active |
|---------|-------|---------|-------------|
| `header.tsx` | 56 | `const isTrial = subscriptionStatus === "trial"` | `false` → badge absent ✅ |
| `header.tsx` | 63 | `plan === 'TEAM' ? 'TEAM' : 'SOLO'` | retourne `'SOLO'` ✅ |
| `tab-settings.tsx` | 976 | `const isTeam = plan === "TEAM"` | `false` ✅ |
| `tab-settings.tsx` | 978 | `const isTrial = subscriptionStatus === "trial"` | `false` ✅ |
| `tab-settings.tsx` | 1256 | `isTrial && p.id !== "SOLO"` | skip ✅ |
| `tab-settings.tsx` | 1271 | `isTrial && p.id === "SOLO"` (bouton "annuler essai") | absent ✅ |
| `tab-settings.tsx` | 1282 | `plan === "DUO" \|\| plan === "TEAM"` | `false`, bloc ignoré ✅ |
| `tab-dashboard.tsx` | 19 | `const isTrial = subscriptionStatus === "trial"` | `false` ✅ |
| `tab-documents.tsx` | 1149 | `const isUnlimited = plan === "DUO" \|\| plan === "TEAM"` | `false` → mode jetons ✅ |
| `admin/actions.ts` | 504 | `if (subRow.status === 'trial')` | skip ✅ |
| `cron/expire-trials` | 107 | cible `status = 'trial'` uniquement | jamais sélectionné ✅ |
| `lib/plans.ts` | 70 | `if (status === 'trial')` | branche non prise, retourne `normalizePlanCode('SOLO')` ✅ |

**Conclusion** : aucune occurrence ne cause de crash ou comportement incorrect pour SOLO/active. Tous les checks sont conditionnels.

---

## 7. Table `app_config` et mécanisme du toggle

### État actuel

La table `app_config` **n'existe dans aucune migration** mais existe en production (créée manuellement). Elle est lue dans :
- `lib/hooks/usePromo.ts` — `promo_active`, `promo_percent`, `promo_coupon_id`
- `app/admin/(protected)/settings/page.tsx` — lecture et mise à jour des promos
- `app/api/stripe/checkout/route.ts` — `promo_active`, `promo_coupon_id`

Structure inférée : `{ key: TEXT PRIMARY KEY, value: TEXT }`.

### Mécanisme recommandé : SQL manuel

Pour l'instant, un toggle SQL manuel est **suffisant** :

```sql
-- Activer le flag (nouveaux inscrits → SOLO/active)
UPDATE app_config SET value = 'true' WHERE key = 'disable_auto_trial';

-- Désactiver (retour au comportement par défaut TEAM/trial)
UPDATE app_config SET value = 'false' WHERE key = 'disable_auto_trial';
```

Une UI dédiée n'est pas justifiée : la bascule sera rare (probablement activée une fois lors d'une campagne ou d'un changement de stratégie, pas quotidiennement). L'accès SQL via Supabase Studio suffit pour l'opérateur. Une UI admin pourrait être ajoutée plus tard si le besoin s'en fait sentir.

### Avertissement sur la migration

La table `app_config` doit être versionnée. La migration devra utiliser `CREATE TABLE IF NOT EXISTS` pour ne pas casser la prod existante, et insérer `disable_auto_trial` avec `ON CONFLICT DO NOTHING`.

---

## Récapitulatif : sûr vs. ajustement requis

### ✅ Sûr à implémenter tel quel

- **Trigger `ensure_user_bootstrap`** : bon endroit, logique conditionnelle simple à insérer
- **Onboarding** : compatible SOLO dès le départ, aucune vérification de limites à ajouter
- **Wallet** : initialisé indépendamment du plan, aucune action
- **`target_plan = 'solo'`** : valeur correcte, jamais lue en pratique pour SOLO/active
- **Tous les `isTrial` / `plan === 'TEAM'` du frontend** : conditionnels, comportement correct
- **Mécanisme toggle SQL** : suffisant, pas d'UI nécessaire pour l'instant

### ⚠️ Ajustement requis avant de coder

1. **`app/api/onboarding/welcome/route.ts`** : conditionner l'envoi de `trialStartEmail` sur `subscription.status === 'trial'`. Pour SOLO/active, ne pas envoyer cet email (ou envoyer un email alternatif sans mention d'essai).

2. **`auth/callback/route.ts`** : mettre à jour le backfill en même temps que le trigger, avec la même logique conditionnelle (lire `app_config` côté TypeScript via Supabase avant le upsert).

3. **Migration `app_config`** : créer la migration `CREATE TABLE IF NOT EXISTS app_config` + `INSERT ON CONFLICT DO NOTHING` pour `disable_auto_trial = 'false'`. Vérifier que les RLS permettent la lecture depuis le trigger PG (`SECURITY DEFINER` en tant que `postgres` — normalement RLS bypassée, mais à confirmer).

4. **Trigger PostgreSQL** : le trigger doit lire `app_config` via `SELECT value FROM public.app_config WHERE key = 'disable_auto_trial'`. S'assurer que la table est dans le schéma `public` (ce qui semble être le cas) et accessible depuis le contexte `SECURITY DEFINER`.

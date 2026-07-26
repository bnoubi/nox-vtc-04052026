# Audit — Dashboard, Résumé Abonnement, Écran Mon Abonnement

> Généré le 2026-07-16. Aucun code modifié — uniquement analyse.

---

## 1. Dashboard — Blocs et navigabilité

**Fichier :** `components/dashboard/tab-dashboard.tsx` (63 lignes)

### Inventaire complet des blocs

| Bloc | Composant | Cliquable | Destination |
|------|-----------|-----------|-------------|
| Header (avatar, salutation, badge plan, cloche) | `DashboardHeader` (header.tsx) | Partiel — cloche ouvre panel notifs, badge Starter ouvre wallet | Wallet drawer / notifs overlay |
| Score NoX (GuardianScore) | `GuardianScore` | Oui — clic sur chaque alerte de doc expiré | `navigateToEntity()` → onglet Réglages > Chauffeurs ou Véhicules |
| Bannière essai (conditionnel) | Inline tab-dashboard.tsx | Oui — bouton "Voir les offres" | `navigateToSubscription()` → Mon Abonnement |
| Actions Rapides | `QuickActions` | Oui — 6 boutons | Modals/drawers (BC, Facture, Client, etc.) |
| NextTripWidget | `NextTripWidget` | **Non** — purement informatif | — |
| Prochaines Courses | `UpcomingTrips` | Partiel — bouton bas "Voir toutes les réservations" | `switchTab("documents")` — bascule vers onglet Documents |
| Demandes de courses | `TripRequestsWidget` (conditionnel) | Oui | Détail demande |
| Statistiques | `StatsWidget` | **Non** — purement informatif | — |
| Jetons (TokenCard, SOLO uniquement) | `TokenCard` | Oui — bouton recharge | Wallet drawer |

### Points à noter

**"Prochaines Courses" : cul-de-sac partiel.** Le bouton "Voir toutes les réservations" navigue vers `switchTab("documents")`, c'est-à-dire l'onglet Documents globaux, pas une vue dédiée "Courses à venir". Il n'existe pas de page `/courses` ou de vue filtrée par dates. L'utilisateur atterrit dans la liste complète de tous les documents, pas dans un calendrier ou une liste filtrée sur les courses futures.

**NextTripWidget : informatif pur.** Affiche la prochaine course sans aucun lien vers le détail de cette course ni vers le BC associé.

**Bannière essai : conditionnelle.** Apparaît uniquement si `isTrial && trialDaysLeft <= 3` — les utilisateurs en essai avec plus de 3 jours restants ne voient pas de rappel sur le Dashboard.

---

## 2. Bloc résumé abonnement en haut de la page Réglages

**Fichier :** `components/dashboard/tab-settings.tsx` — composant `MainSettings()`, lignes ~2550–2586

### Code exact de la logique d'affichage

```tsx
// Déstructuration (ligne ~2482)
const { plan, tokens, subscriptionStatus } = useNox()

// Affichage du bloc "NoX Wallet"
{plan === "SOLO" ? (
  // Affiche le solde de jetons + bouton "Recharger mes Jetons"
) : (
  // Affiche "Illimité" + "Documents Illimités" + "Support Prioritaire 24/7"
)}
```

La condition est binaire : `plan === "SOLO"` vs tout le reste (DUO ou TEAM).

### Source des données

- `plan` : lu depuis `useNox()` → `subscriptions.plan` (source de vérité)
- `tokens` : lu depuis `useNox()` → `wallets.balance`
- `subscriptionStatus` : disponible dans `useNox()` (`subscriptions.status`) mais **non utilisé dans ce bloc**

### Distinction essai vs payant

**Non, le bloc ne distingue pas essai vs payant.** Un utilisateur dont `subscriptions.status = 'trial'` et `subscriptions.plan = 'TEAM'` verra exactement le même affichage qu'un utilisateur payant Premium :

```
Documents Illimités
Support Prioritaire 24/7
```

Ce libellé est trompeur : le "Support Prioritaire 24/7" est présenté comme un droit acquis alors que l'accès peut disparaître dans quelques jours.

### Le bloc est-il cliquable vers "Mon Abonnement" ?

**Non.** Il n'y a aucun `onClick` ni lien depuis ce bloc vers l'écran Mon Abonnement. C'est un affichage statique. Le seul accès à Mon Abonnement depuis la page Réglages passe par l'entrée de menu dédiée dans la liste des réglages.

### Champs en base disponibles pour distinguer essai/payant

| Champ | Valeur essai actif | Valeur payant actif |
|-------|-------------------|---------------------|
| `subscriptions.status` | `'trial'` | `'active'` |
| `subscriptions.trial_ends_at` | Timestamp futur | NULL |
| `subscriptions.plan` | `'TEAM'` (toujours) | `'SOLO'`, `'DUO'` ou `'TEAM'` |
| `subscriptions.current_period_end` | NULL | Timestamp futur |
| `user_accounts.plan` | `'SOLO'` (inchangé à la création) | Synchronisé avec subscriptions |

`subscriptionStatus` et `trialEndsAt` sont déjà exposés par `useNox()` — ils sont disponibles sans modification du contexte.

---

## 3. Écran "Mon Abonnement" — Logique complète

**Fichier :** `components/dashboard/tab-settings.tsx` — composant `SubscriptionScreen()`, lignes ~974–1309

### 3a. "PLAN ACTUEL" — source et distinction essai/payant

**Code exact (lignes ~977–978, ~1072–1106) :**

```tsx
const isTeam = plan === "TEAM"
const isDuo  = plan === "DUO"

// Banner "Plan actuel"
<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
  Plan actuel
</p>
<p className="text-2xl font-bold font-heading mt-0.5">
  {planLabel(plan)}   {/* → "Starter", "Pro" ou "Premium" */}
</p>
<p className="text-xs text-muted-foreground">
  {isTeam
    ? "Vous profitez de toutes les fonctionnalités premium NoX VTC."
    : isDuo
      ? "Documents illimités inclus. Passez en Premium pour gérer votre flotte complète."
      : "Paiement à l'usage via jetons. Passez en Pro ou Premium pour des documents illimités."
  }
</p>
```

- `plan` vient de `useNox()` → `subscriptions.plan`
- `planLabel()` est importé de `lib/plans.ts` — source unique ✓
- **Aucune mention de "Essai" ni de date de fin d'essai nulle part sur cet écran**
- Un utilisateur en essai voit : "Plan actuel — Premium" + "Vous profitez de toutes les fonctionnalités premium NoX VTC." — indiscernable d'un payant

### 3b. Bouton "Résilier mon abonnement" — le bug

**Code exact (lignes ~1196–1210) :**

```tsx
{!isCurrent && p.id === "SOLO" && (plan === "DUO" || plan === "TEAM") && (
  subDetails?.cancel_at ? (
    <p className="w-full mt-3 py-2 text-center text-[11px] text-muted-foreground">
      Résiliation programmée le {fmtDateFr(subDetails.cancel_at)}
    </p>
  ) : (
    <button
      onClick={() => setShowCancelConfirm(true)}
      className="... text-red-400 border border-red-500/30 ..."
    >
      Résilier mon abonnement
    </button>
  )
)}
```

**Décryptage de la condition :**

- `!isCurrent` : la carte rendue n'est pas le plan actuel de l'utilisateur — vrai uniquement pour la carte "Starter" quand l'utilisateur est DUO/TEAM
- `p.id === "SOLO"` : affiche le bouton **sous la carte Starter** (pas sous la carte du plan actif)
- `(plan === "DUO" || plan === "TEAM")` : l'utilisateur a un plan supérieur

**Le comportement "correct" du design original :** Le bouton s'affiche sous la carte Starter pour signifier "rétrograder / résilier pour retomber sur le plan gratuit". C'est intentionnel mais contre-intuitif — l'utilisateur cherche le bouton sous SA carte (Premium), pas sous Starter.

**Pourquoi il apparaît sous Starter :** Par design, pas par bug de logique de condition. La condition est exacte : la carte Starter est `!isCurrent` pour un utilisateur Premium, et `p.id === "SOLO"` est vrai. Le problème n'est pas la position en soi, c'est que :

1. **La condition ne distingue pas essai vs payant.** Un utilisateur en `status = 'trial'` voit le bouton "Résilier mon abonnement" comme s'il avait un abonnement payant à résilier. En réalité, il n'a rien souscrit — il est en essai gratuit.

2. **`subDetails` ne charge pas `status` ni `trial_ends_at` :**
   ```tsx
   // Lignes ~998–1012
   supabase
     .from('subscriptions')
     .select('cancel_at, current_period_end')  // ← status absent
     .order('created_at', { ascending: false })
     .limit(1)
     .maybeSingle()
   ```
   Le composant ne dispose pas du statut pour brancher le comportement.

3. **Il n'existe aucun chemin de code différencié essai vs payant pour cette action.** Un clic sur "Résilier" en essai déclenche exactement le même flux qu'un abonnement payant actif.

### 3c. "Confirmer la résiliation" pour un compte en essai — effet réel

**Code de l'action serveur (`app/api/subscription/cancel/route.ts`) :**

```ts
// Charge la subscription
const { data: s } = await db.from('subscriptions')
  .select('id, plan, stripe_subscription_id, current_period_end')
  .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()

// Calcule la date d'annulation
const cancelAt = s.current_period_end
  ? new Date(s.current_period_end).toISOString()
  : new Date(Date.now() + 30 * 86_400_000).toISOString()  // fallback +30j

// Appelle Stripe (si stripe_subscription_id existe)
if (s.stripe_subscription_id) {
  await stripe.subscriptions.update(s.stripe_subscription_id, { cancel_at_period_end: true })
}

// Écrit en base
await db.from('subscriptions').update({
  cancel_at: cancelAt,
  cancellation_reason: 'user_request',
  updated_at: new Date().toISOString(),
}).eq('id', s.id)
```

**Pour un compte en essai :**

- `s.stripe_subscription_id` : NULL (aucune souscription Stripe créée pour un essai) → l'appel Stripe est sauté ✓ (pas d'erreur)
- `s.current_period_end` : NULL pour un essai → le fallback s'applique : `cancel_at = now() + 30 jours`
- **Résultat en base :** `subscriptions.cancel_at = now() + 30j`, `cancellation_reason = 'user_request'`
- **`status` reste `'trial'`** — l'essai continue jusqu'à `trial_ends_at`, le `cancel_at` est ignoré par le cron de l'essai
- **Effet réel :** la colonne `cancel_at` est remplie avec une valeur artificielle (+30j) qui n'a aucun sens pour un essai. Le cron `expire_trials` expira l'essai à `trial_ends_at` de toute façon. Ce `cancel_at` est un artefact silencieux — ni nuisible immédiatement, ni utile.

**Conclusion 3c :** Pour un compte en essai, "Confirmer la résiliation" est un no-op déguisé avec effet de bord bénin (écrit un `cancel_at` fictif, n'interrompt pas l'essai). L'utilisateur reçoit un toast "Résiliation confirmée — accès actif jusqu'au [date fictive]" qui ne correspond pas à la fin réelle de son essai.

### 3d. Avantages par plan — codés en dur vs lib/plans.ts

**Désynchronisation confirmée.** Les `planCards` sont définis en dur dans `SubscriptionScreen` :

```tsx
const planCards = [
  {
    id: "SOLO",
    capacity: "Max 1 Chauffeur / Max 1 Véhicule",
    features: ["Signature Entreprise incluse", "Paiement à l'usage (jetons)"],
  },
  {
    id: "DUO",
    capacity: "Max 2 Chauffeurs / Max 2 Véhicules",
    features: ["Signature Entreprise incluse", "Documents ILLIMITÉS"],
  },
  {
    id: "TEAM",
    capacity: "Max 10 Chauffeurs / Max 10 Véhicules",
    features: ["Signature Entreprise incluse", "Documents ILLIMITÉS", "API & Intégrations", "Statistiques avancées"],
  },
]
```

`lib/plans.ts` contient `PLAN_DRIVER_VEHICLE_LIMITS` avec les mêmes chiffres (1/1, 2/2, 10/10) — cohérent pour l'instant. Mais le texte "Max 2 Chauffeurs / Max 2 Véhicules" est dupliqué dans deux endroits sans lien entre eux. Si les limites changent dans `lib/plans.ts`, les cartes de l'écran Mon Abonnement resteraient fausses.

`planLabel()` est bien importé de `lib/plans.ts` — seul point de synchronisation existant.

### 3e. "Mon Abonnement" et "Offres disponibles" — même composant ou séparés ?

**Même composant, même écran scrollable.** `SubscriptionScreen` contient en une seule passe :

1. **Lignes ~1072–1106 :** Banner "Plan actuel" (statut, nom du plan, description)
2. **Lignes ~1108–1214 :** Section "Offres disponibles" — les 3 cartes SOLO/DUO/TEAM avec prix et avantages
3. **Lignes ~1216–1234 :** Modale de confirmation de résiliation (inline dans le même composant)
4. **Ligne ~1225 :** `<SubscriptionDrawer>` pour le paiement (composant externe monté ici)

Il n'y a pas de sous-navigation interne. Tout tient en scroll vertical dans un seul composant. Techniquement séparables, mais actuellement couplés.

---

## 4. Recommandations techniques

### R1 — Bloc résumé Réglages : distinguer essai vs payant

**Problème :** Libellés "Documents Illimités / Support Prioritaire 24/7" affichés en essai comme si c'était un droit acquis.

**Source de vérité :** `subscriptionStatus` (déjà dans `useNox()`) + `trialEndsAt`

**Correction minimale :** Dans `MainSettings()`, conditionner l'affichage sur `subscriptionStatus !== "trial"` :

```tsx
{plan === "SOLO" ? (
  // jetons + recharge
) : subscriptionStatus === "trial" ? (
  // Badge "Essai Premium" + date d'expiration
) : (
  // Documents Illimités + Support 24/7 (payant confirmé)
)}
```

---

### R2 — Banner "Plan actuel" : indiquer l'essai + date de fin

**Problème :** "Plan actuel — Premium" sans distinction essai/payant, sans date de fin.

**Correction minimale :** Ajouter sous le nom du plan une ligne conditionnelle :

```tsx
<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
  Plan actuel{subscriptionStatus === "trial" ? " (Essai)" : ""}
</p>
{subscriptionStatus === "trial" && trialEndsAt && (
  <p className="text-xs text-gold/80 mt-1">
    Accès gratuit jusqu'au {fmtDateFr(trialEndsAt)}
  </p>
)}
```

---

### R3 — Bouton "Résilier" : masquer en essai, remplacer par info fin d'essai

**Problème :** Un utilisateur en essai voit "Résilier mon abonnement", action qui produit un artefact inutile.

**Source de vérité à charger :** Ajouter `status` et `trial_ends_at` dans le `.select()` de `subDetails` :

```ts
.select('cancel_at, current_period_end, status, trial_ends_at')
```

**Correction de la condition :**

```tsx
{!isCurrent && p.id === "SOLO" && (plan === "DUO" || plan === "TEAM") && (
  subDetails?.status === "trial" ? (
    <p className="w-full mt-3 py-2 text-center text-[11px] text-muted-foreground">
      Essai gratuit — fin le {fmtDateFr(subDetails.trial_ends_at)}
    </p>
  ) : subDetails?.cancel_at ? (
    <p className="w-full mt-3 py-2 text-center text-[11px] text-muted-foreground">
      Résiliation programmée le {fmtDateFr(subDetails.cancel_at)}
    </p>
  ) : (
    <button onClick={() => setShowCancelConfirm(true)} className="...">
      Résilier mon abonnement
    </button>
  )
)}
```

---

### R4 — Avantages par plan : lier à lib/plans.ts

**Problème :** Capacités (chauffeurs/véhicules) dupliquées entre `planCards` et `lib/plans.ts`.

**Correction minimale :** Remplacer le texte statique `"Max 2 Chauffeurs / Max 2 Véhicules"` par :

```tsx
import { getPlanLimits } from "@/lib/plans"
// Dans planCards :
capacity: `Max ${getPlanLimits("DUO").drivers} Chauffeurs / Max ${getPlanLimits("DUO").vehicles} Véhicules`
```

Source de vérité unique : `lib/plans.ts` — une modification suffit.

---

### R5 — UpcomingTrips : cul-de-sac partiel

**Problème :** "Voir toutes les réservations" navigue vers l'onglet Documents, pas une vue dédiée aux courses à venir.

**Recommandation :** Hors scope de cet audit (nécessite un écran "Courses" dédié). À planifier en V2.

---

## Synthèse des bugs prioritaires

| # | Bug | Sévérité | Fichier | Ligne approx. |
|---|-----|----------|---------|---------------|
| 1 | Bouton "Résilier" visible en essai → no-op trompeur | Haute | tab-settings.tsx | ~1196 |
| 2 | "Plan actuel — Premium" sans indication "Essai" | Haute | tab-settings.tsx | ~1082 |
| 3 | Bloc Réglages "Support Prioritaire 24/7" affiché en essai | Moyenne | tab-settings.tsx | ~2565 |
| 4 | `subDetails` ne charge pas `status`/`trial_ends_at` | Bloquant (pour R3) | tab-settings.tsx | ~998 |
| 5 | Avantages par plan dupliqués (désync potentielle) | Faible | tab-settings.tsx | ~1039 |

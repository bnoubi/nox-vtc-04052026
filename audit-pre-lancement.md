# Audit pré-lancement NoX VTC
Date : 2026-07-11 — Lecture seule, aucune modification effectuée.

---

## 1. Webhooks Stripe — customer.subscription.created et customer.subscription.updated

**Fichier analysé :** `app/api/stripe/webhook/route.ts`

### Événements présents dans le switch

| Événement | Ligne | Présent |
|---|---|---|
| `checkout.session.completed` | 301 | ✓ |
| `customer.subscription.updated` | 341 | ✓ |
| `customer.subscription.deleted` | 353 | ✓ |
| `invoice.payment_failed` | 424 | ✓ |
| `invoice.paid` | 437 | ✓ |
| **`customer.subscription.created`** | — | **ABSENT** |

### customer.subscription.created — ABSENT

Aucun `case 'customer.subscription.created':` dans le switch. L'événement est silencieusement ignoré.

**Pourquoi ce n'est pas bloquant aujourd'hui :** la création d'abonnement transite par le checkout Stripe, et `checkout.session.completed` (mode `subscription`) appelle déjà `upsertSubscription()` qui insère/met à jour la table `subscriptions`. Le `customer.subscription.created` serait redondant dans ce flux.

**Risque résiduel :** si un abonnement est créé hors checkout (depuis le dashboard Stripe, via l'API, ou via un essai Stripe gratuit), aucun enregistrement ne sera créé en base. Ce cas n'est pas dans le product scope actuel mais constitue une dette technique.

### customer.subscription.updated — GÉRÉ (lignes 341-350)

```typescript
case 'customer.subscription.updated': {
  const sub     = event.data.object as Stripe.Subscription
  const userId  = sub.metadata?.userId
  const priceId = sub.items.data[0]?.price.id
  // log: userId, priceId, status
  if (!userId || !priceId) break
  await upsertSubscription(userId, priceId, sub.status, sub.id)
  break
}
```

`upsertSubscription()` (lignes 150-197) :
- Recherche une subscription existante pour `userId` → UPDATE si trouvée, INSERT sinon
- Champs mis à jour : `plan` (résolu via `resolvePlan(priceId)`), `status`, `stripe_subscription_id`, `payment_provider: 'stripe'`
- Champ `current_period_end` : **NON mis à jour** par ce handler — il est mis à jour uniquement par `invoice.paid` (ligne 452-458)
- Met aussi à jour `user_accounts.plan`

### Preuve de logs PM2 (500 dernières lignes)

```
[webhook] event reçu: customer.subscription.updated
[webhook] customer.subscription.updated — userId: 80ebaaec-... | priceId: price_1Th54F... | status: active
[webhook] event reçu: customer.subscription.updated
[webhook] customer.subscription.updated — userId: 80ebaaec-... | priceId: price_1Th54F... | status: past_due
```

`customer.subscription.created` : **aucune trace** dans les logs (événement jamais reçu ou ignoré sans log).

**⚠️ Point de vigilance :** `upsertSubscription()` insère avec `target_plan: 'solo'` en dur (ligne 182) — si un abonnement DUO ou TEAM est créé par ce handler, `target_plan` sera incorrectement `solo`. À documenter pour correction future.

### **CONCLUSION 1 :**
- `customer.subscription.created` → **ABSENT** (dette technique, non bloquant pour le flux actuel)
- `customer.subscription.updated` → **GÉRÉ** (actif en production, 2 événements tracés)

---

## 2. Fichier paypal-checkout-button.tsx

### Existence physique

```
/home/nox/projet_nox/nox/components/payment/paypal-checkout-button.tsx
/home/nox/projet_nox/nox/.claude/worktrees/cool-stonebraker-6e81e8/components/payment/paypal-checkout-button.tsx
```

Fichier présent. Importe `@paypal/react-paypal-js` (dépendance **non installée** → erreur TypeScript active `TS2307: Cannot find module '@paypal/react-paypal-js'`).

### Usage dans le projet

```bash
grep -rn "paypal-checkout-button" --include="*.tsx" --include="*.ts"
# → 0 résultat
```

**Aucun fichier n'importe `paypal-checkout-button`.** Le composant `PayPalCheckoutButton` n'est référencé nulle part dans le code applicatif.

Le worktree `.claude/worktrees/cool-stonebraker-6e81e8/` est un artefact de travail Claude Code (branche expérimentale), pas du code de production.

### **CONCLUSION 2 : EXISTE MAIS ORPHELIN**
Fichier safe à supprimer. Sa présence génère une erreur TypeScript préexistante (`TS2307`). Suppression recommandée avant lancement.

---

## 3. Tests réels Phase 3 — rôles admin

### a) Filtrage sidebar par permission

**Fichier :** `app/admin/(protected)/_components/admin-shell.tsx` lignes 38-73  
**Fichier :** `app/admin/(protected)/layout.tsx` lignes 27-43

`layout.tsx` récupère les permissions depuis `admin_roles.permissions` via un join `user_roles!admin_role_id(permissions)` et les passe en prop à `AdminShell` :
```typescript
const permissions: string[] = rawRole.admin_roles?.permissions ?? []
// → AdminShell({ permissions })
```

`admin-shell.tsx` filtre les items de navigation :
```typescript
const navItems = ALL_NAV_ITEMS.filter(item => {
  if (!item.permission) return true        // Dashboard : toujours visible
  if (permissions.includes('*')) return true // super_admin : tout visible
  return permissions.includes(item.permission)
})
```

Chaque item déclare sa permission requise (`users.read`, `subscriptions.read`, `tokens.read`, `analytics.read`, `users.write`, `tickets.write`, `admins.read`). Le tableau de bord (`/admin/dashboard`) est `permission: null` → toujours visible.

**→ GÉRÉ** — chaîne complète layout → props → filtre vérifiée.

---

### b) Bouton "Renvoyer l'invitation"

**Fichier :** `app/admin/(protected)/team/actions.ts` lignes 198-262  
**Fichier :** `app/admin/(protected)/team/_components/team-client.tsx` lignes 236-242 + 315-327

`resendAdminInvitation(userId)` existe et :
1. Vérifie permission `admins.write`
2. Regénère un lien invite Supabase
3. Renvoie l'email `adminInvitationEmail`
4. Log dans `admin_logs`

L'UI conditionne l'affichage du bouton à `m.lastSignIn === null` (ligne 316) :
```typescript
{m.lastSignIn === null && (
  <button onClick={() => handleResend(m)}>Renvoyer</button>
)}
```

**→ GÉRÉ** — fonction implémentée, appelée depuis l'UI, conditionnée par `lastSignIn === null`.

---

### c) Garde-fou dernier super_admin

**Fichier :** `app/admin/(protected)/team/actions.ts` lignes 264-272 (définition) + 296-300 (updateMemberRole) + 360-363 (revokeAdminMember)

```typescript
async function countSuperAdmins(db): Promise<number> {
  // récupère l'id du rôle super_admin → compte les user_roles avec cet id
}

// Dans updateMemberRole (rétrogradation) :
if (existingCode === 'super_admin' && newRole?.code !== 'super_admin') {
  const remaining = await countSuperAdmins(db)
  if (remaining <= 1) return { success: false, error: 'Impossible : ce compte est le dernier super_admin…' }
}

// Dans revokeAdminMember (révocation) :
if (existingCode === 'super_admin') {
  const remaining = await countSuperAdmins(db)
  if (remaining <= 1) return { success: false, error: 'Impossible : ce compte est le dernier super_admin…' }
}
```

**→ GÉRÉ** — appelé dans les deux chemins (rétrogradation et révocation), blocage effectif avec message d'erreur explicite.

---

### d) Champ "CONFIRMER"

**Fichier :** `app/admin/(protected)/team/_components/team-client.tsx` lignes 124-140 (composant) + 418-446 (modal changeRole) + 448-485 (modal revoke)

Le composant `ConfirmField` affiche un champ texte et exige la saisie exacte de `"CONFIRMER"`.

Conditions d'affichage :
- Modal changeRole : `isDemotingSuperAdmin = modal.member.roleCode === 'super_admin' && changeRoleId !== modal.member.roleId` (ligne 419)
- Modal revoke : `isSuperAdminTarget = modal.member.roleCode === 'super_admin'` (ligne 450)

Guard sur le bouton :
```typescript
// changeRole :
const canSubmit = !saving && changeRoleId !== modal.member.roleId
  && (!confirmRequired || confirmText === 'CONFIRMER')

// revoke :
const canSubmit = !saving && (!isSuperAdminTarget || confirmText === 'CONFIRMER')
```

Le bouton est `disabled={!canSubmit}` dans les deux modales.

**→ GÉRÉ** — champ présent, guard fonctionnel, appliqué aux deux opérations sur super_admin.

---

### e) Email de notification changement de rôle

**Fichier email :** `emails/admin-role-changed.tsx` (6.2 KB — présent)  
**Fichier actions :** `app/admin/(protected)/team/actions.ts`

Après `updateMemberRole` (lignes 316-336) :
```typescript
const { subject, html } = adminRoleChangedEmail({ event: 'role_change', … })
await sendEmail(m.email, subject, html)
```

Après `revokeAdminMember` (lignes 380-396) :
```typescript
const { subject, html } = adminRoleChangedEmail({ event: 'revoke', … })
await sendEmail(m.email, subject, html)
```

L'email est envoyé **après** succès de l'opération en base, dans le même bloc `if (targetUserId)`. L'envoi n'est pas protégé par un try/catch isolé — un crash Resend ferait remonter une exception non capturée dans l'action, sans faire échouer la mise à jour en base (l'UPDATE est déjà commis).

**→ GÉRÉ** — template présent, appelé dans les deux actions après succès. Absence de try/catch isolé autour de l'envoi email à noter (risque mineur : si Resend timeout, l'action retourne une erreur malgré la mise à jour réussie en base).

---

## 4. Action manuelle Supabase — Allowed Redirect URLs

**NON VÉRIFIABLE PAR CLAUDE CODE — action manuelle à confirmer par Bernard dans le dashboard Supabase.**

Vérifier dans : **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**

Les URLs à confirmer présentes :
- `https://app.noxvtc.fr/auth/callback`
- `https://app.noxvtc.fr/auth/callback?type=invite`
- (éventuellement l'URL localhost pour les tests)

---

## 5. Compte test youmbi.auto@gmail.com

Requête effectuée via l'API REST Supabase (service role, lecture seule).

### Résultats

**auth.users** :
```
email           : youmbi.auto@gmail.com
created_at      : 2026-07-09T13:30:58.639Z
last_sign_in_at : 2026-07-09T13:31:29.714Z
```

**user_accounts** :
```
id             : c173446d-cb4b-4ee9-8682-ec4a95203e33
plan           : SOLO
account_status : active
created_at     : 2026-07-09T13:30:58.844Z
```

**user_roles** :
```
id             : 3c5157e3-4e72-4f92-be35-2e797721dd06
admin_role_id  : 854e4fc4-8db9-45d2-a125-3d653222cf39
role résolu    : finance (code: "finance", name: "Finance")
assigned_at    : 2026-07-09T13:30:58.953Z
```

Le compte existe dans les trois tables (`auth.users`, `user_accounts`, `user_roles`). Il dispose d'un rôle admin actif (`finance`). Il s'est connecté une fois le 09/07/2026 à 13:31 UTC.

**→ COMPTE TOUJOURS PRÉSENT — À NETTOYER**
Rôle admin actif (finance). Doit être révoqué depuis `/admin/team` puis supprimé via le dashboard Supabase avant lancement.

---

## Tableau récapitulatif

| # | Sujet | Statut | Action requise |
|---|---|---|---|
| 1a | Webhook `customer.subscription.created` | **ABSENT** | Dette technique — non bloquant pour le flux checkout actuel. À implémenter si création hors checkout envisagée. |
| 1b | Webhook `customer.subscription.updated` | **GÉRÉ** | RAS — actif en production. Vérifier `target_plan` hardcodé à `'solo'` (ligne 182). |
| 2 | `paypal-checkout-button.tsx` | **ORPHELIN** | Supprimer le fichier (élimine aussi l'erreur TS2307 préexistante). |
| 3a | Filtrage sidebar par permission | **GÉRÉ** | RAS |
| 3b | Bouton "Renvoyer l'invitation" | **GÉRÉ** | RAS |
| 3c | Garde-fou dernier super_admin | **GÉRÉ** | RAS |
| 3d | Champ "CONFIRMER" | **GÉRÉ** | RAS |
| 3e | Email notification changement de rôle | **GÉRÉ** | Ajouter try/catch isolé autour de `sendEmail` (risque mineur). |
| 4 | Allowed Redirect URLs Supabase | **NON VÉRIFIABLE** | Vérification manuelle par Bernard dans le dashboard Supabase. |
| 5 | Compte test youmbi.auto@gmail.com | **PRÉSENT** | Révoquer le rôle finance via `/admin/team`, puis supprimer le compte dans Supabase Auth. |

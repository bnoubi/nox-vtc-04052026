# Compte-rendu — Corrections /admin/team (09/07/2025)

## Contexte

4 bugs corrigés sur la page `/admin/team` du back-office NoX VTC.
Build : ✅ 0 erreur TypeScript. Déployé après validation.

---

## BUG 1 — Lien d'invitation atterrit sur /login (hash fragment)

### Cause racine
Supabase ignore le `redirectTo` passé dans `generateLink({ type: 'invite' })` si l'URL n'est pas whitelistée dans le dashboard Supabase → il redirige vers la Site URL (`/login`) avec le token en hash fragment (`#access_token=...&type=invite`).

### Fix Supabase dashboard (action manuelle requise)
1. Ouvrir le projet dans [app.supabase.com](https://app.supabase.com)
2. **Authentication → URL Configuration**
3. Dans **Allowed Redirect URLs**, ajouter :
   ```
   https://app.noxvtc.fr/auth/callback
   https://app.noxvtc.fr/auth/callback?type=invite
   ```
4. Sauvegarder

### Fix code (fallback défensif)
**`components/AuthScreen.tsx`** — `useEffect` au montage : si `window.location.hash` contient `access_token` + `type=invite`, on écoute `onAuthStateChange` et on redirige vers `/auth/reset-password` dès que `SIGNED_IN` est détecté. Le client Supabase JS échange automatiquement le hash token en session.

---

## BUG 2 — Menus sidebar visibles par tous les rôles

### Fix
**`app/admin/(protected)/_components/admin-shell.tsx`**
- `navItems` → `ALL_NAV_ITEMS` avec champ `permission` par item
- Mapping permissions :
  | Menu | Permission requise |
  |------|-------------------|
  | Tableau de bord | toujours visible |
  | Utilisateurs | `users.read` |
  | Abonnements | `subscriptions.read` |
  | Jetons | `tokens.read` |
  | Analytics | `analytics.read` |
  | Configuration | `users.write` |
  | Support | `tickets.write` |
  | Équipe | `admins.read` |
- `navItems` est maintenant calculé à l'intérieur du composant en filtrant `ALL_NAV_ITEMS` avec les permissions reçues en prop
- `*` (super_admin) = tout visible

**`app/admin/(protected)/layout.tsx`**
- La query `user_roles` inclut désormais le join `admin_roles!admin_role_id(permissions)`
- Les permissions sont passées comme prop `permissions` à `<AdminShell />`

**`app/admin/(protected)/_components/admin-shell.tsx`**
- Nouveau prop `permissions: string[]` dans `AdminShellProps`

---

## BUG 3 — Impossible de renvoyer une invitation expirée

### Fix
**`app/admin/(protected)/team/actions.ts`** — Nouvelle action `resendAdminInvitation(userId)` :
1. Vérifie `admins.write`
2. Récupère email + nom depuis `user_accounts`
3. Récupère le rôle actuel depuis `user_roles → admin_roles`
4. Appelle `sbAdmin.auth.admin.generateLink({ type: 'invite', email })` → nouveau lien d'invitation
5. Envoie l'email brandé via Resend (même template que l'invitation initiale)
6. Insère un log `resend_admin_invitation` dans `admin_logs`

**`app/admin/(protected)/team/_components/team-client.tsx`**
- Bouton **"Renvoyer"** (icône `Send`) dans la colonne Actions
- Visible **uniquement** quand `m.lastSignIn === null` (invitation jamais acceptée)

---

## BUG 4 — Garde-fous manquants

### 4a — Garde dernier super_admin (permanent, server-side)

**`app/admin/(protected)/team/actions.ts`**

Nouvelle fonction interne `countSuperAdmins(db)` : compte les `user_roles` liés au rôle `super_admin`.

- **`updateMemberRole`** : si le rôle actuel est `super_admin` ET le nouveau rôle ne l'est pas → vérifie `count ≥ 2`, sinon retourne une erreur explicite
- **`revokeAdminMember`** : si le rôle actuel est `super_admin` → même vérification

Erreurs retournées :
> "Impossible : ce compte est le dernier super_admin. Promouvez un autre admin en super_admin avant de rétrograder/révoquer celui-ci."

### 4b — Confirmation "CONFIRMER" (client-side)

**`app/admin/(protected)/team/_components/team-client.tsx`**

Nouveau composant `ConfirmField` — champ texte demandant de taper `CONFIRMER`.

- **Modal Modifier le rôle** : le champ apparaît si le membre est actuellement `super_admin` ET qu'un rôle différent est sélectionné (rétrogradation). Le bouton "Confirmer" reste désactivé tant que le texte n'est pas exactement `CONFIRMER`.
- **Modal Révoquer** : le champ apparaît si le membre est `super_admin`. Même logique.

Le champ est réinitialisé à chaque ouverture de modal et à chaque changement de rôle sélectionné.

### 4c — Email notification (role change + revocation)

**`emails/admin-role-changed.tsx`** — Nouveau template (dark theme, même charte que l'invitation) :
- Mode `role_change` : affiche ancien rôle → nouveau rôle avec les couleurs `ROLE_CONFIG`, mentionne l'admin qui a fait le changement
- Mode `revoke` : bandeau rouge "Accès révoqué", mentionne l'admin qui a révoqué

**`app/admin/(protected)/team/actions.ts`**
- `updateMemberRole` : après la mise à jour réussie, récupère email + nom du membre et email de l'admin, envoie `adminRoleChangedEmail({ event: 'role_change', ... })`
- `revokeAdminMember` : après la suppression réussie, envoie `adminRoleChangedEmail({ event: 'revoke', ... })`

---

## Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `emails/admin-role-changed.tsx` | Créé |
| `app/admin/(protected)/team/actions.ts` | Modifié |
| `app/admin/(protected)/team/_components/team-client.tsx` | Modifié |
| `app/admin/(protected)/_components/admin-shell.tsx` | Modifié |
| `app/admin/(protected)/layout.tsx` | Modifié |
| `components/AuthScreen.tsx` | Modifié |

---

## Tests recommandés

1. **BUG 1** : Créer un compte test → vérifier que le lien arrivant sur `/auth/callback?type=invite` (après fix dashboard Supabase) redirige vers `/auth/reset-password`. Avant le fix dashboard, l'atterrissage sur `/login#access_token=...` doit aussi rediriger.
2. **BUG 2** : Se connecter avec un compte `support` ou `finance` → vérifier que seuls les menus autorisés sont visibles.
3. **BUG 3** : Créer un compte test → ne pas accepter l'invitation → cliquer "Renvoyer" dans le tableau → vérifier réception email.
4. **BUG 4a** : Avec un seul super_admin, tenter de le rétrograder ou révoquer → doit être refusé.
5. **BUG 4b** : Ouvrir modal Modifier Rôle pour un super_admin → champ CONFIRMER doit apparaître. Tenter de soumettre sans écrire CONFIRMER → bouton désactivé.
6. **BUG 4c** : Changer le rôle d'un compte test → vérifier réception email de notification. Révoquer un compte test → vérifier réception email de révocation.

**Nettoyage** : supprimer tous les comptes test créés pendant les tests.

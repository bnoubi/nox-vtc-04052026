# Rapport — Implémentation `pending_deletion`

**Répertoire projet** : `/home/nox/projet_nox/nox`  
**Date** : 2026-06-30

---

## Fichiers modifiés

### 1. `components/dashboard/nox-context.tsx`

**Ajouts :**
- 3 champs dans `NoxContextType` : `accountStatus: string`, `deletionScheduledFor: string | null`, `deletionRequestedAt: string | null`
- 3 états dans `NoxProvider` : `accountStatus`, `deletionScheduledFor`, `deletionRequestedAt`
- Requête Supabase dans `initStore()` pour charger `account_status`, `deletion_scheduled_for`, `deletion_requested_at` depuis `user_accounts`
- Exposition dans la valeur du contexte

---

### 2. `app/page.tsx`

**Ajouts :**
- Import de `useNox` et `AlertTriangle`
- Composant `DeletionBanner()` : bannière rouge persistante affichée si `accountStatus === 'pending_deletion'`
  - Fond `bg-red-950`, bordure `border-red-600`, icône `AlertTriangle`
  - Date de suppression formatée en français (ex : "15 juillet 2026")
  - Lien mailto `support@noxvtc.fr` en gold `#C9A84C`
  - Pas de bouton fermer — permanente
- Insertion de `<DeletionBanner />` comme premier enfant du `flex flex-col` dashboard, avant `AnimatePresence` → visible sur tous les onglets, pousse le contenu vers le bas

---

### 3. `components/dashboard/account-security/DeleteAccountScreen.tsx`

**Ajouts :**
- Import `Clock` (lucide-react)
- Import `useNox` depuis nox-context
- Destructuration `{ accountStatus, deletionRequestedAt, deletionScheduledFor }` depuis `useNox()`

**Comportement step 1 :**
- Si `accountStatus === 'pending_deletion'` → affiche encart informatif rouge sobre :
  - Icône `Clock`
  - "Suppression demandée le JJ/MM/AAAA"
  - "Suppression effective le JJ mois AAAA"
  - Séparateur horizontal
  - Lien `support@noxvtc.fr` en gold
  - Bouton `onBack` conservé (SubScreenHeader)
- Sinon → comportement normal (bouton "Je veux supprimer mon compte")

---

### 4. `app/admin/actions.ts`

**Modifications :**
- `UserDetail` enrichi : `deletion_requested_at: string | null`, `deletion_scheduled_for: string | null`
- `getUserDetail` : select étendu + `AccRow` type étendu + return enrichi

**Nouvelle action :**

```ts
export async function cancelUserDeletion(targetUserId: string): Promise<{ success: boolean; error?: string }>
```

Flux :
1. `verifyAdmin()` → 403 si non admin
2. `UPDATE user_accounts SET account_status='active', deletion_requested_at=null, deletion_scheduled_for=null, updated_at=now() WHERE id=targetUserId AND account_status='pending_deletion'`
3. `UPDATE profiles SET status='active', deletion_requested_at=null, deletion_scheduled_for=null, updated_at=now() WHERE user_id=targetUserId`
4. `INSERT admin_logs` : `action='cancel_deletion'`, `details: { cancelled_at }`
5. Envoi email Resend à l'utilisateur :
   - Sujet : "Votre demande de suppression a été annulée — NoX VTC"
   - Bouton "Accéder à mon espace" → `https://app.noxvtc.fr`
6. `revalidateAdminWrites(targetUserId)`
7. Retourne `{ success: true }` ou `{ success: false, error: string }`

---

### 5. `app/admin/(protected)/users/[id]/_components/user-detail-client.tsx`

**Ajouts :**
- Import `Clock` (lucide-react)
- Import `cancelUserDeletion` depuis actions
- État `showCancelDeletion` (boolean)
- Constante `isPendingDeletion = user.account_status === 'pending_deletion'`

**Badge** dans "Profil utilisateur" : si `isPendingDeletion`, badge rouge "Suppression programmée" à côté du nom

**Encart d'alerte** (avant "Actions admin") : si `isPendingDeletion` :
- Icône `Clock` + titre rouge "Suppression de compte programmée"
- Dates `deletion_requested_at` et `deletion_scheduled_for` formatées
- Bouton rouge "Annuler la suppression" → ouvre modale

**Modale de confirmation** :
- Titre : "Annuler la suppression"
- Message : "Confirmer l'annulation pour [email] ?"
- Encart vert info : le compte redeviendra actif + email envoyé
- Bouton "Confirmer" → `run(() => cancelUserDeletion(user.id), ...)`
- Feedback succès/erreur via `FeedbackBanner`

---

## Aucun fichier créé

Toutes les modifications sont des éditions d'existants.

## TypeScript

`npx tsc --noEmit` : **0 erreur introduite** par ces changements.  
Les 7 erreurs listées sont pré-existantes (Stripe, PayPal, auth/callback).

## À faire après validation

```bash
cd ~/projet_nox/nox && npm run build
pm2 stop nox-vtc && pm2 start nox-vtc && pm2 save
```

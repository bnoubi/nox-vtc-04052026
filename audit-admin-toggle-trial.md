# Audit — Toggle admin pour disable_auto_trial

## 1. Structure actuelle de /admin

| Dossier | Titre visible | Fonction |
|---------|--------------|---------|
| `dashboard/` | Tableau de bord | KPIs temps réel |
| `users/` | Utilisateurs | Liste + fiche individuelle |
| `subscriptions/` | Abonnements | Tableau subscriptions |
| `tokens/` | Jetons | Wallets + attribution |
| `analytics/` | Analytics | Métriques long terme (lecture seule) |
| `settings/` | **Configuration** | Toggle promo + coupon Stripe |
| `support/` | Support | File de tickets |
| `team/` | Équipe Admin | Membres, rôles, invitations |
| `communications/` | Communications | Emails groupés |

### La page "Configuration" existe déjà

`app/admin/(protected)/settings/page.tsx` — H2 = "Configuration", sous-titre = "Paramètres globaux de la plateforme". Elle gère déjà `promo_active` / `promo_percent` / `promo_coupon_id` via `app_config`. C'est l'emplacement naturel pour le toggle `disable_auto_trial`.

---

## 2. Système de permissions

### Signature de `verifyAdminPermission` (`lib/supabase/admin.ts`)

```typescript
export async function verifyAdminPermission(
  requiredPermission?: string
): Promise<AdminPermissionCheck>

// Retourne :
// { authorized: true; adminId: string; permissions: string[] }
// { authorized: false; status: 401 | 403 }
```

Logique clé (lignes 47–53) :
```typescript
if (
  requiredPermission &&
  !permissions.includes('*') &&
  !permissions.includes(requiredPermission)
) {
  return { authorized: false, status: 403 }
}
```

### Permissions existantes (exhaustif depuis le code)

| Permission | Action protégée |
|-----------|----------------|
| `users.read` | `getUsers`, `getUserDetail` |
| `users.write` | `changePlan`, `suspendAccount`, `reactivateAccount`, `deleteAccount`, `sendAdminEmail`, `sendCommunication` |
| `tokens.write` | `addTokens` |
| `tokens.read` | `getTokensData`, `getTokenHistory` |
| `subscriptions.read` | `getSubscriptions` |
| `subscriptions.write` | `changePlan`, `changeSubscriptionPlan` |
| `analytics.read` | Accès page Analytics (sidebar seulement) |
| `tickets.write` | Accès page Support (sidebar seulement) |
| `admins.read` | `getAdminTeam` |
| `admins.write` | `createAdminMember`, `updateMemberRole`, `revokeAdminMember` |

### Comportement super_admin

Un `super_admin` doit avoir `'*'` dans son tableau `permissions` en base (`admin_roles.permissions = ['*']`). Si `'*'` est présent, toute vérification spécifique est court-circuitée. Ce n'est pas automatique : c'est une convention qui repose sur les données en base.

### Recommandation pour ce toggle

**Nouvelle permission dédiée : `config.write`**, réservée au `super_admin` (`'*'`).

Pourquoi une permission dédiée plutôt que `users.write` :
- `users.write` est accordée aux `admin` ordinaires pour gérer les comptes. Ce toggle affecte TOUS les futurs inscrits — son impact est d'ordre stratégique, pas opérationnel.
- Une permission `config.write` distincte permet de l'accorder granullairement sans donner accès aux autres paramètres globaux.
- Elle suit le pattern existant : chaque action sensible a sa propre permission string.

En pratique, seul le `super_admin` (qui a `'*'`) pourra l'utiliser, sans aucune modification de la table `admin_roles`. La string `'config.write'` n'a pas besoin d'être provisionnée en base pour les autres rôles — elle est simplement vérifiée par `verifyAdminPermission('config.write')` et passera uniquement via le wildcard `'*'`.

---

## 3. Usages de `app_config` dans le projet

### Fichiers concernés (hors exclusions)

| Fichier | Usage | Via |
|---------|-------|-----|
| `app/admin/(protected)/settings/page.tsx` | Lecture + écriture promo | Client anon (⚠️ sans server action) |
| `app/api/stripe/checkout/route.ts` | Lecture promo pour coupon | `createAdminClient()` (service role) |
| `lib/hooks/usePromo.ts` | Lecture promo pour affichage prix | Client anon |
| `supabase/migrations/20260723000001_feature_flag_disable_auto_trial.sql` | DDL + trigger | PostgreSQL |

### Point critique — `settings/page.tsx` utilise le client anon

La page de configuration actuelle écrit dans `app_config` via le **client Supabase anon**, sans server action et sans log admin :

```typescript
// settings/page.tsx ligne 37-44
await supabase
  .from("app_config")
  .update({ value: newValue.toString() })
  .eq("key", "promo_active")
```

La migration `20260723000001` active RLS sur `app_config` (`ALTER TABLE app_config ENABLE ROW LEVEL SECURITY`) mais ne crée aucune policy d'écriture pour `authenticated`. Le toggle promo actuel fonctionne probablement parce qu'il n'y a pas encore de policy restrictive en base (la table existait avant la migration qui a activé la RLS).

**Conséquence** : pour `disable_auto_trial`, il faut impérativement un server action avec `createAdminClient()` (service role, bypass RLS). Cela résoudra aussi implicitement le risque sur l'écriture promo existante.

---

## 4. Pattern server action + log

### Référence canonique : `app/admin/actions.ts`

#### Signature de `logAction`

```typescript
// actions.ts lignes 237-239
async function logAction(
  adminId: string,
  action: string,
  targetUserId: string,
  details?: Record<string, unknown>
): Promise<void>

// Champs insérés dans admin_logs :
{
  action: string,         // ex: 'add_tokens', 'change_plan'
  admin_id: string,       // UUID de l'admin qui agit
  target_user_id: string, // UUID cible (user affecté)
  details: JSONB | null   // contexte libre
}
```

#### Exemple 1 — `addTokens` (pattern le plus propre)

```typescript
// actions.ts lignes 408-447
const auth = await verifyAdmin('tokens.write')      // 1. vérification
if ('error' in auth) return { success: false, error: auth.error }

// ... action principale ...

await logAction(auth.adminId, 'add_tokens', targetUserId, {
  amount, motif
})                                                    // 3. log
revalidateAdminWrites(targetUserId)
```

#### Exemple 2 — `changePlan`

```typescript
// actions.ts lignes 465-521
const auth = await verifyAdmin('subscriptions.write')  // 1.
if ('error' in auth) return { success: false, error: auth.error }

// ... action ...

await logAction(auth.adminId, 'change_plan', targetUserId, {
  current_plan, new_plan, start_date, end_date
})                                                      // 3.
revalidateAdminWrites(targetUserId)
```

#### Adaptation pour le toggle `disable_auto_trial`

Le toggle ne cible pas un `target_user_id` particulier (il affecte tous les futurs inscrits). Convention à utiliser : passer `auth.adminId` comme `target_user_id` (pratique déjà observée dans `team/actions.ts` pour les actions d'auto-modification). Les `details` doivent inclure `{ old_value, new_value }` pour la traçabilité.

```typescript
await logAction(auth.adminId, 'toggle_disable_auto_trial', auth.adminId, {
  old_value: previousValue,   // valeur avant
  new_value: newValue         // 'true' ou 'false'
})
```

---

## 5. Risque de régression

### Le trigger lit `app_config` en lecture seule : confirmé

Dans `20260723000001`, la fonction `ensure_user_bootstrap` (lignes 65–69) :

```sql
SELECT (value = 'true')
  INTO v_disable_trial
  FROM public.app_config
 WHERE key = 'disable_auto_trial'
 LIMIT 1;
```

`SELECT ... INTO variable` PL/pgSQL — aucun effet de bord. Aucune écriture.

### UI admin = UPDATE SQL manuel : strictement équivalent

La commande manuelle testée avec succès (Tests A et B) :
```sql
UPDATE public.app_config SET value = 'true' WHERE key = 'disable_auto_trial';
```

Le server action produira exactement :
```typescript
await adminClient
  .from('app_config')
  .update({ value: 'true' })
  .eq('key', 'disable_auto_trial')
```

La table `app_config` n'a ni trigger `BEFORE UPDATE`, ni colonne `GENERATED`, ni vue intermédiaire. L'écriture est atomique côté PostgreSQL.

### Risque de cache désynchronisé : aucun

- **PostgreSQL** : le trigger lit la valeur committed au moment de l'exécution, dans la même transaction. Aucun cache applicatif entre la table et le trigger.
- **Next.js** : la page `settings` est un client component (pas de Next.js data cache). Le server action appellera `revalidatePath('/admin/settings')` pour invalider toute route cache côté serveur.
- **RLS + SECURITY DEFINER** : le trigger bypass la RLS inconditionnellement (owner = postgres, superuser).

---

## Proposition finale

### Emplacement

**Page existante `app/admin/(protected)/settings/page.tsx`** — ajouter le toggle en bas de page, dans une nouvelle section "Inscriptions", distincte de la section "Promotions" existante.

### Permission

Nouvelle string `'config.write'` — pas besoin de provisionnement en base pour les rôles existants. Seul le `super_admin` (via wildcard `'*'`) pourra activer/désactiver. Les admins ordinaires ne verront pas le toggle (à filtrer côté UI via le tableau `permissions` passé par le layout).

### Plan d'implémentation

**Fichier 1 — `app/admin/(protected)/settings/actions.ts`** (nouveau)
- `getAppConfig()` — lecture de `disable_auto_trial` via `createAdminClient()`
- `setDisableAutoTrial(value: boolean)` :
  1. `verifyAdminPermission('config.write')`
  2. Lire la valeur actuelle (pour `old_value` dans le log)
  3. `createAdminClient().from('app_config').update({ value: String(value) }).eq('key', 'disable_auto_trial')`
  4. `logAction(auth.adminId, 'toggle_disable_auto_trial', auth.adminId, { old_value, new_value: String(value) })`
  5. `revalidatePath('/admin/settings')`

**Fichier 2 — `app/admin/(protected)/settings/page.tsx`** (modification)
- Ajouter une section "Inscriptions" avec un toggle switch (même composant shadcn/ui que le toggle promo)
- Afficher la valeur courante de `disable_auto_trial`
- Filtrer la visibilité du toggle selon `permissions.includes('*') || permissions.includes('config.write')`
- Appeler le server action au clic

**Aucun autre fichier à modifier** — le trigger PostgreSQL, `auth/callback/route.ts` et `onboarding/welcome/route.ts` lisent déjà la valeur en base, indépendamment de l'UI.

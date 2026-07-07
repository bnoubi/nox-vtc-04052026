# Phase 2 — Permissions granulaires admin (2026-07-07)

## Contexte

Avant cette phase, toute vérification admin se résumait à « l'utilisateur est-il dans `user_roles` avec le code `admin` ou `super_admin` ? ». La colonne `permissions` de `admin_roles` n'était jamais lue. Un utilisateur rôle `support` ou `finance` avait donc accès aux mêmes actions qu'un `admin`.

## Schéma des rôles en base (inchangé)

```
admin_roles
  id   | code        | permissions (text[])
-------+-------------+------------------------------------------------------------------
 ...   | super_admin | ['*']
 ...   | admin       | ['users.read','users.write','subscriptions.read',
       |             |  'subscriptions.write','tokens.write']
 ...   | support     | ['users.read','subscriptions.read','tickets.write']
 ...   | finance     | ['subscriptions.read','payments.read','analytics.read']

user_roles
  id | user_id | admin_role_id (FK → admin_roles.id) | assigned_by | assigned_at
```

---

## Fichiers modifiés

### 1. `lib/supabase/admin.ts` — nouveau helper centralisé

Ajout de `verifyAdminPermission(requiredPermission?)` et du type `AdminPermissionCheck`.

```typescript
import { createClient } from '@supabase/supabase-js'
import { createClient as createSsrClient } from '@/lib/supabase/server'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type AdminPermissionCheck =
  | { authorized: true; adminId: string; permissions: string[] }
  | { authorized: false; status: 401 | 403 }

/**
 * Vérifie que l'utilisateur courant a un rôle admin ET, si fournie,
 * la permission précise requise.
 *
 * Logique :
 * - permissions contient '*' → super_admin, toujours autorisé
 * - requiredPermission absent → juste vérifier la présence d'un rôle
 * - requiredPermission présent → doit être dans le tableau permissions
 */
export async function verifyAdminPermission(
  requiredPermission?: string
): Promise<AdminPermissionCheck> {
  const supabase = await createSsrClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authorized: false, status: 401 }

  const db = createAdminClient()
  const { data: roleData } = await db
    .from('user_roles')
    .select('admin_roles!admin_role_id(permissions)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!roleData) return { authorized: false, status: 403 }

  // PostgREST retourne le join comme un objet (many→one) mais le type générique
  // inféré est un tableau — on passe par unknown pour typer manuellement.
  const raw = roleData as unknown as { admin_roles: { permissions: string[] } | null }
  const permissions: string[] = raw.admin_roles?.permissions ?? []

  if (
    requiredPermission &&
    !permissions.includes('*') &&
    !permissions.includes(requiredPermission)
  ) {
    return { authorized: false, status: 403 }
  }

  return { authorized: true, adminId: user.id, permissions }
}
```

---

### 2. `app/admin/actions.ts` — refactoring complet

**Imports remplacés :**
```typescript
// Avant
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'

// Après
import { createAdminClient, verifyAdminPermission } from '@/lib/supabase/admin'
```

**`makeAdminClient()` simplifié :**
```typescript
function makeAdminClient() {
  return createAdminClient()
}
```

**`checkAdminRole()` — accepte maintenant TOUS les rôles (y compris support/finance) :**
```typescript
// Avant : ne vérifiait que 'admin' et 'super_admin'
export async function checkAdminRole(): Promise<boolean> {
  const check = await verifyAdminPermission()
  return check.authorized
}
```

**`AdminCheck` type étendu :**
```typescript
// Avant
type AdminCheck = { adminId: string } | { error: string }

// Après
type AdminCheck = { adminId: string; permissions: string[] } | { error: string }
```

**`verifyAdmin()` — accepte maintenant un paramètre de permission :**
```typescript
// Avant
async function verifyAdmin(): Promise<AdminCheck> {
  // ... 10 lignes de code dupliqué

// Après
async function verifyAdmin(requiredPermission?: string): Promise<AdminCheck> {
  const check = await verifyAdminPermission(requiredPermission)
  if (!check.authorized) return { error: 'Non autorisé.' }
  return { adminId: check.adminId, permissions: check.permissions }
}
```

**Mapping complet des Server Actions → permissions :**

| Fonction | Permission |
|---|---|
| `getUsers()` | `users.read` |
| `getUserDetail()` | `users.read` |
| `addTokens()` | `tokens.write` |
| `changePlan()` | `subscriptions.write` |
| `suspendAccount()` | `users.write` |
| `reactivateAccount()` | `users.write` |
| `deleteAccount()` | `users.write` |
| `cancelUserDeletion()` | `users.write` |
| `sendAdminEmail()` | `users.write` |
| `getSubscriptions()` | `subscriptions.read` |
| `getTokensData()` | `tokens.write` |
| `getTokenHistory()` | `tokens.write` |
| `changeSubscriptionPlan()` | `subscriptions.write` |

---

### 3. Routes API — inline auth remplacé par `verifyAdminPermission`

#### `app/api/admin/analytics/route.ts`
```typescript
// Avant : ~18 lignes inline (fetch admin_roles + user_roles)
// Après :
import { verifyAdminPermission } from '@/lib/supabase/admin'
import { getAdminAnalytics } from '@/app/admin/analytics-data'

export async function GET() {
  const auth = await verifyAdminPermission('analytics.read')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const data = await getAdminAnalytics()
  return NextResponse.json(data)
}
```

#### `app/api/admin/kpis/route.ts`
```typescript
// Permission : analytics.read
export async function GET() {
  const auth = await verifyAdminPermission('analytics.read')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const kpis = await getAdminKPIs()
  return NextResponse.json(kpis)
}
```

#### `app/api/admin/send-tokens-email/route.ts`
```typescript
// Permission : tokens.write
export async function POST(request: NextRequest) {
  const auth = await verifyAdminPermission('tokens.write')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const adminDb = createAdminClient()
  // ... reste inchangé
}
```

#### `app/api/onboarding/welcome/status/route.ts`
```typescript
// Permission : users.read
export async function GET(request: NextRequest) {
  const auth = await verifyAdminPermission('users.read')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const adminDb = createAdminClient()
  // ... reste inchangé
}
```

---

### 4. Server Actions sans garde (faille comblée)

Ces deux fichiers n'avaient **aucune vérification d'identité** — n'importe quel utilisateur authentifié pouvait les appeler directement.

#### `app/admin/(protected)/communications/actions.ts`
```typescript
import { verifyAdminPermission } from '@/lib/supabase/admin'

export async function sendCommunication(...): Promise<{ sent: number; failed: number }> {
  const auth = await verifyAdminPermission('users.write')   // ← ajouté
  if (!auth.authorized) throw new Error('Non autorisé')
  // ... reste inchangé
}
```

#### `app/admin/(protected)/support/[id]/actions.ts`
```typescript
import { verifyAdminPermission } from '@/lib/supabase/admin'

export async function updateTicketStatus(ticketId: string, status: string) {
  const auth = await verifyAdminPermission('tickets.write')  // ← ajouté
  if (!auth.authorized) throw new Error('Non autorisé')
  // ...
}

export async function updateTicketPriority(ticketId: string, priority: string) {
  const auth = await verifyAdminPermission('tickets.write')  // ← ajouté
  if (!auth.authorized) throw new Error('Non autorisé')
  // ...
}

export async function sendAdminReply(ticketId: string, content: string, userEmail: string, subject: string) {
  const auth = await verifyAdminPermission('tickets.write')  // ← ajouté
  if (!auth.authorized) throw new Error('Non autorisé')
  // ...
}
```

---

## Résultats des tests (vérification directe DB)

Comptes de test temporaires insérés dans `user_roles` :
- `bernardnoubi+test6@gmail.com` → rôle `support`
- `e.njangui237@gmail.com` → rôle `finance`

Puis supprimés après vérification.

| Permission | support | finance | super_admin | no_role |
|---|:---:|:---:|:---:|:---:|
| `users.read` | ✓ | ✗ | ✓ | ✗ |
| `users.write` | ✗ | ✗ | ✓ | ✗ |
| `subscriptions.read` | ✓ | ✓ | ✓ | ✗ |
| `subscriptions.write` | ✗ | ✗ | ✓ | ✗ |
| `tokens.write` | ✗ | ✗ | ✓ | ✗ |
| `tickets.write` | ✓ | ✗ | ✓ | ✗ |
| `analytics.read` | ✗ | ✓ | ✓ | ✗ |
| `payments.read` | ✗ | ✓ | ✓ | ✗ |

**Build :** propre, 0 erreur dans les fichiers modifiés.

---

## Cas limites et décisions en attente

### ⚠️ Lacunes dans la définition du rôle `admin`

Le rôle `admin` manque de deux permissions qui semblent être des oublis :

**1. `analytics.read` absent du rôle `admin`**

Impact : un utilisateur rôle `admin` reçoit **403** sur `/api/admin/kpis` et `/api/admin/analytics`. Il peut gérer users/tokens/abonnements mais ne voit **pas** les KPIs du dashboard.

Si c'est un oubli, corriger en SQL Editor :
```sql
UPDATE admin_roles
SET permissions = array_append(permissions, 'analytics.read')
WHERE code = 'admin';
```

**2. `tickets.write` absent du rôle `admin`**

Impact : un utilisateur rôle `admin` **ne peut pas** répondre aux tickets de support ni changer leur statut — seul le rôle `support` le peut.

Si c'est un oubli, corriger en SQL Editor :
```sql
UPDATE admin_roles
SET permissions = array_append(permissions, 'tickets.write')
WHERE code = 'admin';
```

### Autres points

**`payments.read`** (rôle `finance`) : aucune route n'utilise encore cette permission. Prévu pour le module facturation/revenus.

**`getTokensData` / `getTokenHistory`** → `tokens.write` : il n'existe pas de permission `tokens.read`. Ces fonctions affichent les données de jetons mais utilisent la permission d'écriture comme verrou. Finance ne voit pas les données de jetons (intentionnel ou oubli ?).

**`sendCommunication`** → `users.write` : pas de permission dédiée `communications.write` dans le schéma. Seuls admin et super_admin peuvent envoyer des communications en masse.

---

## Déploiement

Non déployé — en attente de validation + décision sur les 2 lacunes du rôle `admin`.

Commandes quand validé :
```bash
cd ~/projet_nox/nox
npm run build
pm2 stop nox-vtc && pm2 start nox-vtc && pm2 save
git add -A && git commit -m "feat: permissions granulaires Phase 2 — verifyAdminPermission"
git push origin main && git push guard HEAD:main
```

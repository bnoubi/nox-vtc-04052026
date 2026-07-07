# Phase 2 & Phase 3 — Permissions granulaires + Gestion équipe admin

## Périmètre

- **Phase 2** : Remplacement du contrôle d'accès grossier (is admin?) par un système de permissions par action, lecture dans `admin_roles.permissions[]`.
- **Phase 3** : Page de gestion de l'équipe admin (`/admin/team`), invitation par lien brandé Resend, guards super_admin, bypass onboarding pour les admins.

---

## SQL à exécuter (Supabase SQL Editor — dans cet ordre)

### 1. Créer la table `user_roles` et `admin_roles` (si pas déjà existantes)

```sql
-- admin_roles : catalogue des rôles avec leurs permissions
CREATE TABLE IF NOT EXISTS admin_roles (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}'
);

-- user_roles : association utilisateur → rôle admin
CREATE TABLE IF NOT EXISTS user_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_role_id uuid NOT NULL REFERENCES admin_roles(id),
  assigned_by   uuid REFERENCES auth.users(id),
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
```

### 2. Peupler les rôles (Phase 2 initial)

```sql
INSERT INTO admin_roles (code, name, permissions) VALUES
  ('super_admin', 'Super Administrateur', ARRAY['*']),
  ('admin',       'Administrateur',       ARRAY['users.read','users.write','subscriptions.read','subscriptions.write','tokens.write']),
  ('finance',     'Finance',              ARRAY['subscriptions.read','payments.read','analytics.read']),
  ('support',     'Support',              ARRAY['users.read','subscriptions.read','tickets.write'])
ON CONFLICT (code) DO NOTHING;
```

### 3. Corrections Phase 2 (ajout permissions manquantes)

```sql
-- Ajouter analytics.read + tickets.write au rôle admin
UPDATE admin_roles
SET permissions = array_append(permissions, 'analytics.read')
WHERE code = 'admin' AND NOT 'analytics.read' = ANY(permissions);

UPDATE admin_roles
SET permissions = array_append(permissions, 'tickets.write')
WHERE code = 'admin' AND NOT 'tickets.write' = ANY(permissions);

-- Ajouter tokens.read à admin et finance
UPDATE admin_roles
SET permissions = array_append(permissions, 'tokens.read')
WHERE code IN ('admin', 'finance') AND NOT 'tokens.read' = ANY(permissions);
```

### 4. Phase 3 — permissions admins.read / admins.write

```sql
-- Ajouter à admin et super_admin
UPDATE admin_roles
SET permissions = array_append(permissions, 'admins.read')
WHERE code IN ('admin', 'super_admin') AND NOT 'admins.read' = ANY(permissions);

UPDATE admin_roles
SET permissions = array_append(permissions, 'admins.write')
WHERE code IN ('admin', 'super_admin') AND NOT 'admins.write' = ANY(permissions);
```

### État final des rôles

| Rôle         | Permissions                                                                                                    |
|--------------|----------------------------------------------------------------------------------------------------------------|
| super_admin  | `*`, `admins.read`, `admins.write`                                                                             |
| admin        | `users.read`, `users.write`, `subscriptions.read`, `subscriptions.write`, `tokens.write`, `analytics.read`, `tickets.write`, `tokens.read`, `admins.read`, `admins.write` |
| finance      | `subscriptions.read`, `payments.read`, `analytics.read`, `tokens.read`                                        |
| support      | `users.read`, `subscriptions.read`, `tickets.write`                                                            |

---

## Fichiers modifiés / créés

### `lib/supabase/admin.ts`

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

### `app/admin/actions.ts`

> Fichier complet — Server Actions du back-office.

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { createAdminClient, verifyAdminPermission } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { templateMessage } from '@/lib/email/templates'
import {
  PLAN_RANK,
  TRIAL_PLAN_CODE,
  effectivePlan,
  effectiveStatus,
  effectiveTrialDates,
  normalizePlanCode,
  normalizeSubStatus,
  displayName,
  type PlanCode,
  type SubStatus,
} from '@/lib/plans'

function revalidateAdminWrites(targetUserId?: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/users')
  revalidatePath('/admin/subscriptions')
  revalidatePath('/admin/tokens')
  if (targetUserId) revalidatePath('/admin/users/[id]', 'page')
}

export interface KpiMetric {
  current: number | null
  previous: number | null
}

export interface AdminKPIs {
  abonnesActifs: KpiMetric
  abonnesEssai: KpiMetric
  abonnesExpires: KpiMetric
  jetonsVendus: KpiMetric
  jetonsConsommes: KpiMetric
  revenus: KpiMetric
  bcsCount: KpiMetric
  nouveauxInscrits: KpiMetric
  fetchedAt: string
}

function makeAdminClient() {
  return createAdminClient()
}

function sumAmount(rows: { amount: number | null }[] | null): number {
  return rows?.reduce((s, r) => s + Math.abs(r.amount ?? 0), 0) ?? 0
}

function sumColumn<T extends Record<string, unknown>>(rows: T[] | null, col: keyof T): number {
  return rows?.reduce((s, r) => s + Math.abs(Number(r[col] ?? 0)), 0) ?? 0
}

export async function getAdminKPIs(): Promise<AdminKPIs> {
  const db = makeAdminClient()
  const now = new Date()
  const startCurr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const [
    subActive, subTrial,
    subExpCurr, subExpPrev,
    tokBuyCurr, tokBuyPrev,
    tokUseCurr, tokUsePrev,
    revCurr, revPrev,
    bcsCurr, bcsPrev,
    inscritsCurr, inscritsPrev,
  ] = await Promise.all([
    db.from('subscriptions').select('user_id, status').in('status', ['active']),
    db.from('subscriptions').select('user_id, status').in('status', ['trial', 'trialing']),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'expired').gte('current_period_end', startCurr),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'expired').gte('current_period_end', startPrev).lt('current_period_end', startCurr),
    db.from('token_transactions').select('amount').eq('type', 'purchase').gte('created_at', startCurr),
    db.from('token_transactions').select('amount').eq('type', 'purchase').gte('created_at', startPrev).lt('created_at', startCurr),
    db.from('token_transactions').select('amount').eq('type', 'consumption').gte('created_at', startCurr),
    db.from('token_transactions').select('amount').eq('type', 'consumption').gte('created_at', startPrev).lt('created_at', startCurr),
    db.from('invoices').select('montant_ttc').eq('status', 'payee').gte('created_at', startCurr),
    db.from('invoices').select('montant_ttc').eq('status', 'payee').gte('created_at', startPrev).lt('created_at', startCurr),
    db.from('bcs').select('*', { count: 'exact', head: true }).gte('created_at', startCurr),
    db.from('bcs').select('*', { count: 'exact', head: true }).gte('created_at', startPrev).lt('created_at', startCurr),
    db.from('user_accounts').select('*', { count: 'exact', head: true }).gte('created_at', startCurr),
    db.from('user_accounts').select('*', { count: 'exact', head: true }).gte('created_at', startPrev).lt('created_at', startCurr),
  ])

  return {
    abonnesActifs:    { current: subActive.error ? null : new Set((subActive.data ?? []).map((s: { user_id: string }) => s.user_id)).size, previous: null },
    abonnesEssai:     { current: subTrial.error  ? null : new Set((subTrial.data  ?? []).map((s: { user_id: string }) => s.user_id)).size, previous: null },
    abonnesExpires:   { current: subExpCurr.error ? null : (subExpCurr.count ?? 0),  previous: subExpPrev.error ? null : (subExpPrev.count ?? 0) },
    jetonsVendus:     { current: tokBuyCurr.error ? null : sumAmount(tokBuyCurr.data as { amount: number | null }[]), previous: tokBuyPrev.error ? null : sumAmount(tokBuyPrev.data as { amount: number | null }[]) },
    jetonsConsommes:  { current: tokUseCurr.error ? null : sumAmount(tokUseCurr.data as { amount: number | null }[]), previous: tokUsePrev.error ? null : sumAmount(tokUsePrev.data as { amount: number | null }[]) },
    revenus:          { current: revCurr.error ? null : sumColumn(revCurr.data as { montant_ttc: number | null }[], 'montant_ttc'), previous: revPrev.error ? null : sumColumn(revPrev.data as { montant_ttc: number | null }[], 'montant_ttc') },
    bcsCount:         { current: bcsCurr.error ? null : (bcsCurr.count ?? 0),       previous: bcsPrev.error ? null : (bcsPrev.count ?? 0) },
    nouveauxInscrits: { current: inscritsCurr.error ? null : (inscritsCurr.count ?? 0), previous: inscritsPrev.error ? null : (inscritsPrev.count ?? 0) },
    fetchedAt: new Date().toISOString(),
  }
}

export async function checkAdminRole(): Promise<boolean> {
  const check = await verifyAdminPermission()
  return check.authorized
}

// Utilisé par app/page.tsx (client component) pour détecter les admins
export async function checkIsAdmin(): Promise<boolean> {
  const check = await verifyAdminPermission()
  return check.authorized
}

export interface UserRow {
  id: string; email: string; full_name: string; plan: PlanCode; tokens: number
  wallet_balance: number; account_status: string; onboarding_status: string
  created_at: string; sub_status: SubStatus; phone: string | null
}

export interface UserDetail extends UserRow {
  prenom: string | null; nom: string | null; phone: string | null; is_banned: boolean
  last_sign_in_at: string | null; deletion_requested_at: string | null; deletion_scheduled_for: string | null
  profile: { nom_entreprise: string | null; statut_juridique: string | null; telephone: string | null } | null
  subscription: { status: SubStatus; plan: PlanCode | null; started_at: string | null; ended_at: string | null; pending_plan: PlanCode | null; pending_at: string | null } | null
  tokenHistory: { id: string; type: string; amount: number; description: string | null; created_at: string }[]
}

export interface GetUsersParams {
  search?: string; plan?: string; page?: number
  sortBy?: 'created_at' | 'full_name' | 'tokens'; sortDir?: 'asc' | 'desc'
}

type AdminCheck = { adminId: string; permissions: string[] } | { error: string }

async function verifyAdmin(requiredPermission?: string): Promise<AdminCheck> {
  const check = await verifyAdminPermission(requiredPermission)
  if (!check.authorized) return { error: 'Non autorisé.' }
  return { adminId: check.adminId, permissions: check.permissions }
}

async function logAction(adminId: string, action: string, targetUserId: string, details?: Record<string, unknown>) {
  await makeAdminClient().from('admin_logs').insert({ action, admin_id: adminId, target_user_id: targetUserId, details: details ?? null })
}

const PAGE_SIZE = 20

export async function getUsers(params: GetUsersParams = {}): Promise<{ users: UserRow[]; total: number }> {
  const auth = await verifyAdmin('users.read')
  if ('error' in auth) return { users: [], total: 0 }
  // ... (voir fichier complet)
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const auth = await verifyAdmin('users.read')
  if ('error' in auth) return null
  // ... (voir fichier complet)
}

export async function addTokens(targetUserId: string, amount: number, motif: string): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(amount) || amount < 1 || amount > 50) return { success: false, error: 'Montant invalide (1–50).' }
  const auth = await verifyAdmin('tokens.write')
  if ('error' in auth) return { success: false, error: auth.error }
  // ...
}

export async function changePlan(targetUserId: string, newPlan: string, startDate?: string, endDate?: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin('subscriptions.write')
  if ('error' in auth) return { success: false, error: auth.error }
  // ...
}

export async function suspendAccount(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin('users.write')
  if ('error' in auth) return { success: false, error: auth.error }
  // ...
}

export async function reactivateAccount(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin('users.write')
  // ...
}

export async function deleteAccount(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin('users.write')
  // ...
}

export async function cancelUserDeletion(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin('users.write')
  // ...
}

export async function sendAdminEmail(targetUserId: string, subject: string, message: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin('users.write')
  // ...
}

export async function getSubscriptions(params: GetSubsParams = {}): Promise<{ subs: SubscriptionRow[]; total: number }> {
  const auth = await verifyAdmin('subscriptions.read')
  // ...
}

export async function getTokensData(params: GetTokensParams = {}): Promise<{ rows: TokenRow[]; total: number }> {
  const auth = await verifyAdmin('tokens.read')  // ← tokens.read (pas write)
  // ...
}

export async function getTokenHistory(userId: string): Promise<TokenHistoryTx[]> {
  const auth = await verifyAdmin('tokens.read')  // ← tokens.read (pas write)
  // ...
}

export async function changeSubscriptionPlan(userId: string, newPlan: string, startDate?: string, endDate?: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin('subscriptions.write')
  // ...
}
```

---

### `app/api/admin/analytics/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { verifyAdminPermission } from '@/lib/supabase/admin'
import { getAdminAnalytics } from '@/app/admin/analytics-data'

export async function GET() {
  const auth = await verifyAdminPermission('analytics.read')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const data = await getAdminAnalytics()
  return NextResponse.json(data)
}
```

---

### `app/api/admin/kpis/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { verifyAdminPermission } from '@/lib/supabase/admin'
import { getAdminKPIs } from '@/app/admin/actions'

export async function GET() {
  const auth = await verifyAdminPermission('analytics.read')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const kpis = await getAdminKPIs()
  return NextResponse.json(kpis)
}
```

---

### `app/api/admin/send-tokens-email/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { verifyAdminPermission, createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/resend"
import { tokensCreditedEmail } from "@/emails/tokens-credited"

export async function POST(request: NextRequest) {
  const auth = await verifyAdminPermission("tokens.write")
  if (!auth.authorized) return NextResponse.json({ error: "Non autorisé" }, { status: auth.status })

  const adminDb = createAdminClient()
  let body: { user_id?: string; nombre_jetons?: number } = {}
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 })
  }

  const userId = body.user_id?.trim()
  const nombre = Number(body.nombre_jetons)
  if (!userId || !Number.isFinite(nombre) || nombre <= 0) {
    return NextResponse.json({ error: "user_id et nombre_jetons (> 0) requis" }, { status: 400 })
  }

  const { data: account } = await adminDb
    .from("user_accounts").select("email, prenom, nom").eq("id", userId).maybeSingle()

  if (!account?.email) {
    return NextResponse.json({ error: "Utilisateur introuvable ou sans email" }, { status: 404 })
  }

  const { subject, html } = tokensCreditedEmail({
    prenom: (account.prenom || "").trim(),
    nom: (account.nom || "").trim(),
    nombre_jetons: nombre,
  })
  const result = await sendEmail(account.email, subject, html)
  if (!result.success) {
    return NextResponse.json({ error: "Envoi échoué", details: result.error }, { status: 500 })
  }

  return NextResponse.json({ sent: true, to: account.email, nombre_jetons: nombre })
}
```

---

### `app/api/onboarding/welcome/status/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { verifyAdminPermission, createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  const auth = await verifyAdminPermission("users.read")
  if (!auth.authorized) return NextResponse.json({ error: "Non autorisé" }, { status: auth.status })

  const adminDb = createAdminClient()
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase()
  const userId = request.nextUrl.searchParams.get("user_id")?.trim()

  if (!email && !userId) {
    return NextResponse.json({ error: "Paramètre 'email' ou 'user_id' requis" }, { status: 400 })
  }

  const query = adminDb
    .from("user_accounts")
    .select("id, email, prenom, nom, onboarding_status, onboarding_step, welcome_emails_sent_at")

  const { data: account, error } = userId
    ? await query.eq("id", userId).maybeSingle()
    : await query.eq("email", email!).maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!account) return NextResponse.json({ found: false }, { status: 404 })

  return NextResponse.json({
    found: true,
    user_id: account.id,
    email: account.email,
    prenom: account.prenom,
    nom: account.nom,
    onboarding_status: account.onboarding_status,
    onboarding_step: account.onboarding_step,
    welcome_emails_sent_at: account.welcome_emails_sent_at,
    sent: account.welcome_emails_sent_at !== null,
  })
}
```

---

### `app/admin/(protected)/communications/actions.ts`

```typescript
'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email/resend'
import { verifyAdminPermission } from '@/lib/supabase/admin'

export interface Recipient {
  userId: string; email: string; prenom: string; solde?: number
}

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function sendCommunication(
  recipients: Recipient[], subject: string, body: string, segment: string
): Promise<{ sent: number; failed: number }> {
  const auth = await verifyAdminPermission('users.write')
  if (!auth.authorized) throw new Error('Non autorisé')

  let sent = 0, failed = 0

  for (const r of recipients) {
    if (!r.email) { failed++; continue }
    const personalizedBody = body
      .replace(/\{prenom\}/g, r.prenom || 'Abonné')
      .replace(/\{solde\}/g, String(r.solde ?? 0))

    const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;color:#333">
      <p>${personalizedBody.replace(/\n/g, '<br/>')}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="font-size:12px;color:#999">NoX VTC — noreply@noxvtc.fr</p>
    </div>`

    const result = await sendEmail(r.email, subject, html)
    if (result.success) sent++; else failed++
  }

  const supabase = adminClient()
  await supabase.from('communication_logs').insert({
    segment, subject, recipients_count: sent, mode: 'manual',
    status: failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed',
  })

  revalidatePath('/admin/communications')
  return { sent, failed }
}
```

---

### `app/admin/(protected)/support/[id]/actions.ts`

```typescript
'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email/resend'
import { verifyAdminPermission } from '@/lib/supabase/admin'

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const auth = await verifyAdminPermission('tickets.write')
  if (!auth.authorized) throw new Error('Non autorisé')
  const supabase = adminClient()
  const update: Record<string, string> = { status, updated_at: new Date().toISOString() }
  if (status === 'resolved') update.resolved_at = new Date().toISOString()
  const { error } = await supabase.from('support_tickets').update(update).eq('id', ticketId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/support/${ticketId}`)
  revalidatePath('/admin/support')
}

export async function updateTicketPriority(ticketId: string, priority: string) {
  const auth = await verifyAdminPermission('tickets.write')
  if (!auth.authorized) throw new Error('Non autorisé')
  const supabase = adminClient()
  const { error } = await supabase
    .from('support_tickets').update({ priority, updated_at: new Date().toISOString() }).eq('id', ticketId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/support/${ticketId}`)
}

export async function sendAdminReply(ticketId: string, content: string, userEmail: string, subject: string) {
  const auth = await verifyAdminPermission('tickets.write')
  if (!auth.authorized) throw new Error('Non autorisé')
  const supabase = adminClient()

  const { data: ticket, error: fetchError } = await supabase
    .from('support_tickets').select('messages, status').eq('id', ticketId).single()
  if (fetchError || !ticket) throw new Error('Ticket introuvable')

  const newMessage = { role: 'admin', content, created_at: new Date().toISOString() }
  const updatedMessages = [...((ticket.messages as object[]) ?? []), newMessage]
  const update: Record<string, unknown> = { messages: updatedMessages, updated_at: new Date().toISOString() }
  if (ticket.status === 'open') update.status = 'in_progress'

  const { error } = await supabase.from('support_tickets').update(update).eq('id', ticketId)
  if (error) throw new Error(error.message)

  await sendEmail(
    userEmail,
    `Réponse à votre demande de support : ${subject}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
      <p>Bonjour,</p>
      <p>Votre demande de support concernant <strong>${subject}</strong> a reçu une réponse :</p>
      <blockquote style="border-left:3px solid #C5A059;padding:12px 16px;background:#fafafa;color:#333;margin:16px 0">
        ${content.replace(/\n/g, '<br/>')}
      </blockquote>
      <p>Vous pouvez consulter votre ticket depuis votre espace client.</p>
      <p style="color:#666">Cordialement,<br/>L'équipe NoX VTC</p>
    </div>`
  )

  revalidatePath(`/admin/support/${ticketId}`)
  revalidatePath('/admin/support')
}
```

---

### `emails/admin-invitation.tsx` *(nouveau)*

```typescript
type AdminInvitationProps = {
  prenom: string
  nom: string
  roleLabel: string
  roleDescription: string
  invitedByEmail: string
  inviteLink: string
}

export function adminInvitationEmail({
  prenom, nom, roleLabel, roleDescription, invitedByEmail, inviteLink,
}: AdminInvitationProps): { subject: string; html: string } {
  const firstName = prenom.trim() || 'Collaborateur'
  const fullName = [prenom, nom].filter(Boolean).join(' ').trim() || firstName
  const subject = `Invitation Back-Office NoX VTC — Rôle ${roleLabel}`

  const html = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#0F0F0F;color:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0F0F0F;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#1A1A1A;border:1px solid #333;border-radius:16px;padding:32px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="font-family:Georgia,serif;font-size:48px;color:#C9A84C;line-height:1;">N</div>
                <div style="font-size:11px;letter-spacing:0.2em;color:#8B6914;margin-top:4px;">NoX VTC</div>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:20px;">
                <div style="background:#252525;border:1px solid #3A3A3A;border-radius:10px;padding:14px 18px;display:inline-block;width:100%;box-sizing:border-box;">
                  <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8B6914;">Rôle attribué</span>
                  <div style="font-size:16px;font-weight:600;color:#C9A84C;margin-top:4px;">${roleLabel}</div>
                  <div style="font-size:12px;color:#A1A1AA;margin-top:2px;">${roleDescription}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="color:#F5F5F5;font-size:15px;line-height:1.7;">
                <p style="margin:0 0 14px;">Bonjour ${fullName},</p>
                <p style="margin:0 0 14px;">Vous avez été invité(e) à rejoindre le back-office NoX VTC par <strong style="color:#C9A84C;">${invitedByEmail}</strong>.</p>
                <p style="margin:0 0 20px;">Cliquez sur le bouton ci-dessous pour définir votre mot de passe et activer votre accès. Ce lien est valable 24 heures.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:4px 0 28px;">
                <a href="${inviteLink}" style="display:inline-block;background:#C9A84C;color:#0F0F0F;text-decoration:none;font-weight:700;font-size:14px;padding:13px 28px;border-radius:12px;letter-spacing:0.02em;">Activer mon accès →</a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #2A2A2A;padding-top:20px;">
                <p style="margin:0 0 8px;font-size:12px;color:#6B6B6B;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
                <p style="margin:0;font-size:12px;color:#6B6B6B;">Lien valable 24h — <a href="mailto:support@noxvtc.fr" style="color:#C9A84C;text-decoration:none;">support@noxvtc.fr</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, html }
}
```

---

### `app/admin/(protected)/team/actions.ts` *(nouveau)*

```typescript
'use server'

import { createClient as createSbClient } from '@supabase/supabase-js'
import { createAdminClient, verifyAdminPermission } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { adminInvitationEmail } from '@/emails/admin-invitation'
import { revalidatePath } from 'next/cache'

export interface AdminMember {
  id: string; userId: string; email: string
  prenom: string | null; nom: string | null
  roleId: string; roleCode: string; permissions: string[]
  assignedAt: string; lastSignIn: string | null
}

export interface AdminRole {
  id: string; code: string; name: string; permissions: string[]
}

export const ROLE_CONFIG: Record<string, { label: string; description: string; color: string }> = {
  super_admin: { label: 'Super Admin',   description: 'Accès total à toutes les fonctionnalités du back-office',                               color: '#a855f7' },
  admin:       { label: 'Admin',         description: 'Gestion complète — utilisateurs, abonnements, jetons, analytics, tickets',               color: '#C9A84C' },
  support:     { label: 'Support',       description: 'Consultation des utilisateurs et abonnements, gestion des tickets',                       color: '#3b82f6' },
  finance:     { label: 'Finance',       description: 'Consultation des abonnements, paiements et analytics',                                    color: '#22c55e' },
}

export async function getAdminRoles(): Promise<AdminRole[]> {
  const db = createAdminClient()
  const { data } = await db.from('admin_roles').select('id, code, name, permissions').order('code')
  return (data ?? []) as AdminRole[]
}

export async function getAdminTeam(): Promise<{ members: AdminMember[]; roles: AdminRole[] }> {
  const auth = await verifyAdminPermission('admins.read')
  if (!auth.authorized) return { members: [], roles: [] }

  const db = createAdminClient()
  const sbAdmin = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: userRoles } = await db
    .from('user_roles')
    .select('id, user_id, admin_role_id, assigned_at, admin_roles!admin_role_id(id, code, name, permissions)')
    .order('assigned_at', { ascending: false })

  if (!userRoles?.length) {
    const roles = await getAdminRoles()
    return { members: [], roles }
  }

  const userIds = (userRoles as { user_id: string }[]).map(r => r.user_id)
  const [{ data: accounts }, ...authResults] = await Promise.all([
    db.from('user_accounts').select('id, email, prenom, nom').in('id', userIds),
    ...userIds.map(id => sbAdmin.auth.admin.getUserById(id)),
  ])

  const accountMap: Record<string, { email: string; prenom: string | null; nom: string | null }> = {}
  for (const a of (accounts ?? []) as { id: string; email: string; prenom: string | null; nom: string | null }[]) {
    accountMap[a.id] = a
  }

  const authMap: Record<string, { last_sign_in_at: string | null }> = {}
  for (const r of authResults) {
    const u = (r as { data?: { user?: { id: string; last_sign_in_at?: string } } }).data?.user
    if (u?.id) authMap[u.id] = { last_sign_in_at: u.last_sign_in_at ?? null }
  }

  const members: AdminMember[] = (userRoles as {
    id: string; user_id: string; admin_role_id: string; assigned_at: string
    admin_roles: { id: string; code: string; permissions: string[] } | null
  }[]).map(r => {
    const acc = accountMap[r.user_id]
    const auth = authMap[r.user_id]
    const roleInfo = r.admin_roles
    return {
      id: r.id, userId: r.user_id,
      email: acc?.email ?? '', prenom: acc?.prenom ?? null, nom: acc?.nom ?? null,
      roleId: r.admin_role_id, roleCode: roleInfo?.code ?? '',
      permissions: roleInfo?.permissions ?? [],
      assignedAt: r.assigned_at, lastSignIn: auth?.last_sign_in_at ?? null,
    }
  })

  const roles = await getAdminRoles()
  return { members, roles }
}

export async function createAdminMember(
  email: string, prenom: string, nom: string, roleId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminPermission('admins.write')
  if (!auth.authorized) return { success: false, error: 'Non autorisé.' }

  const db = createAdminClient()
  const sbAdmin = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Guard : seul super_admin peut créer un super_admin
  const { data: targetRole } = await db.from('admin_roles').select('code').eq('id', roleId).single()
  if (targetRole?.code === 'super_admin' && !auth.permissions.includes('*')) {
    return { success: false, error: 'Seul un super_admin peut attribuer le rôle super_admin.' }
  }

  const { data: inviterAcc } = await db.from('user_accounts').select('email').eq('id', auth.adminId).maybeSingle()
  const invitedByEmail = (inviterAcc as { email: string } | null)?.email ?? auth.adminId
  const fullName = [prenom, nom].filter(Boolean).join(' ').trim()

  // Génération du lien d'invitation (crée le user dans auth.users, n'envoie PAS d'email)
  const { data: linkData, error: linkError } = await sbAdmin.auth.admin.generateLink({
    type: 'invite', email,
    options: {
      data: { full_name: fullName || undefined },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=invite`,
    },
  })

  if (linkError || !linkData) {
    return { success: false, error: linkError?.message ?? 'Erreur lors de la génération du lien.' }
  }

  const userId = linkData.user.id
  const inviteLink = linkData.properties.action_link

  // Forcer onboarding_status='completed' — évite la redirection onboarding chauffeur
  await Promise.all([
    db.from('user_accounts').upsert(
      { id: userId, email, full_name: fullName || null, prenom: prenom || null, nom: nom || null,
        plan: 'SOLO', tokens: 0, onboarding_status: 'completed', onboarding_step: 99, account_status: 'active' },
      { onConflict: 'id' }
    ),
    db.from('profiles').upsert(
      { user_id: userId, email, onboarding_status: 'completed' },
      { onConflict: 'user_id' }
    ),
  ])

  const { error: roleError } = await db.from('user_roles').insert({
    user_id: userId, admin_role_id: roleId, assigned_by: auth.adminId,
  })
  if (roleError) return { success: false, error: `Erreur attribution rôle : ${roleError.message}` }

  await db.from('admin_logs').insert({
    admin_id: auth.adminId, action: 'create_admin', target_user_id: userId,
    new_values: { email, role_id: roleId, role_code: targetRole?.code },
  })

  const roleConf = ROLE_CONFIG[targetRole?.code ?? '']
  const { subject, html } = adminInvitationEmail({
    prenom: prenom || email.split('@')[0], nom: nom || '',
    roleLabel: roleConf?.label ?? targetRole?.code ?? '',
    roleDescription: roleConf?.description ?? '',
    invitedByEmail, inviteLink,
  })
  await sendEmail(email, subject, html)

  revalidatePath('/admin/team')
  return { success: true }
}

export async function updateMemberRole(
  userRoleId: string, newRoleId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminPermission('admins.write')
  if (!auth.authorized) return { success: false, error: 'Non autorisé.' }

  const db = createAdminClient()

  const { data: newRole } = await db.from('admin_roles').select('code').eq('id', newRoleId).single()
  if (newRole?.code === 'super_admin' && !auth.permissions.includes('*')) {
    return { success: false, error: 'Seul un super_admin peut attribuer le rôle super_admin.' }
  }

  const { data: existing } = await db
    .from('user_roles').select('user_id, admin_role_id, admin_roles!admin_role_id(code)').eq('id', userRoleId).single()
  const existingCode = (existing as { admin_roles: { code: string } | null } | null)?.admin_roles?.code
  if (existingCode === 'super_admin' && !auth.permissions.includes('*')) {
    return { success: false, error: 'Seul un super_admin peut modifier un compte super_admin.' }
  }

  const { error } = await db.from('user_roles').update({ admin_role_id: newRoleId }).eq('id', userRoleId)
  if (error) return { success: false, error: error.message }

  const targetUserId = (existing as { user_id: string } | null)?.user_id
  if (targetUserId) {
    await db.from('admin_logs').insert({
      admin_id: auth.adminId, action: 'update_admin_role', target_user_id: targetUserId,
      new_values: { old_role_code: existingCode, new_role_id: newRoleId, new_role_code: newRole?.code },
    })
  }

  revalidatePath('/admin/team')
  return { success: true }
}

export async function revokeAdminMember(
  userRoleId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdminPermission('admins.write')
  if (!auth.authorized) return { success: false, error: 'Non autorisé.' }

  const db = createAdminClient()

  const { data: existing } = await db
    .from('user_roles').select('user_id, admin_roles!admin_role_id(code)').eq('id', userRoleId).single()
  const existingCode = (existing as { admin_roles: { code: string } | null } | null)?.admin_roles?.code

  if (existingCode === 'super_admin' && !auth.permissions.includes('*')) {
    return { success: false, error: 'Seul un super_admin peut révoquer un compte super_admin.' }
  }

  const { error } = await db.from('user_roles').delete().eq('id', userRoleId)
  if (error) return { success: false, error: error.message }

  const targetUserId = (existing as { user_id: string } | null)?.user_id
  if (targetUserId) {
    await db.from('admin_logs').insert({
      admin_id: auth.adminId, action: 'revoke_admin', target_user_id: targetUserId,
      new_values: { revoked_role_code: existingCode },
    })
  }

  revalidatePath('/admin/team')
  return { success: true }
}
```

---

### `app/admin/(protected)/team/page.tsx` *(nouveau)*

```typescript
import { verifyAdminPermission } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TeamClient } from './_components/team-client'

export default async function TeamPage() {
  const auth = await verifyAdminPermission('admins.read')
  if (!auth.authorized) redirect('/admin/dashboard')

  const isSuperAdmin = auth.permissions.includes('*')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-foreground)' }}>
          Équipe Admin
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
          Gestion des accès au back-office NoX VTC
        </p>
      </div>
      <TeamClient isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
```

---

### `app/admin/(protected)/team/_components/team-client.tsx` *(nouveau)*

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, ShieldOff, UserCog, X, AlertTriangle, Shield } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAdminTeam, createAdminMember, updateMemberRole, revokeAdminMember,
  ROLE_CONFIG, type AdminMember, type AdminRole,
} from '../actions'

type Modal =
  | null
  | { type: 'create' }
  | { type: 'changeRole'; member: AdminMember }
  | { type: 'revoke'; member: AdminMember }

function RoleBadge({ code }: { code: string }) {
  const conf = ROLE_CONFIG[code]
  const color = conf?.color ?? '#A1A1AA'
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <Shield size={10} />
      {conf?.label ?? code}
    </span>
  )
}

function Skeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {[200, 140, 110, 110, 130].map((w, j) => (
            <td key={j} className="py-3 px-4">
              <div className="h-4 rounded" style={{ width: w, backgroundColor: 'var(--admin-border)' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function RoleSelect({
  roles, value, onChange, isSuperAdmin,
}: { roles: AdminRole[]; value: string; onChange: (v: string) => void; isSuperAdmin: boolean }) {
  const sorted = [...roles].sort((a, b) => {
    const order = ['super_admin', 'admin', 'support', 'finance']
    return order.indexOf(a.code) - order.indexOf(b.code)
  })
  return (
    <div className="space-y-2">
      {sorted.map(r => {
        const conf = ROLE_CONFIG[r.code]
        const blocked = r.code === 'super_admin' && !isSuperAdmin
        return (
          <label
            key={r.id}
            className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
            style={{
              border: value === r.id ? `1px solid ${conf?.color ?? '#555'}` : '1px solid var(--admin-border)',
              backgroundColor: blocked ? 'transparent' : value === r.id ? `${conf?.color ?? '#555'}11` : 'transparent',
              opacity: blocked ? 0.4 : 1,
              cursor: blocked ? 'not-allowed' : 'pointer',
            }}
          >
            <input type="radio" name="role" value={r.id} checked={value === r.id}
              disabled={blocked} onChange={() => !blocked && onChange(r.id)} className="mt-1 shrink-0" />
            <div>
              <div className="text-sm font-semibold" style={{ color: conf?.color ?? 'var(--admin-foreground)' }}>
                {conf?.label ?? r.code}
                {r.code === 'super_admin' && !isSuperAdmin && (
                  <span className="ml-2 text-[10px] font-normal" style={{ color: 'var(--admin-muted-foreground)' }}>
                    (réservé aux super_admin)
                  </span>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--admin-muted-foreground)' }}>
                {conf?.description ?? ''}
              </div>
            </div>
          </label>
        )
      })}
    </div>
  )
}

function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-xl border shadow-2xl" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--admin-foreground)' }}>{title}</h3>
          <button onClick={onClose} style={{ color: 'var(--admin-muted-foreground)' }}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function TeamClient({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [members, setMembers] = useState<AdminMember[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [saving, setSaving] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPrenom, setCreatePrenom] = useState('')
  const [createNom, setCreateNom] = useState('')
  const [createRoleId, setCreateRoleId] = useState('')
  const [changeRoleId, setChangeRoleId] = useState('')

  const fetchTeam = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const res = await getAdminTeam()
      setMembers(res.members); setRoles(res.roles)
      if (!createRoleId && res.roles.length > 0) {
        const adminRole = res.roles.find(r => r.code === 'admin')
        setCreateRoleId(adminRole?.id ?? res.roles[0].id)
      }
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTeam() }, [fetchTeam])

  function openCreate() {
    setCreateEmail(''); setCreatePrenom(''); setCreateNom('')
    const adminRole = roles.find(r => r.code === 'admin')
    setCreateRoleId(adminRole?.id ?? roles[0]?.id ?? '')
    setModal({ type: 'create' })
  }

  async function handleCreate() {
    if (!createEmail.trim() || !createRoleId) return
    setSaving(true)
    const res = await createAdminMember(createEmail.trim(), createPrenom.trim(), createNom.trim(), createRoleId)
    setSaving(false)
    if (!res.success) { toast.error(res.error ?? 'Erreur'); return }
    toast.success('Invitation envoyée'); setModal(null); fetchTeam()
  }

  async function handleChangeRole() {
    if (modal?.type !== 'changeRole') return
    setSaving(true)
    const res = await updateMemberRole(modal.member.id, changeRoleId)
    setSaving(false)
    if (!res.success) { toast.error(res.error ?? 'Erreur'); return }
    toast.success('Rôle mis à jour'); setModal(null); fetchTeam()
  }

  async function handleRevoke() {
    if (modal?.type !== 'revoke') return
    setSaving(true)
    const res = await revokeAdminMember(modal.member.id)
    setSaving(false)
    if (!res.success) { toast.error(res.error ?? 'Erreur'); return }
    toast.success('Accès révoqué'); setModal(null); fetchTeam()
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>
          {loading ? '…' : `${members.length} compte${members.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex gap-2">
          <button onClick={fetchTeam} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border"
            style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>
            <RefreshCw size={14} /> Actualiser
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}>
            <Plus size={15} /> Créer un accès
          </button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--admin-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--admin-border)', backgroundColor: 'var(--admin-card)' }}>
              {['Email', 'Prénom / Nom', 'Rôle', 'Attribué le', 'Dernière connexion', ''].map(h => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--admin-muted-foreground)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <Skeleton /> : error ? (
              <tr><td colSpan={6} className="py-8 text-center text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>Erreur de chargement</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>Aucun compte admin</td></tr>
            ) : members.map(m => (
              <tr key={m.id} style={{ borderTop: '1px solid var(--admin-border)' }}>
                <td className="py-3 px-4 font-medium" style={{ color: 'var(--admin-foreground)' }}>{m.email}</td>
                <td className="py-3 px-4" style={{ color: 'var(--admin-muted-foreground)' }}>
                  {[m.prenom, m.nom].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="py-3 px-4"><RoleBadge code={m.roleCode} /></td>
                <td className="py-3 px-4 text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{formatDate(m.assignedAt)}</td>
                <td className="py-3 px-4 text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{formatDate(m.lastSignIn)}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setChangeRoleId(m.roleId); setModal({ type: 'changeRole', member: m }) }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border"
                      style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>
                      <UserCog size={12} /> Rôle
                    </button>
                    <button onClick={() => setModal({ type: 'revoke', member: m })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                      style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                      <ShieldOff size={12} /> Révoquer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal?.type === 'create' && (
        <ModalWrapper title="Créer un accès admin" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-muted-foreground)' }}>
                Email <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)}
                placeholder="prenom.nom@example.com" className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--admin-background)', border: '1px solid var(--admin-border)', color: 'var(--admin-foreground)' }} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-muted-foreground)' }}>Prénom</label>
                <input type="text" value={createPrenom} onChange={e => setCreatePrenom(e.target.value)} placeholder="Prénom"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--admin-background)', border: '1px solid var(--admin-border)', color: 'var(--admin-foreground)' }} />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-muted-foreground)' }}>Nom</label>
                <input type="text" value={createNom} onChange={e => setCreateNom(e.target.value)} placeholder="Nom"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--admin-background)', border: '1px solid var(--admin-border)', color: 'var(--admin-foreground)' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--admin-muted-foreground)' }}>Rôle</label>
              <RoleSelect roles={roles} value={createRoleId} onChange={setCreateRoleId} isSuperAdmin={isSuperAdmin} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>Annuler</button>
              <button onClick={handleCreate} disabled={saving || !createEmail.trim() || !createRoleId}
                className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}>
                {saving ? 'Envoi…' : "Créer et envoyer l'invitation"}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {modal?.type === 'changeRole' && (
        <ModalWrapper title={`Modifier le rôle — ${modal.member.email}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <RoleSelect roles={roles} value={changeRoleId} onChange={setChangeRoleId} isSuperAdmin={isSuperAdmin} />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>Annuler</button>
              <button onClick={handleChangeRole} disabled={saving || changeRoleId === modal.member.roleId}
                className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}>
                {saving ? 'Enregistrement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {modal?.type === 'revoke' && (
        <ModalWrapper title="Révoquer l'accès admin" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <div className="text-sm" style={{ color: 'var(--admin-foreground)' }}>
                <p className="font-semibold">Vous allez révoquer l'accès de :</p>
                <p className="mt-1" style={{ color: '#ef4444' }}>{modal.member.email}</p>
                <p className="mt-2 text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
                  Le compte auth n'est pas supprimé — seul l'accès admin est retiré. Effet immédiat à la prochaine requête.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>Annuler</button>
              <button onClick={handleRevoke} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}>
                {saving ? 'Révocation…' : 'Confirmer la révocation'}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}
    </>
  )
}
```

---

### `app/admin/(protected)/_components/admin-shell.tsx` *(modifié)*

Ajouts par rapport à la version précédente :

```typescript
// Import ajouté
import { ShieldCheck } from 'lucide-react'

// Dans navItems[]
{ href: '/admin/team', label: 'Équipe', icon: ShieldCheck },

// Dans pageTitles{}
'/admin/team': 'Équipe Admin',
```

---

### `app/page.tsx` *(modifié — ÉTAPE 4)*

Ajout dans `checkSession()`, après `if (!user)` et avant la lecture de `onboarding_status` :

```typescript
// Ajout en début de fichier (déjà présent après Phase 3)
import { checkIsAdmin } from "@/app/admin/actions"

// Dans checkSession(), après if (!user) { router.replace("/login"); return }
const isAdmin = await checkIsAdmin()
if (isAdmin) {
  router.replace("/admin/dashboard")
  return
}
```

---

### `app/auth/callback/route.ts` *(modifié — ÉTAPE 4)*

Ajout après le bloc `type === 'signup'` et avant la lecture de `user_accounts.onboarding_status` :

```typescript
// Admin bypass → back-office directement, jamais onboarding chauffeur
const { data: adminRole } = await adminClient
  .from('user_roles')
  .select('id')
  .eq('user_id', userId)
  .limit(1)
  .maybeSingle()
if (adminRole) {
  const redirectUrl = new URL('/admin/dashboard', siteUrl).toString()
  console.log('[callback] admin détecté, redirect vers:', redirectUrl)
  return NextResponse.redirect(redirectUrl)
}
```

---

## Résumé des permissions par action

| Action / Route                         | Permission requise    |
|----------------------------------------|-----------------------|
| `getUsers`, `getUserDetail`            | `users.read`          |
| `suspendAccount`, `reactivateAccount`, `deleteAccount`, `cancelUserDeletion`, `sendAdminEmail` | `users.write` |
| `getSubscriptions`                     | `subscriptions.read`  |
| `changePlan`, `changeSubscriptionPlan` | `subscriptions.write` |
| `getTokensData`, `getTokenHistory`     | `tokens.read`         |
| `addTokens`                            | `tokens.write`        |
| `GET /api/admin/analytics`             | `analytics.read`      |
| `GET /api/admin/kpis`                  | `analytics.read`      |
| `POST /api/admin/send-tokens-email`    | `tokens.write`        |
| `GET /api/onboarding/welcome/status`   | `users.read`          |
| `sendCommunication`                    | `users.write`         |
| `updateTicketStatus`, `updateTicketPriority`, `sendAdminReply` | `tickets.write` |
| `getAdminTeam`                         | `admins.read`         |
| `createAdminMember`, `updateMemberRole`, `revokeAdminMember` | `admins.write` |

## Note technique — cast TypeScript PostgREST

PostgREST infère le résultat d'un join many-to-one (FK) comme un tableau dans le type générique de `supabase-js`, alors que la valeur réelle est un objet. Solution :

```typescript
const raw = roleData as unknown as { admin_roles: { permissions: string[] } | null }
const permissions: string[] = raw.admin_roles?.permissions ?? []
```

## Déploiement

```bash
pm2 stop nox-vtc && pm2 start nox-vtc && pm2 save
```

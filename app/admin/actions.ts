'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// ─── Types KPI ───────────────────────────────────────────────────────────────

export interface KpiMetric {
  current: number | null  // null = table inexistante ou erreur
  previous: number | null // null = pas de comparaison disponible
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

function sumAmount(rows: { amount: number | null }[] | null): number {
  return rows?.reduce((s, r) => s + Math.abs(r.amount ?? 0), 0) ?? 0
}

// ─── Server Action principale ─────────────────────────────────────────────────

export async function getAdminKPIs(): Promise<AdminKPIs> {
  const db = makeAdminClient()

  const now = new Date()
  const startCurr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const [
    // 1. Abonnés actifs (point-in-time — pas de variation historique)
    subActive,
    // 2. Abonnés en essai
    subTrial,
    // 3. Abonnements expirés — mois courant / mois précédent
    subExpCurr,
    subExpPrev,
    // 4. Jetons vendus — mois courant / précédent
    tokBuyCurr,
    tokBuyPrev,
    // 5. Jetons consommés — mois courant / précédent
    tokUseCurr,
    tokUsePrev,
    // 6. Revenus (invoices status=paid) — mois courant / précédent
    revCurr,
    revPrev,
    // 7. BCs générés — mois courant / précédent
    bcsCurr,
    bcsPrev,
    // 8. Nouveaux inscrits (user_accounts) — mois courant / précédent
    inscritsCurr,
    inscritsPrev,
  ] = await Promise.all([
    // 1
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    // 2
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'trialing'),
    // 3 courant
    db.from('subscriptions').select('*', { count: 'exact', head: true })
      .eq('status', 'expired').gte('ended_at', startCurr),
    // 3 précédent
    db.from('subscriptions').select('*', { count: 'exact', head: true })
      .eq('status', 'expired').gte('ended_at', startPrev).lt('ended_at', startCurr),
    // 4 courant
    db.from('token_transactions').select('amount')
      .eq('type', 'purchase').gte('created_at', startCurr),
    // 4 précédent
    db.from('token_transactions').select('amount')
      .eq('type', 'purchase').gte('created_at', startPrev).lt('created_at', startCurr),
    // 5 courant
    db.from('token_transactions').select('amount')
      .eq('type', 'consumption').gte('created_at', startCurr),
    // 5 précédent
    db.from('token_transactions').select('amount')
      .eq('type', 'consumption').gte('created_at', startPrev).lt('created_at', startCurr),
    // 6 courant
    db.from('invoices').select('amount')
      .eq('status', 'paid').gte('created_at', startCurr),
    // 6 précédent
    db.from('invoices').select('amount')
      .eq('status', 'paid').gte('created_at', startPrev).lt('created_at', startCurr),
    // 7 courant
    db.from('bcs').select('*', { count: 'exact', head: true }).gte('created_at', startCurr),
    // 7 précédent
    db.from('bcs').select('*', { count: 'exact', head: true })
      .gte('created_at', startPrev).lt('created_at', startCurr),
    // 8 courant
    db.from('user_accounts').select('*', { count: 'exact', head: true }).gte('created_at', startCurr),
    // 8 précédent
    db.from('user_accounts').select('*', { count: 'exact', head: true })
      .gte('created_at', startPrev).lt('created_at', startCurr),
  ])

  return {
    abonnesActifs:   { current: subActive.error   ? null : (subActive.count   ?? 0), previous: null },
    abonnesEssai:    { current: subTrial.error    ? null : (subTrial.count    ?? 0), previous: null },
    abonnesExpires:  {
      current:  subExpCurr.error ? null : (subExpCurr.count ?? 0),
      previous: subExpPrev.error ? null : (subExpPrev.count ?? 0),
    },
    jetonsVendus:    {
      current:  tokBuyCurr.error ? null : sumAmount(tokBuyCurr.data as { amount: number | null }[]),
      previous: tokBuyPrev.error ? null : sumAmount(tokBuyPrev.data as { amount: number | null }[]),
    },
    jetonsConsommes: {
      current:  tokUseCurr.error ? null : sumAmount(tokUseCurr.data as { amount: number | null }[]),
      previous: tokUsePrev.error ? null : sumAmount(tokUsePrev.data as { amount: number | null }[]),
    },
    revenus: {
      current:  revCurr.error ? null : sumAmount(revCurr.data as { amount: number | null }[]),
      previous: revPrev.error ? null : sumAmount(revPrev.data as { amount: number | null }[]),
    },
    bcsCount: {
      current:  bcsCurr.error ? null : (bcsCurr.count ?? 0),
      previous: bcsPrev.error ? null : (bcsPrev.count ?? 0),
    },
    nouveauxInscrits: {
      current:  inscritsCurr.error ? null : (inscritsCurr.count ?? 0),
      previous: inscritsPrev.error ? null : (inscritsPrev.count ?? 0),
    },
    fetchedAt: new Date().toISOString(),
  }
}

export async function checkAdminRole(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log('[checkAdminRole] UID récupéré:', user?.id ?? 'null (non authentifié)')

  if (!user) return false

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const { data: adminRoles } = await supabaseAdmin
    .from('admin_roles')
    .select('id')
    .in('code', ['admin', 'super_admin'])

  if (!adminRoles?.length) return false

  const adminRoleIds = adminRoles.map((r: { id: string }) => r.id)

  const { data: userRole, error: userRoleError } = await supabaseAdmin
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .in('admin_role_id', adminRoleIds)
    .limit(1)
    .maybeSingle()

  console.log('[checkAdminRole] Résultat requête user_roles:', { userRole, error: userRoleError })

  return !!userRole
}

// ═══════════════════════════════════════════════════════════════════════════════
// Gestion des utilisateurs
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserRow {
  id: string
  email: string
  full_name: string | null
  plan: string
  tokens: number
  onboarding_status: string
  created_at: string
  sub_status: string | null
}

export interface UserDetail extends UserRow {
  prenom: string | null
  nom: string | null
  phone: string | null
  profile: { nom_entreprise: string | null; statut_juridique: string | null; telephone: string | null } | null
  subscription: { status: string; plan: string | null; started_at: string | null; ended_at: string | null } | null
  tokenHistory: { id: string; type: string; amount: number; description: string | null; created_at: string }[]
}

export interface GetUsersParams {
  search?: string
  plan?: string
  page?: number
  sortBy?: 'created_at' | 'full_name' | 'tokens'
  sortDir?: 'asc' | 'desc'
}

type AdminCheck = { adminId: string } | { error: string }

async function verifyAdmin(): Promise<AdminCheck> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autorisé.' }

  const db = makeAdminClient()
  const { data: roles } = await db.from('admin_roles').select('id').in('code', ['admin', 'super_admin'])
  if (!roles?.length) return { error: 'Non autorisé.' }

  const ids = (roles as { id: string }[]).map(r => r.id)
  const { data: role } = await db.from('user_roles').select('id').eq('user_id', user.id).in('admin_role_id', ids).limit(1).maybeSingle()
  if (!role) return { error: 'Non autorisé.' }
  return { adminId: user.id }
}

async function logAction(adminId: string, action: string, targetUserId: string, details?: Record<string, unknown>) {
  await makeAdminClient().from('admin_logs').insert({ action, admin_id: adminId, target_user_id: targetUserId, details: details ?? null })
}

const PAGE_SIZE = 20

export async function getUsers(params: GetUsersParams = {}): Promise<{ users: UserRow[]; total: number }> {
  const auth = await verifyAdmin()
  if ('error' in auth) return { users: [], total: 0 }

  const db = makeAdminClient()
  const { search = '', plan = 'all', page = 0, sortBy = 'created_at', sortDir = 'desc' } = params

  let query = db
    .from('user_accounts')
    .select('id, email, full_name, plan, tokens, onboarding_status, created_at', { count: 'exact' })

  if (search.trim()) {
    const s = search.trim().replace(/[%_\\]/g, c => `\\${c}`)
    query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%`)
  }
  if (plan !== 'all') query = query.eq('plan', plan)
  query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  const { data, count, error } = await query
  if (error || !data) return { users: [], total: 0 }

  const ids = (data as UserRow[]).map(u => u.id)
  let subMap: Record<string, string> = {}
  if (ids.length) {
    const { data: subs } = await db.from('subscriptions').select('user_id, status').in('user_id', ids)
    if (subs) for (const s of subs as { user_id: string; status: string }[]) subMap[s.user_id] = s.status
  }

  return {
    users: (data as UserRow[]).map(u => ({ ...u, sub_status: subMap[u.id] ?? null })),
    total: count ?? 0,
  }
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const auth = await verifyAdmin()
  if ('error' in auth) return null

  const db = makeAdminClient()
  const [accRes, profRes, subRes, txRes] = await Promise.all([
    db.from('user_accounts').select('id, email, full_name, plan, tokens, onboarding_status, phone, prenom, nom, created_at').eq('id', userId).single(),
    db.from('profiles').select('nom_entreprise, statut_juridique, telephone').eq('user_id', userId).maybeSingle(),
    db.from('subscriptions').select('status, plan, started_at, ended_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('token_transactions').select('id, type, amount, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ])

  if (accRes.error || !accRes.data) return null
  const acc = accRes.data as UserRow & { prenom: string | null; nom: string | null; phone: string | null }

  return {
    ...acc,
    sub_status: (subRes.data as { status: string } | null)?.status ?? null,
    profile: profRes.data as UserDetail['profile'],
    subscription: subRes.data as UserDetail['subscription'],
    tokenHistory: txRes.error ? [] : (txRes.data as UserDetail['tokenHistory']) ?? [],
  }
}

export async function addTokens(targetUserId: string, amount: number, motif: string): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000) return { success: false, error: 'Montant invalide (1–10 000).' }
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const db = makeAdminClient()
  const { data: acc, error: fe } = await db.from('user_accounts').select('tokens').eq('id', targetUserId).single()
  if (fe || !acc) return { success: false, error: 'Utilisateur introuvable.' }

  const { error: ue } = await db.from('user_accounts')
    .update({ tokens: (acc as { tokens: number }).tokens + amount, updated_at: new Date().toISOString() })
    .eq('id', targetUserId)
  if (ue) return { success: false, error: 'Erreur lors de la mise à jour.' }

  await logAction(auth.adminId, 'add_tokens', targetUserId, { amount, motif })
  return { success: true }
}

export async function changePlan(targetUserId: string, newPlan: string): Promise<{ success: boolean; error?: string }> {
  if (!['SOLO', 'TEAM', 'ENTERPRISE'].includes(newPlan)) return { success: false, error: 'Plan invalide.' }
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const { error } = await makeAdminClient().from('user_accounts')
    .update({ plan: newPlan, updated_at: new Date().toISOString() })
    .eq('id', targetUserId)
  if (error) return { success: false, error: 'Erreur lors de la mise à jour.' }

  await logAction(auth.adminId, 'change_plan', targetUserId, { new_plan: newPlan })
  return { success: true }
}

export async function suspendAccount(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const { error } = await createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ).auth.admin.updateUserById(targetUserId, { ban_duration: '876000h' })
  if (error) return { success: false, error: 'Erreur lors de la suspension.' }

  await logAction(auth.adminId, 'suspend_account', targetUserId)
  return { success: true }
}

export async function sendAdminEmail(targetUserId: string, subject: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!subject.trim() || !message.trim()) return { success: false, error: 'Sujet et message requis.' }
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  await logAction(auth.adminId, 'send_email', targetUserId, { subject, message })
  return { success: true }
}

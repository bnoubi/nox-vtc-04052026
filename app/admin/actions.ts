'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const PLAN_RANK: Record<string, number> = { SOLO: 1, DUO: 2, TEAM: 3, ENTERPRISE: 4 }

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
    // 1. Abonnés actifs — user_ids distincts avec subscription active
    subActive,
    // 2. Abonnés en essai — user_ids distincts
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
    db.from('subscriptions').select('user_id').eq('status', 'active'),
    // 2
    db.from('subscriptions').select('user_id').eq('status', 'trialing'),
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
    abonnesActifs: {
      current: subActive.error ? null : new Set((subActive.data ?? []).map((s: { user_id: string }) => s.user_id)).size,
      previous: null,
    },
    abonnesEssai: {
      current: subTrial.error ? null : new Set((subTrial.data ?? []).map((s: { user_id: string }) => s.user_id)).size,
      previous: null,
    },
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
  wallet_balance: number | null
  account_status: string
  onboarding_status: string
  created_at: string
  sub_status: string | null
  phone: string | null
}

export interface UserDetail extends UserRow {
  prenom: string | null
  nom: string | null
  phone: string | null
  is_banned: boolean
  last_sign_in_at: string | null
  profile: { nom_entreprise: string | null; statut_juridique: string | null; telephone: string | null } | null
  subscription: {
    status: string; plan: string | null; started_at: string | null; ended_at: string | null
    pending_plan: string | null; pending_at: string | null
  } | null
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

  // profiles = source de vérité pour les abonnés (inclut les users sans user_accounts)
  const { data: profData, error: profError } = await db
    .from('profiles')
    .select('user_id, email, created_at, telephone')

  if (profError || !profData?.length) return { users: [], total: 0 }

  const allIds = (profData as { user_id: string; email: string | null; created_at: string | null; telephone: string | null }[])
    .map(p => p.user_id).filter(Boolean)

  const [accRes, subRes, walletRes] = await Promise.all([
    db.from('user_accounts')
      .select('id, email, full_name, plan, tokens, onboarding_status, created_at, account_status, phone')
      .in('id', allIds),
    db.from('subscriptions').select('user_id, status').in('user_id', allIds),
    db.from('wallets').select('user_id, balance').in('user_id', allIds),
  ])

  type AccRow = { id: string; email: string; full_name: string | null; plan: string; tokens: number; onboarding_status: string; created_at: string; account_status: string; phone: string | null }
  const accMap: Record<string, AccRow> = {}
  const subMap: Record<string, string> = {}
  const walletMap: Record<string, number> = {}
  const profMap: Record<string, { email: string | null; created_at: string | null; telephone: string | null }> = {}

  if (accRes.data) for (const a of accRes.data as AccRow[]) accMap[a.id] = a
  if (subRes.data) for (const s of subRes.data as { user_id: string; status: string }[]) subMap[s.user_id] = s.status
  if (walletRes.data) for (const w of walletRes.data as { user_id: string; balance: number }[]) walletMap[w.user_id] = w.balance
  for (const p of profData as { user_id: string; email: string | null; created_at: string | null; telephone: string | null }[]) profMap[p.user_id] = p

  let rows: UserRow[] = allIds.map(uid => {
    const acc = accMap[uid]
    const prof = profMap[uid]
    return {
      id: uid,
      email: acc?.email ?? prof?.email ?? '—',
      full_name: acc?.full_name ?? null,
      plan: acc?.plan ?? 'SOLO',
      tokens: acc?.tokens ?? 0,
      wallet_balance: walletMap[uid] ?? null,
      account_status: acc?.account_status ?? 'active',
      onboarding_status: acc?.onboarding_status ?? 'not_started',
      created_at: acc?.created_at ?? prof?.created_at ?? new Date().toISOString(),
      sub_status: subMap[uid] ?? null,
      phone: acc?.phone ?? null,
    }
  })

  if (search.trim()) {
    const s = search.trim().toLowerCase()
    rows = rows.filter(u =>
      u.email.toLowerCase().includes(s) ||
      (u.full_name?.toLowerCase().includes(s) ?? false)
    )
  }
  if (plan !== 'all') rows = rows.filter(u => u.plan === plan)

  rows.sort((a, b) => {
    const av = sortBy === 'tokens' ? a.tokens : sortBy === 'full_name' ? (a.full_name ?? '').toLowerCase() : a.created_at
    const bv = sortBy === 'tokens' ? b.tokens : sortBy === 'full_name' ? (b.full_name ?? '').toLowerCase() : b.created_at
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const total = rows.length
  return { users: rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), total }
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const auth = await verifyAdmin()
  if ('error' in auth) return null

  const db = makeAdminClient()
  const sbAdmin = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // user_accounts peut être absent (trigger manqué) → maybeSingle, pas single
  const [accRes, profRes, subRes, txRes, walletRes, authUserRes] = await Promise.all([
    db.from('user_accounts').select('id, email, full_name, plan, tokens, onboarding_status, phone, prenom, nom, created_at, account_status').eq('id', userId).maybeSingle(),
    db.from('profiles').select('nom_entreprise, statut_juridique, telephone').eq('user_id', userId).maybeSingle(),
    db.from('subscriptions').select('status, plan, started_at, ended_at, pending_plan, pending_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('token_transactions').select('id, type, amount, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    db.from('wallets').select('balance').eq('user_id', userId).maybeSingle(),
    sbAdmin.auth.admin.getUserById(userId),
  ])

  type AccRow = { id: string; email: string; full_name: string | null; plan: string; tokens: number; onboarding_status: string; phone: string | null; prenom: string | null; nom: string | null; created_at: string; account_status: string }
  const acc = accRes.data as AccRow | null
  const authUser = authUserRes.data?.user as { email?: string; banned_until?: string; last_sign_in_at?: string; created_at?: string } | null

  // Sans user_accounts NI auth user → vraiment introuvable
  if (!acc && !authUser) return null

  const bannedUntil = authUser?.banned_until
  const is_banned = !!(bannedUntil && new Date(bannedUntil) > new Date())

  return {
    id: userId,
    email: acc?.email ?? authUser?.email ?? '—',
    full_name: acc?.full_name ?? null,
    prenom: acc?.prenom ?? null,
    nom: acc?.nom ?? null,
    phone: acc?.phone ?? null,
    plan: acc?.plan ?? 'SOLO',
    tokens: acc?.tokens ?? 0,
    wallet_balance: (walletRes.data as { balance: number } | null)?.balance ?? null,
    account_status: acc?.account_status ?? 'active',
    onboarding_status: acc?.onboarding_status ?? 'not_started',
    created_at: acc?.created_at ?? authUser?.created_at ?? new Date().toISOString(),
    sub_status: (subRes.data as { status: string } | null)?.status ?? null,
    is_banned,
    last_sign_in_at: authUser?.last_sign_in_at ?? null,
    profile: profRes.data as UserDetail['profile'],
    subscription: subRes.data as UserDetail['subscription'],
    tokenHistory: txRes.error ? [] : (txRes.data as UserDetail['tokenHistory']) ?? [],
  }
}

export async function addTokens(targetUserId: string, amount: number, motif: string): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(amount) || amount < 1 || amount > 50) return { success: false, error: 'Montant invalide (1–50).' }
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const db = makeAdminClient()
  const { data: wallet } = await db.from('wallets').select('balance').eq('user_id', targetUserId).maybeSingle()
  if (wallet) {
    const { error: we } = await db.from('wallets')
      .update({ balance: (wallet as { balance: number }).balance + amount })
      .eq('user_id', targetUserId)
    if (we) return { success: false, error: 'Erreur lors de la mise à jour du portefeuille.' }
  } else {
    const { error: wi } = await db.from('wallets').insert({ user_id: targetUserId, balance: amount })
    if (wi) return { success: false, error: 'Erreur lors de la création du portefeuille.' }
  }

  await db.from('token_transactions').insert({ user_id: targetUserId, type: 'admin_grant', amount, description: motif })
  await logAction(auth.adminId, 'add_tokens', targetUserId, { amount, motif })
  return { success: true }
}

export async function changePlan(targetUserId: string, newPlan: string, startDate?: string, endDate?: string): Promise<{ success: boolean; error?: string }> {
  if (!['SOLO', 'DUO', 'TEAM', 'ENTERPRISE'].includes(newPlan)) return { success: false, error: 'Plan invalide.' }
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const db = makeAdminClient()
  const { data: accData } = await db.from('user_accounts').select('plan').eq('id', targetUserId).single()
  const currentPlan = (accData as { plan: string } | null)?.plan ?? 'SOLO'
  const isDowngrade = (PLAN_RANK[newPlan] ?? 0) < (PLAN_RANK[currentPlan] ?? 0)

  if (isDowngrade) {
    const { data: sub } = await db.from('subscriptions').select('id')
      .eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (sub) {
      await db.from('subscriptions')
        .update({ pending_plan: newPlan, pending_at: endDate ?? null })
        .eq('id', (sub as { id: string }).id)
    }
  } else {
    const { error } = await db.from('user_accounts')
      .update({ plan: newPlan, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
    if (error) return { success: false, error: 'Erreur lors de la mise à jour.' }
    if (startDate && endDate) {
      await db.from('subscriptions').insert({
        user_id: targetUserId, plan: newPlan, status: 'active', started_at: startDate, ended_at: endDate,
      })
    }
  }

  await logAction(auth.adminId, 'change_plan', targetUserId, {
    current_plan: currentPlan, new_plan: newPlan, is_downgrade: isDowngrade, start_date: startDate, end_date: endDate,
  })
  return { success: true }
}

async function setAccountStatus(targetUserId: string, status: string): Promise<void> {
  const db = makeAdminClient()
  const { data: updated } = await db
    .from('user_accounts')
    .update({ account_status: status })
    .eq('id', targetUserId)
    .select('id')

  if (!updated || updated.length === 0) {
    // Pas de row user_accounts → créer avec les defaults
    const sbAdmin = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: authUser } = await sbAdmin.auth.admin.getUserById(targetUserId)
    await db.from('user_accounts').insert({
      id: targetUserId,
      email: authUser?.user?.email ?? '',
      account_status: status,
      plan: 'SOLO',
      tokens: 0,
      onboarding_status: 'not_started',
    })
  }
}

export async function suspendAccount(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const sbAdmin = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error } = await sbAdmin.auth.admin.updateUserById(targetUserId, { ban_duration: '876000h' })
  if (error) return { success: false, error: 'Erreur lors de la suspension.' }

  await setAccountStatus(targetUserId, 'suspended')
  await logAction(auth.adminId, 'suspend_account', targetUserId)
  return { success: true }
}

export async function reactivateAccount(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const sbAdmin = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error } = await sbAdmin.auth.admin.updateUserById(targetUserId, { ban_duration: 'none' })
  if (error) return { success: false, error: 'Erreur lors de la réactivation.' }

  await setAccountStatus(targetUserId, 'active')
  await logAction(auth.adminId, 'reactivate_account', targetUserId)
  return { success: true }
}

export async function deleteAccount(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const sbAdmin = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { error } = await sbAdmin.auth.admin.updateUserById(targetUserId, { ban_duration: '876000h' })
  if (error) return { success: false, error: 'Erreur lors de la suppression.' }

  await setAccountStatus(targetUserId, 'deleted')
  await logAction(auth.adminId, 'delete_account', targetUserId)
  return { success: true }
}

export async function sendAdminEmail(targetUserId: string, subject: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!subject.trim() || !message.trim()) return { success: false, error: 'Sujet et message requis.' }
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || apiKey.startsWith('re_VOTRE')) {
    return { success: false, error: 'Service email non configuré (RESEND_API_KEY manquant).' }
  }

  const db = makeAdminClient()
  const sbAdminEmail = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Chercher l'email dans user_accounts, fallback sur auth.users
  const { data: acc } = await db.from('user_accounts').select('email').eq('id', targetUserId).maybeSingle()
  let recipientEmail = (acc as { email: string } | null)?.email ?? null
  if (!recipientEmail) {
    const { data: authUser } = await sbAdminEmail.auth.admin.getUserById(targetUserId)
    recipientEmail = authUser?.user?.email ?? null
  }
  if (!recipientEmail) return { success: false, error: 'Email utilisateur introuvable.' }

  const resend = new Resend(apiKey)
  const { error: emailError } = await resend.emails.send({
    from: 'NoX VTC <admin@noxvtc.fr>',
    to: [recipientEmail],
    subject,
    text: message,
  })
  if (emailError) return { success: false, error: emailError.message }

  await logAction(auth.adminId, 'send_email', targetUserId, { subject })
  return { success: true }
}

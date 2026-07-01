'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
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

// Revalide les écrans admin après chaque écriture en base.
// targetUserId : si fourni, invalide aussi la page détail user.
function revalidateAdminWrites(targetUserId?: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/users')
  revalidatePath('/admin/subscriptions')
  revalidatePath('/admin/tokens')
  if (targetUserId) revalidatePath('/admin/users/[id]', 'page')
}

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

function sumColumn<T extends Record<string, unknown>>(rows: T[] | null, col: keyof T): number {
  return rows?.reduce((s, r) => s + Math.abs(Number(r[col] ?? 0)), 0) ?? 0
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
    db.from('subscriptions').select('user_id, status').in('status', ['active']),
    // 2 — accepter 'trial' (réel en base) ET 'trialing' (legacy/Stripe)
    db.from('subscriptions').select('user_id, status').in('status', ['trial', 'trialing']),
    // 3 courant
    db.from('subscriptions').select('*', { count: 'exact', head: true })
      .eq('status', 'expired').gte('current_period_end', startCurr),
    // 3 précédent
    db.from('subscriptions').select('*', { count: 'exact', head: true })
      .eq('status', 'expired').gte('current_period_end', startPrev).lt('current_period_end', startCurr),
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
    // 6 courant — convention métier réelle : colonne `montant_ttc`, statut `payee`
    db.from('invoices').select('montant_ttc')
      .eq('status', 'payee').gte('created_at', startCurr),
    // 6 précédent
    db.from('invoices').select('montant_ttc')
      .eq('status', 'payee').gte('created_at', startPrev).lt('created_at', startCurr),
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
      current:  revCurr.error ? null : sumColumn(revCurr.data as { montant_ttc: number | null }[], 'montant_ttc'),
      previous: revPrev.error ? null : sumColumn(revPrev.data as { montant_ttc: number | null }[], 'montant_ttc'),
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
  full_name: string
  plan: PlanCode
  tokens: number
  wallet_balance: number
  account_status: string
  onboarding_status: string
  created_at: string
  sub_status: SubStatus
  phone: string | null
}

export interface UserDetail extends UserRow {
  prenom: string | null
  nom: string | null
  phone: string | null
  is_banned: boolean
  last_sign_in_at: string | null
  deletion_requested_at: string | null
  deletion_scheduled_for: string | null
  profile: { nom_entreprise: string | null; statut_juridique: string | null; telephone: string | null } | null
  subscription: {
    status: SubStatus; plan: PlanCode | null; started_at: string | null; ended_at: string | null
    pending_plan: PlanCode | null; pending_at: string | null
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
      .select('id, email, full_name, prenom, nom, plan, tokens, onboarding_status, created_at, account_status, phone')
      .in('id', allIds),
    db.from('subscriptions')
      .select('user_id, status, plan, trial_started_at, trial_ends_at, created_at')
      .in('user_id', allIds)
      .order('created_at', { ascending: false }),
    db.from('wallets').select('user_id, balance').in('user_id', allIds),
  ])

  type AccRow = { id: string; email: string; full_name: string | null; prenom: string | null; nom: string | null; plan: string | null; tokens: number; onboarding_status: string; created_at: string; account_status: string | null; phone: string | null }
  type SubMini = { user_id: string; status: string; plan: string | null; trial_started_at: string | null; trial_ends_at: string | null }
  const accMap: Record<string, AccRow> = {}
  const subMap: Record<string, SubMini> = {}
  const walletMap: Record<string, number> = {}
  const profMap: Record<string, { email: string | null; created_at: string | null; telephone: string | null }> = {}

  if (accRes.data) for (const a of accRes.data as AccRow[]) accMap[a.id] = a
  if (subRes.data) for (const s of subRes.data as SubMini[]) {
    // Une seule ligne par user (la plus récente — déjà triée desc).
    if (!subMap[s.user_id]) subMap[s.user_id] = s
  }
  if (walletRes.data) for (const w of walletRes.data as { user_id: string; balance: number }[]) walletMap[w.user_id] = w.balance
  for (const p of profData as { user_id: string; email: string | null; created_at: string | null; telephone: string | null }[]) profMap[p.user_id] = p

  let rows: UserRow[] = allIds.map(uid => {
    const acc = accMap[uid]
    const sub = subMap[uid] ?? null
    const prof = profMap[uid]
    const plan = effectivePlan(sub, acc?.plan ?? null)
    const status = effectiveStatus({ account_status: acc?.account_status ?? null }, sub)
    return {
      id: uid,
      email: acc?.email ?? prof?.email ?? '—',
      full_name: displayName(acc, null, acc?.email ?? prof?.email ?? null),
      plan,
      tokens: acc?.tokens ?? 0,
      wallet_balance: walletMap[uid] ?? 0,
      account_status: acc?.account_status ?? 'active',
      onboarding_status: acc?.onboarding_status ?? 'not_started',
      created_at: acc?.created_at ?? prof?.created_at ?? new Date().toISOString(),
      sub_status: status,
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
  if (plan !== 'all') {
    const wanted = normalizePlanCode(plan)
    rows = rows.filter(u => u.plan === wanted)
  }

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
    db.from('user_accounts').select('id, email, full_name, plan, tokens, onboarding_status, phone, prenom, nom, created_at, account_status, deletion_requested_at, deletion_scheduled_for').eq('id', userId).maybeSingle(),
    db.from('profiles').select('nom_entreprise, statut_juridique, telephone').eq('user_id', userId).maybeSingle(),
    db.from('subscriptions').select('status, plan, current_period_start, current_period_end, trial_started_at, trial_ends_at, pending_plan, pending_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('token_transactions').select('id, type, amount, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    db.from('wallets').select('balance').eq('user_id', userId).maybeSingle(),
    sbAdmin.auth.admin.getUserById(userId),
  ])

  type AccRow = { id: string; email: string; full_name: string | null; plan: string | null; tokens: number; onboarding_status: string; phone: string | null; prenom: string | null; nom: string | null; created_at: string; account_status: string | null; deletion_requested_at: string | null; deletion_scheduled_for: string | null }
  type SubRaw = {
    status: string; plan: string | null
    current_period_start: string | null; current_period_end: string | null
    trial_started_at: string | null; trial_ends_at: string | null
    pending_plan: string | null; pending_at: string | null
  }
  const acc = accRes.data as AccRow | null
  const subRaw = subRes.data as SubRaw | null
  const authUser = authUserRes.data?.user as { email?: string; banned_until?: string; last_sign_in_at?: string; created_at?: string; user_metadata?: { full_name?: string; name?: string } } | null

  // Sans user_accounts NI auth user → vraiment introuvable
  if (!acc && !authUser) return null

  const bannedUntil = authUser?.banned_until
  const is_banned = !!(bannedUntil && new Date(bannedUntil) > new Date())

  const effPlan = effectivePlan(subRaw, acc?.plan ?? null)
  const effStatus = effectiveStatus({ account_status: acc?.account_status ?? null }, subRaw)
  // started_at/ended_at n'existent pas en base : effectiveTrialDates dérive depuis
  // current_period_* (avec fallback trial_*).
  const dates = effectiveTrialDates(subRaw)
  const startedAt = dates.start
  const endedAt = dates.end

  const subscription: UserDetail['subscription'] = subRaw
    ? {
        status: normalizeSubStatus(subRaw.status),
        plan: subRaw.plan ? normalizePlanCode(subRaw.plan) : null,
        started_at: startedAt,
        ended_at: endedAt,
        pending_plan: subRaw.pending_plan ? normalizePlanCode(subRaw.pending_plan) : null,
        pending_at: subRaw.pending_at,
      }
    : null

  return {
    id: userId,
    email: acc?.email ?? authUser?.email ?? '—',
    full_name: displayName(acc, authUser?.user_metadata ?? null, acc?.email ?? authUser?.email ?? null),
    prenom: acc?.prenom ?? null,
    nom: acc?.nom ?? null,
    phone: acc?.phone ?? null,
    plan: effPlan,
    tokens: acc?.tokens ?? 0,
    wallet_balance: (walletRes.data as { balance: number } | null)?.balance ?? 0,
    account_status: acc?.account_status ?? 'active',
    onboarding_status: acc?.onboarding_status ?? 'not_started',
    created_at: acc?.created_at ?? authUser?.created_at ?? new Date().toISOString(),
    sub_status: effStatus,
    is_banned,
    last_sign_in_at: authUser?.last_sign_in_at ?? null,
    deletion_requested_at: acc?.deletion_requested_at ?? null,
    deletion_scheduled_for: acc?.deletion_scheduled_for ?? null,
    profile: profRes.data as UserDetail['profile'],
    subscription,
    tokenHistory: txRes.error ? [] : (txRes.data as UserDetail['tokenHistory']) ?? [],
  }
}

export async function addTokens(targetUserId: string, amount: number, motif: string): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(amount) || amount < 1 || amount > 50) return { success: false, error: 'Montant invalide (1–50).' }
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const db = makeAdminClient()
  const { data: wallet } = await db.from('wallets').select('id, balance').eq('user_id', targetUserId).maybeSingle()

  let walletId: string | null = null
  let balanceAfter: number

  if (wallet) {
    const w = wallet as { id: string; balance: number }
    walletId = w.id
    balanceAfter = w.balance + amount
    const { error: we } = await db.from('wallets').update({ balance: balanceAfter }).eq('user_id', targetUserId)
    if (we) return { success: false, error: 'Erreur lors de la mise à jour du portefeuille.' }
  } else {
    balanceAfter = amount
    const { data: newWallet, error: wi } = await db.from('wallets')
      .insert({ user_id: targetUserId, balance: amount })
      .select('id')
      .single()
    if (wi) return { success: false, error: 'Erreur lors de la création du portefeuille.' }
    walletId = (newWallet as { id: string } | null)?.id ?? null
  }

  const { data: txData, error: txError } = await db.from('token_transactions').insert({
    user_id: targetUserId, type: 'admin_grant', amount, description: motif,
    wallet_id: walletId, balance_after: balanceAfter,
  }).select()
  console.log('[addTokens] token_transactions insert:', { data: txData, error: txError })
  if (txError) return { success: false, error: 'Erreur lors de l\'enregistrement de la transaction.' }

  // Filet de sécurité : garder user_accounts.tokens synchrone avec wallets.balance.
  // L'affichage canonique est wallets.balance (Lot 1) — cette écriture évite qu'un
  // écran legacy lisant user_accounts.tokens montre un "0" trompeur.
  await db.from('user_accounts').update({ tokens: balanceAfter }).eq('id', targetUserId)

  await logAction(auth.adminId, 'add_tokens', targetUserId, { amount, motif })
  revalidateAdminWrites(targetUserId)
  return { success: true }
}

export async function changePlan(targetUserId: string, newPlan: string, startDate?: string, endDate?: string): Promise<{ success: boolean; error?: string }> {
  // Tolère MAJUSCULES (legacy) et minuscules ; rejette tout le reste avant toute écriture.
  const lc = (newPlan ?? '').toString().trim().toLowerCase()
  if (!['solo', 'duo', 'team'].includes(lc)) return { success: false, error: 'Plan invalide.' }
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const normalizedNew: PlanCode = normalizePlanCode(newPlan)
  const db = makeAdminClient()

  // Source de vérité : subscriptions.plan (fallback user_accounts.plan).
  const [subRead, accRead] = await Promise.all([
    db.from('subscriptions').select('id, plan, status')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('user_accounts').select('plan').eq('id', targetUserId).maybeSingle(),
  ])
  const subRow = subRead.data as { id: string; plan: string | null; status: string } | null
  const accRow = accRead.data as { plan: string | null } | null
  const currentPlanRaw = subRow?.plan ?? accRow?.plan ?? null
  const currentPlan: PlanCode = normalizePlanCode(currentPlanRaw)

  // Décision produit : l'admin ne peut PAS rétrograder un abonné depuis le back-office.
  if ((PLAN_RANK[normalizedNew] ?? 0) < (PLAN_RANK[currentPlan] ?? 0)) {
    return { success: false, error: "Il n'est pas possible de rétrograder un abonné depuis le back-office." }
  }

  // Upgrade (ou même rang) : MAJ synchrone subscriptions.plan + user_accounts.plan (normalisé).
  const { error: accError } = await db.from('user_accounts')
    .update({ plan: normalizedNew, updated_at: new Date().toISOString() })
    .eq('id', targetUserId)
  if (accError) return { success: false, error: 'Erreur lors de la mise à jour du compte.' }

  if (subRow) {
    const subUpdate: Record<string, string> = { plan: normalizedNew }
    if (startDate) subUpdate.current_period_start = startDate
    if (endDate)   subUpdate.current_period_end   = endDate
    // Trial qui upgrade au-dessus du plan d'essai → bascule en 'active'.
    if (subRow.status === 'trial' && (PLAN_RANK[normalizedNew] ?? 0) > (PLAN_RANK[TRIAL_PLAN_CODE] ?? 0)) {
      subUpdate.status = 'active'
    }
    const { error: subError } = await db.from('subscriptions')
      .update(subUpdate).eq('id', subRow.id)
    if (subError) return { success: false, error: 'Erreur lors de la mise à jour de l\'abonnement.' }
  } else if (startDate && endDate) {
    // Aucune ligne subscriptions : UNE ligne propre (cas migration legacy).
    const { error: insError } = await db.from('subscriptions').insert({
      user_id: targetUserId, plan: normalizedNew, status: 'active',
      current_period_start: startDate, current_period_end: endDate,
    })
    if (insError) return { success: false, error: 'Erreur lors de la création de l\'abonnement.' }
  }

  await logAction(auth.adminId, 'change_plan', targetUserId, {
    current_plan: currentPlan, new_plan: normalizedNew, start_date: startDate, end_date: endDate,
  })
  revalidateAdminWrites(targetUserId)
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
  revalidateAdminWrites(targetUserId)
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
  revalidateAdminWrites(targetUserId)
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
  revalidateAdminWrites(targetUserId)
  return { success: true }
}

export async function cancelUserDeletion(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const db = makeAdminClient()

  const { error: accErr } = await db.from('user_accounts')
    .update({
      account_status: 'active',
      deletion_requested_at: null,
      deletion_scheduled_for: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId)
    .eq('account_status', 'pending_deletion')

  if (accErr) return { success: false, error: 'Erreur lors de la mise à jour du compte.' }

  await db.from('profiles')
    .update({
      status: 'active',
      deletion_requested_at: null,
      deletion_scheduled_for: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', targetUserId)

  await logAction(auth.adminId, 'cancel_deletion', targetUserId, { cancelled_at: new Date().toISOString() })

  const { data: accEmail } = await db.from('user_accounts').select('email').eq('id', targetUserId).maybeSingle()
  const recipientEmail = (accEmail as { email: string } | null)?.email ?? null
  if (recipientEmail) {
    await sendEmail(
      recipientEmail,
      'Votre demande de suppression a été annulée — NoX VTC',
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#333">
        <p>Bonjour,</p>
        <p>Votre demande de suppression de compte NoX VTC a été annulée suite à votre demande. Votre compte est de nouveau pleinement actif.</p>
        <p style="margin-top:24px">
          <a href="https://app.noxvtc.fr" style="background:#C9A84C;color:#0F0F0F;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Accéder à mon espace</a>
        </p>
        <p style="margin-top:24px;color:#666;font-size:13px">L'équipe NoX VTC</p>
      </div>`
    )
  }

  revalidateAdminWrites(targetUserId)
  return { success: true }
}

export async function sendAdminEmail(targetUserId: string, subject: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!subject.trim() || !message.trim()) return { success: false, error: 'Sujet et message requis.' }
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'Service email non configuré (RESEND_API_KEY manquant).' }
  }

  const db = makeAdminClient()
  const sbAdminEmail = createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: acc } = await db.from('user_accounts').select('email').eq('id', targetUserId).maybeSingle()
  let recipientEmail = (acc as { email: string } | null)?.email ?? null
  if (!recipientEmail) {
    const { data: authUser } = await sbAdminEmail.auth.admin.getUserById(targetUserId)
    recipientEmail = authUser?.user?.email ?? null
  }
  if (!recipientEmail) return { success: false, error: 'Email utilisateur introuvable.' }

  const result = await sendEmail(recipientEmail, subject, templateMessage(subject, message))
  if (!result.success) return { success: false, error: result.error }

  await logAction(auth.adminId, 'send_email', targetUserId, { subject })
  revalidateAdminWrites(targetUserId)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Abonnements
// ═══════════════════════════════════════════════════════════════════════════════

export interface SubscriptionRow {
  id: string
  user_id: string
  email: string
  full_name: string
  phone: string | null
  plan: PlanCode
  sub_status: SubStatus
  account_status: string
  current_period_start: string | null
  current_period_end: string | null
}

export interface GetSubsParams {
  plan?: string
  status?: string
  page?: number
}

const SUBS_PAGE_SIZE = 20

export async function getSubscriptions(params: GetSubsParams = {}): Promise<{ subs: SubscriptionRow[]; total: number }> {
  const auth = await verifyAdmin()
  if ('error' in auth) return { subs: [], total: 0 }

  const db = makeAdminClient()
  const { plan = 'all', status = 'all', page = 0 } = params

  type SubRaw = {
    id: string; user_id: string; plan: string | null; status: string
    current_period_start: string | null; current_period_end: string | null
    trial_started_at: string | null; trial_ends_at: string | null
    created_at: string
  }

  // Filtre côté JS après normalisation : les valeurs en base sont en MAJUSCULES
  // (SOLO/DUO/TEAM) et le statut 'trial' (legacy 'trialing'). Filtrer côté SQL
  // raterait toujours les essais réels.
  const { data: subs, error } = await db.from('subscriptions')
    .select('id, user_id, plan, status, current_period_start, current_period_end, trial_started_at, trial_ends_at, created_at')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[getSubscriptions] Supabase error:', JSON.stringify(error))
    return { subs: [], total: 0 }
  }
  if (!subs?.length) {
    return { subs: [], total: 0 }
  }

  // Dédupliquer : une ligne par user_id (la plus récente déjà triée)
  const seen = new Set<string>()
  const unique = (subs as SubRaw[]).filter(s => { if (seen.has(s.user_id)) return false; seen.add(s.user_id); return true })

  const userIds = unique.map(s => s.user_id)
  type AccRaw = { id: string; email: string; full_name: string | null; prenom: string | null; nom: string | null; phone: string | null; plan: string | null; account_status: string | null }
  const { data: accs } = await db.from('user_accounts').select('id, email, full_name, prenom, nom, phone, plan, account_status').in('id', userIds)
  const accMap: Record<string, AccRaw> = {}
  if (accs) for (const a of accs as AccRaw[]) accMap[a.id] = a

  let rows: SubscriptionRow[] = unique.map(s => {
    const acc = accMap[s.user_id]
    const effPlan = effectivePlan(s, acc?.plan ?? null)
    const effStat = effectiveStatus({ account_status: acc?.account_status ?? null }, s)
    const dates = effectiveTrialDates(s)
    return {
      id: s.id,
      user_id: s.user_id,
      email: acc?.email ?? '—',
      full_name: displayName(acc, null, acc?.email ?? null),
      phone: acc?.phone ?? null,
      plan: effPlan,
      sub_status: effStat,
      account_status: acc?.account_status ?? 'active',
      current_period_start: dates.start,
      current_period_end: dates.end,
    }
  })

  if (plan !== 'all') {
    const wanted = normalizePlanCode(plan)
    rows = rows.filter(r => r.plan === wanted)
  }
  if (status !== 'all') {
    const wantedStatus = normalizeSubStatus(status)
    rows = rows.filter(r => r.sub_status === wantedStatus)
  }

  return { subs: rows.slice(page * SUBS_PAGE_SIZE, (page + 1) * SUBS_PAGE_SIZE), total: rows.length }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module Jetons
// ═══════════════════════════════════════════════════════════════════════════════

export interface TokenRow {
  user_id: string
  email: string
  full_name: string
  phone: string | null
  plan: PlanCode
  sub_status: SubStatus
  wallet_balance: number
  last_tx_date: string | null
  last_tx_amount: number | null
  expired_sub_plan: PlanCode | null
}

export interface GetTokensParams {
  plan?: string
  status?: string
  balance?: string
  page?: number
}

const TOKENS_PAGE_SIZE = 20

export async function getTokensData(params: GetTokensParams = {}): Promise<{ rows: TokenRow[]; total: number }> {
  const auth = await verifyAdmin()
  if ('error' in auth) return { rows: [], total: 0 }

  const db = makeAdminClient()
  const { plan = 'all', status = 'all', balance = 'all', page = 0 } = params

  type AccRow = { id: string; email: string; full_name: string | null; prenom: string | null; nom: string | null; phone: string | null; plan: string | null; account_status: string | null }
  const { data: accs, error: accErr } = await db
    .from('user_accounts')
    .select('id, email, full_name, prenom, nom, phone, plan, account_status')
  if (accErr || !accs?.length) return { rows: [], total: 0 }

  const allIds = (accs as AccRow[]).map(a => a.id)

  type SubRaw = { user_id: string; status: string; plan: string | null; trial_started_at: string | null; trial_ends_at: string | null }
  type TxRaw  = { user_id: string; amount: number; created_at: string }
  type WalRaw = { user_id: string; balance: number }

  const [walletRes, subRes, txRes] = await Promise.all([
    db.from('wallets').select('user_id, balance').in('user_id', allIds),
    db.from('subscriptions')
      .select('user_id, status, plan, trial_started_at, trial_ends_at, created_at')
      .in('user_id', allIds)
      .order('created_at', { ascending: false }),
    db.from('token_transactions')
      .select('user_id, amount, created_at')
      .in('user_id', allIds)
      .order('created_at', { ascending: false }),
  ])

  const subMap: Record<string, SubRaw> = {}
  const expiredSubPlan: Record<string, PlanCode> = {}
  for (const s of (subRes.data ?? []) as SubRaw[]) {
    if (!subMap[s.user_id]) subMap[s.user_id] = s
    const normStat = normalizeSubStatus(s.status)
    const normPlan = normalizePlanCode(s.plan)
    if (normStat === 'expired' && (normPlan === 'duo' || normPlan === 'team') && !expiredSubPlan[s.user_id]) {
      expiredSubPlan[s.user_id] = normPlan
    }
  }

  const lastTxMap: Record<string, TxRaw> = {}
  for (const tx of (txRes.data ?? []) as TxRaw[]) {
    if (!lastTxMap[tx.user_id]) lastTxMap[tx.user_id] = tx
  }

  const walletMap: Record<string, number> = {}
  for (const w of (walletRes.data ?? []) as WalRaw[]) walletMap[w.user_id] = w.balance

  let rows: TokenRow[] = (accs as AccRow[]).map(acc => {
    const sub = subMap[acc.id] ?? null
    const effPlan = effectivePlan(sub, acc.plan ?? null)
    const effStat = effectiveStatus({ account_status: acc.account_status ?? null }, sub)
    return {
      user_id: acc.id,
      email: acc.email,
      full_name: displayName(acc, null, acc.email),
      phone: acc.phone,
      plan: effPlan,
      sub_status: effStat,
      wallet_balance: walletMap[acc.id] ?? 0,
      last_tx_date: lastTxMap[acc.id]?.created_at ?? null,
      last_tx_amount: lastTxMap[acc.id]?.amount ?? null,
      expired_sub_plan: effPlan === 'solo' ? (expiredSubPlan[acc.id] ?? null) : null,
    }
  })

  if (plan !== 'all') {
    const wanted = normalizePlanCode(plan)
    rows = rows.filter(r => r.plan === wanted)
  }
  if (status !== 'all') {
    const wantedStatus = normalizeSubStatus(status)
    rows = rows.filter(r => r.sub_status === wantedStatus)
  }
  if (balance === 'empty') rows = rows.filter(r => r.wallet_balance === 0)
  else if (balance === 'low') rows = rows.filter(r => r.wallet_balance > 0 && r.wallet_balance < 5)

  rows.sort((a, b) => a.wallet_balance - b.wallet_balance)

  const total = rows.length
  return { rows: rows.slice(page * TOKENS_PAGE_SIZE, (page + 1) * TOKENS_PAGE_SIZE), total }
}

export type TokenHistoryTx = {
  id: string
  type: string
  amount: number
  balance_after: number | null
  description: string | null
  created_at: string
}

export async function getTokenHistory(userId: string): Promise<TokenHistoryTx[]> {
  const auth = await verifyAdmin()
  if ('error' in auth) return []

  const { data } = await makeAdminClient()
    .from('token_transactions')
    .select('id, type, amount, balance_after, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  return (data ?? []) as TokenHistoryTx[]
}

export async function changeSubscriptionPlan(
  userId: string,
  newPlan: string,
  startDate?: string,
  endDate?: string,
): Promise<{ success: boolean; error?: string }> {
  const lc = (newPlan ?? '').toString().trim().toLowerCase()
  if (!['solo', 'duo', 'team'].includes(lc)) return { success: false, error: 'Plan invalide.' }
  const auth = await verifyAdmin()
  if ('error' in auth) return { success: false, error: auth.error }

  const db = makeAdminClient()
  const normalized: PlanCode = normalizePlanCode(newPlan)

  // Lire le plan courant (source de vérité = subscriptions) pour valider le sens du changement.
  const { data: subRead, error: subReadErr } = await db.from('subscriptions')
    .select('id, plan, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trial', 'trialing'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (subReadErr) return { success: false, error: 'Erreur lecture abonnement.' }
  const subCurrent = subRead as { id: string; plan: string | null; status: string } | null
  if (!subCurrent) return { success: false, error: 'Aucun abonnement actif ou en essai trouvé pour cet utilisateur.' }

  const currentPlan: PlanCode = normalizePlanCode(subCurrent.plan)
  // Décision produit : pas de downgrade depuis le back-office.
  if ((PLAN_RANK[normalized] ?? 0) < (PLAN_RANK[currentPlan] ?? 0)) {
    return { success: false, error: "Il n'est pas possible de rétrograder un abonné depuis le back-office." }
  }

  const subUpdate: Record<string, string> = { plan: normalized }
  if (startDate) subUpdate.current_period_start = startDate
  if (endDate)   subUpdate.current_period_end   = endDate
  // Trial qui upgrade au-dessus du plan d'essai → bascule en 'active'.
  if (subCurrent.status === 'trial' && (PLAN_RANK[normalized] ?? 0) > (PLAN_RANK[TRIAL_PLAN_CODE] ?? 0)) {
    subUpdate.status = 'active'
  }

  const { data: subUpdated, error: subErr } = await db.from('subscriptions')
    .update(subUpdate)
    .eq('id', subCurrent.id)
    .select('id')
  if (subErr) return { success: false, error: 'Erreur mise à jour abonnement.' }
  if (!subUpdated || subUpdated.length === 0) {
    return { success: false, error: 'Aucun abonnement actif ou en essai trouvé pour cet utilisateur.' }
  }

  await logAction(auth.adminId, 'change_plan', userId, { new_plan: normalized, source: 'subscriptions', start_date: startDate, end_date: endDate })
  revalidateAdminWrites(userId)
  return { success: true }
}

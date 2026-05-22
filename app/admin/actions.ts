'use server'

import { createServerClient } from '@supabase/ssr'
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

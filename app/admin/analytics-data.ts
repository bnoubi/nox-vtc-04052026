'use server'

import { createServerClient } from '@supabase/ssr'

export interface MonthlyCount {
  month: string // "janv. 2026"
  count: number
  amount?: number
}

export interface PlanDistribution {
  plan: string
  label: string
  count: number
}

export interface UserConsumed {
  email: string
  consumed: number
}

export interface StatusCount {
  status: string
  count: number
}

export interface TicketStats {
  byStatus: { open: number; in_progress: number; closed: number }
  byPriority: { low: number; normal: number; high: number }
  overdueCount: number
  avgResolutionDays: number | null
}

export interface AnalyticsData {
  inscriptionsByMonth: MonthlyCount[]
  mrr: number
  totalActiveSubscribers: number
  planDistribution: PlanDistribution[]
  conversion: { totalAccounts: number; paidSubscribers: number; rate: number }
  tokenPurchasesByMonth: MonthlyCount[]
  topConsumers: UserConsumed[]
  accountStatusThisMonth: StatusCount[]
  pendingDeletionCount: number
  ticketStats: TicketStats
  fetchedAt: string
}

function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

function monthKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

function buildMonthBuckets(sixMonthsAgo: Date): MonthlyCount[] {
  const buckets: MonthlyCount[] = []
  const now = new Date()
  const cursor = new Date(sixMonthsAgo)
  while (cursor <= now) {
    buckets.push({ month: cursor.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }), count: 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return buckets
}

export async function getAdminAnalytics(): Promise<AnalyticsData> {
  const db = makeAdminClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const sixMonthsAgoISO = sixMonthsAgo.toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // ── A) Inscriptions par mois ──────────────────────────────────────────────
  let inscriptionsByMonth: MonthlyCount[] = buildMonthBuckets(sixMonthsAgo)
  try {
    const { data } = await db
      .from('user_accounts')
      .select('created_at')
      .gte('created_at', sixMonthsAgoISO)
    if (data) {
      for (const row of data) {
        const key = monthKey(row.created_at)
        const bucket = inscriptionsByMonth.find(b => b.month === key)
        if (bucket) bucket.count++
      }
    }
  } catch (e) { console.error('[analytics] A) inscriptions:', e) }

  // ── B) MRR + C) Répartition plans ────────────────────────────────────────
  let mrr = 0
  let totalActiveSubscribers = 0
  const planDistribution: PlanDistribution[] = [
    { plan: 'solo', label: 'Starter', count: 0 },
    { plan: 'duo',  label: 'Pro',     count: 0 },
    { plan: 'team', label: 'Premium', count: 0 },
  ]
  try {
    const { data } = await db
      .from('subscriptions')
      .select('plan, status')
      .in('status', ['active', 'trial', 'trialing'])
    if (data) {
      for (const row of data) {
        const plan = (row.plan ?? '').toLowerCase()
        const bucket = planDistribution.find(p => p.plan === plan)
        if (bucket) bucket.count++
        totalActiveSubscribers++
        if (row.status === 'active') {
          if (plan === 'duo')  mrr += 4.99
          if (plan === 'team') mrr += 9.99
        }
      }
    }
  } catch (e) { console.error('[analytics] B/C) subs:', e) }

  // ── D) Taux conversion ────────────────────────────────────────────────────
  let totalAccounts = 0
  let paidSubscribers = 0
  try {
    const [countRes, paidRes] = await Promise.all([
      db.from('user_accounts').select('*', { count: 'exact', head: true }),
      db.from('subscriptions').select('user_id').eq('status', 'active'),
    ])
    totalAccounts = countRes.count ?? 0
    paidSubscribers = paidRes.data
      ? new Set(paidRes.data.map((r: { user_id: string }) => r.user_id)).size
      : 0
  } catch (e) { console.error('[analytics] D) conversion:', e) }
  const rate = totalAccounts > 0 ? Math.round((paidSubscribers / totalAccounts) * 100) : 0

  // ── E) Achats jetons par mois ─────────────────────────────────────────────
  let tokenPurchasesByMonth: MonthlyCount[] = buildMonthBuckets(sixMonthsAgo).map(b => ({ ...b, amount: 0 }))
  try {
    const { data } = await db
      .from('saas_invoices')
      .select('created_at, montant_ttc')
      .eq('type', 'token_pack')
      .gte('created_at', sixMonthsAgoISO)
    if (data) {
      for (const row of data) {
        const key = monthKey(row.created_at)
        const bucket = tokenPurchasesByMonth.find(b => b.month === key)
        if (bucket) {
          bucket.count++
          bucket.amount = (bucket.amount ?? 0) + (Number(row.montant_ttc) || 0)
        }
      }
    }
  } catch (e) { console.error('[analytics] E) token purchases:', e) }

  // ── F) Top 5 consommateurs ────────────────────────────────────────────────
  let topConsumers: UserConsumed[] = []
  try {
    const { data: txData } = await db
      .from('token_transactions')
      .select('user_id, amount')
      .lt('amount', 0)
    if (txData) {
      const byUser: Record<string, number> = {}
      for (const row of txData) {
        byUser[row.user_id] = (byUser[row.user_id] ?? 0) + Math.abs(row.amount)
      }
      const top5 = Object.entries(byUser)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
      const ids = top5.map(([id]) => id)
      const { data: users } = await db
        .from('user_accounts')
        .select('id, email')
        .in('id', ids)
      const emailMap = Object.fromEntries((users ?? []).map((u: { id: string; email: string }) => [u.id, u.email]))
      topConsumers = top5.map(([id, consumed]) => ({
        email: emailMap[id] ?? id,
        consumed,
      }))
    }
  } catch (e) { console.error('[analytics] F) top consumers:', e) }

  // ── G) Comptes expirés/suspendus ce mois ─────────────────────────────────
  let accountStatusThisMonth: StatusCount[] = []
  try {
    const { data } = await db
      .from('user_accounts')
      .select('account_status')
      .in('account_status', ['suspended', 'deleted', 'pending_deletion'])
      .gte('updated_at', startOfMonth)
    if (data) {
      const counts: Record<string, number> = {}
      for (const row of data) {
        counts[row.account_status] = (counts[row.account_status] ?? 0) + 1
      }
      accountStatusThisMonth = Object.entries(counts).map(([status, count]) => ({ status, count }))
    }
  } catch (e) { console.error('[analytics] G) account status:', e) }

  // ── H) Pending deletion ───────────────────────────────────────────────────
  let pendingDeletionCount = 0
  try {
    const { count } = await db
      .from('user_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('account_status', 'pending_deletion')
    pendingDeletionCount = count ?? 0
  } catch (e) { console.error('[analytics] H) pending deletion:', e) }

  // ── I) Stats support ──────────────────────────────────────────────────────
  const ticketStats: TicketStats = {
    byStatus: { open: 0, in_progress: 0, closed: 0 },
    byPriority: { low: 0, normal: 0, high: 0 },
    overdueCount: 0,
    avgResolutionDays: null,
  }
  try {
    const { data } = await db
      .from('support_tickets')
      .select('status, priority, created_at, resolved_at')
    if (data) {
      const resolvedThisMonth: number[] = []
      for (const row of data) {
        const st = row.status?.toLowerCase()
        if (st === 'open')        ticketStats.byStatus.open++
        if (st === 'in_progress') ticketStats.byStatus.in_progress++
        if (st === 'closed')      ticketStats.byStatus.closed++

        const pr = row.priority?.toLowerCase()
        if (pr === 'low')    ticketStats.byPriority.low++
        if (pr === 'normal') ticketStats.byPriority.normal++
        if (pr === 'high')   ticketStats.byPriority.high++

        if (st !== 'closed' && row.created_at < sevenDaysAgo) {
          ticketStats.overdueCount++
        }

        if (st === 'closed' && row.resolved_at && row.created_at >= startOfMonth) {
          const days = (new Date(row.resolved_at).getTime() - new Date(row.created_at).getTime()) / 86400000
          resolvedThisMonth.push(days)
        }
      }
      if (resolvedThisMonth.length > 0) {
        ticketStats.avgResolutionDays = Math.round(
          (resolvedThisMonth.reduce((a, b) => a + b, 0) / resolvedThisMonth.length) * 10,
        ) / 10
      }
    }
  } catch (e) { console.error('[analytics] I) support:', e) }

  return {
    inscriptionsByMonth,
    mrr,
    totalActiveSubscribers,
    planDistribution,
    conversion: { totalAccounts, paidSubscribers, rate },
    tokenPurchasesByMonth,
    topConsumers,
    accountStatusThisMonth,
    pendingDeletionCount,
    ticketStats,
    fetchedAt: new Date().toISOString(),
  }
}

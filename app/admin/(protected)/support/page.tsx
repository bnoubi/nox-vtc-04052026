import { createClient } from '@supabase/supabase-js'
import { SupportStats, type SupportStatsData } from './_components/support-stats'
import { TicketsTable } from './_components/tickets-table'

interface RawTicket {
  id: string
  created_at: string
  subject: string
  subject_category: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'normal' | 'urgent'
  user_id: string
  resolved_at: string | null
}


function computeStats(tickets: RawTicket[]): SupportStatsData {
  const now = new Date()
  const threshold48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  const kpi = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    urgent: tickets.filter(t => t.priority === 'urgent').length,
    stale_open: tickets.filter(t => t.status === 'open' && new Date(t.created_at) < threshold48h).length,
  }

  // Temps de réponse moyen (en heures) sur tickets résolus avec resolved_at
  const resolvedWithTime = tickets.filter(t => t.resolved_at)
  const avgResponseHours = resolvedWithTime.length > 0
    ? resolvedWithTime.reduce((sum, t) => {
        return sum + (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3_600_000
      }, 0) / resolvedWithTime.length
    : null

  // Répartition par catégorie
  const catMap: Record<string, number> = {}
  for (const t of tickets) {
    catMap[t.subject_category] = (catMap[t.subject_category] ?? 0) + 1
  }
  const byCategory = Object.entries(catMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  // Évolution par semaine (8 dernières semaines)
  const byWeek: { week: string; count: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now)
    end.setDate(end.getDate() - i * 7)
    const start = new Date(end)
    start.setDate(start.getDate() - 7)
    const count = tickets.filter(t => {
      const d = new Date(t.created_at)
      return d >= start && d <= end
    }).length
    const label = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    byWeek.push({ week: label, count })
  }

  // Top 5 abonnés par nombre de tickets (user_id enrichi plus bas)
  const userMap: Record<string, number> = {}
  for (const t of tickets) {
    userMap[t.user_id] = (userMap[t.user_id] ?? 0) + 1
  }
  const top5Ids = Object.entries(userMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  return { kpi, avgResponseHours, byCategory, byWeek, topUsers: top5Ids.map(uid => ({ user_id: uid, name: '—', email: '—', count: userMap[uid] })) }
}

export default async function SupportPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: rawTickets } = await supabase
    .from('support_tickets')
    .select('id, created_at, subject, subject_category, status, priority, user_id, resolved_at')
    .order('created_at', { ascending: false })

  const tickets = (rawTickets ?? []) as RawTicket[]
  const stats = computeStats(tickets)

  // Enrichir les top abonnés avec user_accounts
  const top5Ids = stats.topUsers.map(u => u.user_id)
  if (top5Ids.length > 0) {
    const { data: accounts } = await supabase
      .from('user_accounts')
      .select('id, email, full_name')
      .in('id', top5Ids)

    stats.topUsers = stats.topUsers.map(u => {
      const acc = accounts?.find((a: { id: string; email: string | null; full_name: string | null }) => a.id === u.user_id)
      return { ...u, name: acc?.full_name ?? '—', email: acc?.email ?? '—' }
    })
  }

  return (
    <div className="space-y-6">
      <SupportStats data={stats} />

      <TicketsTable tickets={tickets} />
    </div>
  )
}

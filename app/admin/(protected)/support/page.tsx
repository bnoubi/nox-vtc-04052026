import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

interface Ticket {
  id: string
  created_at: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'normal' | 'urgent'
}

const STATUS_LABELS: Record<Ticket['status'], string> = {
  open: 'En attente',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
}

const STATUS_COLORS: Record<Ticket['status'], string> = {
  open: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  resolved: 'bg-green-500/20 text-green-400 border border-green-500/30',
  closed: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
}

const PRIORITY_COLORS: Record<string, string> = {
  normal: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
  urgent: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normale',
  urgent: 'Urgente',
}

export default async function SupportPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, created_at, subject, status, priority')
    .order('created_at', { ascending: false })

  const list = (tickets ?? []) as Ticket[]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--admin-border)', backgroundColor: 'var(--admin-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>Sujet</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>Statut</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>Priorité</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center px-4 py-12" style={{ color: 'var(--admin-muted-foreground)' }}>
                  Aucun ticket support.
                </td>
              </tr>
            ) : (
              list.map((ticket) => (
                <tr
                  key={ticket.id}
                  style={{ borderBottom: '1px solid var(--admin-border)' }}
                  className="hover:bg-[var(--admin-active-bg)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/support/${ticket.id}`}
                      className="font-medium hover:underline"
                      style={{ color: 'var(--admin-foreground)' }}
                    >
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[ticket.status]}`}>
                      {STATUS_LABELS[ticket.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.normal}`}>
                      {PRIORITY_LABELS[ticket.priority] ?? 'Normale'}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--admin-muted-foreground)' }}>
                    {new Date(ticket.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

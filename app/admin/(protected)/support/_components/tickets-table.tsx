'use client'

import { useState } from 'react'
import Link from 'next/link'

export interface TicketRow {
  id: string
  created_at: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'normal' | 'urgent'
}

type StatusFilter = 'all' | TicketRow['status']
type PriorityFilter = 'all' | TicketRow['priority']

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',         label: 'Tous' },
  { value: 'open',        label: 'En attente' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved',    label: 'Résolu' },
  { value: 'closed',      label: 'Fermé' },
]

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: 'all',    label: 'Tous' },
  { value: 'normal', label: 'Normale' },
  { value: 'urgent', label: 'Urgente' },
]

const STATUS_COLORS: Record<TicketRow['status'], string> = {
  open:        'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  resolved:    'bg-green-500/20 text-green-400 border border-green-500/30',
  closed:      'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
}

const STATUS_LABELS: Record<TicketRow['status'], string> = {
  open: 'En attente', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé',
}

const PRIORITY_COLORS: Record<string, string> = {
  normal: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
  urgent: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

const PRIORITY_LABELS: Record<string, string> = { normal: 'Normale', urgent: 'Urgente' }

function FilterBtn<T extends string>({
  value, active, label, onClick,
}: { value: T; active: boolean; label: string; onClick: (v: T) => void }) {
  return (
    <button
      onClick={() => onClick(value)}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
      style={active
        ? { backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }
        : { backgroundColor: 'var(--admin-background)', color: 'var(--admin-muted-foreground)', border: '1px solid var(--admin-border)' }
      }
    >
      {label}
    </button>
  )
}

export function TicketsTable({ tickets }: { tickets: TicketRow[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')

  const filtered = tickets.filter(t =>
    (statusFilter === 'all' || t.status === statusFilter) &&
    (priorityFilter === 'all' || t.priority === priorityFilter)
  )

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="rounded-xl border p-3 space-y-2.5" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--admin-muted-foreground)', minWidth: 52 }}>Statut</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map(o => (
              <FilterBtn key={o.value} value={o.value} label={o.label} active={statusFilter === o.value} onClick={setStatusFilter} />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium shrink-0" style={{ color: 'var(--admin-muted-foreground)', minWidth: 52 }}>Priorité</span>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITY_OPTIONS.map(o => (
              <FilterBtn key={o.value} value={o.value} label={o.label} active={priorityFilter === o.value} onClick={setPriorityFilter} />
            ))}
          </div>
        </div>
      </div>

      {/* Compteur */}
      <p className="text-xs px-1" style={{ color: 'var(--admin-muted-foreground)' }}>
        <span className="font-semibold" style={{ color: 'var(--admin-foreground)' }}>{filtered.length}</span>
        {' '}ticket{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Tableau */}
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center px-4 py-12" style={{ color: 'var(--admin-muted-foreground)' }}>
                  Aucun ticket ne correspond aux filtres sélectionnés.
                </td>
              </tr>
            ) : (
              filtered.map(ticket => (
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

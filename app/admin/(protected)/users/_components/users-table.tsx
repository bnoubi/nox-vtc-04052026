'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'
import { getUsers, type UserRow, type GetUsersParams } from '@/app/admin/actions'

type SortCol = 'created_at' | 'full_name' | 'tokens'

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  SOLO:       { bg: 'rgba(107,114,128,0.15)', text: 'var(--admin-muted-foreground)' },
  TEAM:       { bg: 'rgba(59,130,246,0.15)',  text: '#3B82F6' },
  ENTERPRISE: { bg: 'rgba(197,160,89,0.15)',  text: 'var(--admin-primary)' },
}
const STATUS_COLORS: Record<string, string> = {
  active:   'var(--admin-success)',
  trialing: '#F59E0B',
  expired:  'var(--admin-destructive)',
}

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: bg, color: text }}>
      {label}
    </span>
  )
}

function Skeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {[180, 100, 90, 80, 100].map((w, j) => (
            <td key={j} className="py-3 px-4">
              <div className="h-4 rounded" style={{ width: w, backgroundColor: 'var(--admin-border)' }} />
            </td>
          ))}
          <td className="py-3 px-4"><div className="h-4 w-16 rounded" style={{ backgroundColor: 'var(--admin-border)' }} /></td>
        </tr>
      ))}
    </>
  )
}

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={13} className="ml-1 opacity-40" />
  return dir === 'asc' ? <ChevronUp size={13} className="ml-1" /> : <ChevronDown size={13} className="ml-1" />
}

export function UsersTable() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [plan, setPlan] = useState('all')
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState<SortCol>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getUsers({ search: debouncedSearch, plan, page, sortBy, sortDir })
      setUsers(res.users)
      setTotal(res.total)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, plan, page, sortBy, sortDir])

  useEffect(() => { fetch() }, [fetch])

  function handleSort(col: SortCol) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
    setPage(0)
  }

  function reset() { setSearch(''); setPlan('all'); setPage(0); setSortBy('created_at'); setSortDir('desc') }

  const totalPages = Math.ceil(total / 20)

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--admin-border)', backgroundColor: 'var(--admin-card)' }}
    >
      {/* Barre de filtres */}
      <div className="p-4 flex flex-wrap gap-3 border-b" style={{ borderColor: 'var(--admin-border)' }}>
        <div className="flex items-center gap-2 flex-1 min-w-48 rounded-lg border px-3 py-2"
          style={{ borderColor: 'var(--admin-border)', backgroundColor: 'var(--admin-background)' }}>
          <Search size={15} style={{ color: 'var(--admin-muted-foreground)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--admin-foreground)' }}
          />
          {search && (
            <button onClick={() => setSearch('')}><X size={13} style={{ color: 'var(--admin-muted-foreground)' }} /></button>
          )}
        </div>

        <select
          value={plan}
          onChange={e => { setPlan(e.target.value); setPage(0) }}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--admin-border)', backgroundColor: 'var(--admin-background)', color: 'var(--admin-foreground)' }}
        >
          <option value="all">Tous les plans</option>
          <option value="SOLO">SOLO</option>
          <option value="TEAM">TEAM</option>
          <option value="ENTERPRISE">ENTERPRISE</option>
        </select>

        {(search || plan !== 'all') && (
          <button onClick={reset} className="text-sm px-3 py-2 rounded-lg border"
            style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>
            Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
              {([
                { label: 'Utilisateur', col: 'full_name' as SortCol, sortable: true },
                { label: 'Plan', col: null, sortable: false },
                { label: 'Statut', col: null, sortable: false },
                { label: 'Jetons', col: 'tokens' as SortCol, sortable: true },
                { label: 'Inscription', col: 'created_at' as SortCol, sortable: true },
                { label: 'Actions', col: null, sortable: false },
              ]).map(({ label, col, sortable }) => (
                <th
                  key={label}
                  className="text-left py-3 px-4 font-medium"
                  style={{ color: 'var(--admin-muted-foreground)', whiteSpace: 'nowrap' }}
                >
                  {sortable && col ? (
                    <button onClick={() => handleSort(col)} className="flex items-center hover:opacity-80">
                      {label}<SortIcon col={col} active={sortBy === col} dir={sortDir} />
                    </button>
                  ) : label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <Skeleton />
            ) : error ? (
              <tr><td colSpan={6} className="py-10 text-center text-sm" style={{ color: 'var(--admin-destructive)' }}>Erreur de chargement</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>Aucun utilisateur trouvé</td></tr>
            ) : users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                {/* Utilisateur */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{ backgroundColor: 'var(--admin-active-bg)', color: 'var(--admin-primary)' }}>
                      {(u.full_name ?? u.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--admin-foreground)' }}>{u.full_name ?? '—'}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--admin-muted-foreground)' }}>{u.email}</p>
                    </div>
                  </div>
                </td>
                {/* Plan */}
                <td className="py-3 px-4">
                  <Badge label={u.plan} bg={PLAN_COLORS[u.plan]?.bg ?? 'rgba(107,114,128,0.15)'} text={PLAN_COLORS[u.plan]?.text ?? 'var(--admin-muted-foreground)'} />
                </td>
                {/* Statut */}
                <td className="py-3 px-4">
                  {u.sub_status ? (
                    <Badge label={u.sub_status} bg={`${STATUS_COLORS[u.sub_status] ?? 'var(--admin-muted-foreground)'}22`} text={STATUS_COLORS[u.sub_status] ?? 'var(--admin-muted-foreground)'} />
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>—</span>
                  )}
                </td>
                {/* Jetons */}
                <td className="py-3 px-4 font-medium tabular-nums" style={{ color: 'var(--admin-foreground)' }}>
                  {u.tokens.toLocaleString('fr-FR')}
                </td>
                {/* Inscription */}
                <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'var(--admin-muted-foreground)' }}>
                  {new Date(u.created_at).toLocaleDateString('fr-FR')}
                </td>
                {/* Actions */}
                <td className="py-3 px-4">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-80"
                    style={{ borderColor: 'var(--admin-primary)', color: 'var(--admin-primary)' }}
                  >
                    Voir le détail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--admin-border)' }}>
        <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
          {total.toLocaleString('fr-FR')} utilisateur{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40"
            style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }}
          >
            ← Précédent
          </button>
          <span className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
            Page {page + 1}{totalPages > 0 ? ` / ${totalPages}` : ''}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
            className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40"
            style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }}
          >
            Suivant →
          </button>
        </div>
      </div>
    </div>
  )
}

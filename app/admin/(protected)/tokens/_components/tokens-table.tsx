'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { AlertCircle, Coins, History, Zap } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useAdminTheme } from '@/lib/theme/admin-theme-context'
import {
  getTokensData, getTokenHistory, addTokens,
  type TokenRow, type TokenHistoryTx,
} from '@/app/admin/actions'
import { StatusBadge } from '../../users/_components/status-badge'

const TOKEN_MOTIF_GROUPS = [
  { label: 'Commerciaux', options: ['Offre de bienvenue', 'Offre de lancement', 'Code promo'] },
  { label: 'Support / Compensation', options: ['Compensation incident', 'Remboursement technique', 'Geste commercial'] },
  { label: 'Fidélité / Récompense', options: ['Bonus fidélité', 'Parrainage validé', 'Récompense challenge'] },
  { label: 'Interne / Admin', options: ['Test interne', 'Correction de solde', 'Attribution manuelle'] },
]

const TYPE_LABELS: Record<string, string> = {
  admin_grant: 'Attribution admin',
  credit: 'Crédit',
  debit: 'Débit',
  purchase: 'Achat',
  consumption: 'Consommation',
  bonus: 'Bonus',
  refund: 'Remboursement',
}

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  SOLO:       { bg: 'rgba(107,114,128,0.15)', text: 'var(--admin-muted-foreground)' },
  DUO:        { bg: 'rgba(139,92,246,0.15)',  text: '#8B5CF6' },
  TEAM:       { bg: 'rgba(59,130,246,0.15)',  text: '#3B82F6' },
  ENTERPRISE: { bg: 'rgba(204,255,0,0.15)',   text: 'var(--admin-primary)' },
}

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_COLORS[plan] ?? PLAN_COLORS.SOLO
  return (
    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {plan}
    </span>
  )
}

function Skeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {[180, 70, 90, 70, 110, 80, 140].map((w, j) => (
            <td key={j} className="py-3 px-4">
              <div className="h-4 rounded" style={{ width: w, backgroundColor: 'var(--admin-border)' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

const PAGE_SIZE = 20

export function TokensTable() {
  const { theme } = useAdminTheme()

  const [rows, setRows]       = useState<TokenRow[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  const [planFilter, setPlanFilter]       = useState('all')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [balanceFilter, setBalanceFilter] = useState('all')
  const [page, setPage]                   = useState(0)

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [busy, setBusy]         = useState(false)

  const [activeToken, setActiveToken]       = useState<TokenRow | null>(null)
  const [showTokens, setShowTokens]         = useState(false)
  const [tokenAmount, setTokenAmount]       = useState('')
  const [tokenMotifKey, setTokenMotifKey]   = useState('')
  const [tokenMotifCustom, setTokenMotifCustom] = useState('')

  const [activeHistory, setActiveHistory]   = useState<TokenRow | null>(null)
  const [showHistory, setShowHistory]       = useState(false)
  const [history, setHistory]               = useState<TokenHistoryTx[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(t)
  }, [feedback])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getTokensData({ plan: planFilter, status: statusFilter, balance: balanceFilter, page })
      setRows(res.rows)
      setTotal(res.total)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [planFilter, statusFilter, balanceFilter, page])

  useEffect(() => { load() }, [load])

  async function openHistory(row: TokenRow) {
    setActiveHistory(row)
    setShowHistory(true)
    setHistoryLoading(true)
    setHistory([])
    try {
      setHistory(await getTokenHistory(row.user_id))
    } finally {
      setHistoryLoading(false)
    }
  }

  function openTokens(row: TokenRow) {
    setActiveToken(row)
    setTokenAmount('')
    setTokenMotifKey('')
    setTokenMotifCustom('')
    setShowTokens(true)
  }

  async function submitTokens() {
    if (!activeToken || !tokenAmount || !actualMotif) return
    setBusy(true)
    try {
      const res = await addTokens(activeToken.user_id, parseInt(tokenAmount), actualMotif)
      if (res.success) {
        setFeedback({ type: 'success', message: 'Jetons attribués avec succès.' })
        setShowTokens(false)
        await load()
      } else {
        setFeedback({ type: 'error', message: res.error ?? 'Erreur inconnue.' })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Une erreur inattendue est survenue.' })
    } finally {
      setBusy(false)
    }
  }

  const actualMotif  = tokenMotifKey === 'Autre' ? tokenMotifCustom : tokenMotifKey
  const totalPages   = Math.ceil(total / PAGE_SIZE)
  const hasFilters   = planFilter !== 'all' || statusFilter !== 'all' || balanceFilter !== 'all'
  const selectStyle  = { backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }
  const dialogStyle  = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }

  return (
    <>
      {feedback && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium mb-2" style={{
          backgroundColor: feedback.type === 'success' ? 'rgba(56,161,105,0.1)' : 'rgba(229,62,62,0.1)',
          color: feedback.type === 'success' ? 'var(--admin-success)' : 'var(--admin-destructive)',
          border: `1px solid ${feedback.type === 'success' ? 'var(--admin-success)' : 'var(--admin-destructive)'}44`,
        }}>
          {feedback.message}
        </div>
      )}

      <div className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--admin-border)', backgroundColor: 'var(--admin-card)' }}>

        {/* Filtres */}
        <div className="p-4 flex flex-wrap gap-3 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>
            <Coins size={15} />
            Filtres
          </div>
          <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(0) }}
            className="rounded-lg border px-3 py-2 text-sm" style={selectStyle}>
            <option value="all">Tous les plans</option>
            {['SOLO', 'DUO', 'TEAM'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            className="rounded-lg border px-3 py-2 text-sm" style={selectStyle}>
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="trialing">Essai</option>
            <option value="suspended">Suspendu</option>
            <option value="expired">Expiré</option>
          </select>
          <select value={balanceFilter} onChange={e => { setBalanceFilter(e.target.value); setPage(0) }}
            className="rounded-lg border px-3 py-2 text-sm" style={selectStyle}>
            <option value="all">Tous les soldes</option>
            <option value="empty">Solde vide</option>
            <option value="low">Solde faible (&lt; 5)</option>
          </select>
          {hasFilters && (
            <button onClick={() => { setPlanFilter('all'); setStatusFilter('all'); setBalanceFilter('all'); setPage(0) }}
              className="text-sm px-3 py-2 rounded-lg border"
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
                {['Abonné', 'Plan', 'Statut', 'Solde', 'Dernière transaction', 'Alertes', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium whitespace-nowrap"
                    style={{ color: 'var(--admin-muted-foreground)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <Skeleton />
              ) : error ? (
                <tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color: 'var(--admin-destructive)' }}>
                  Erreur de chargement
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>
                  Aucun abonné trouvé
                </td></tr>
              ) : rows.map(row => (
                <tr key={row.user_id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                  {/* Abonné */}
                  <td className="py-3 px-4">
                    <Link href={`/admin/users/${row.user_id}`} className="flex items-center gap-3 hover:opacity-80">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                        style={{ backgroundColor: 'var(--admin-active-bg)', color: 'var(--admin-primary)' }}>
                        {(row.full_name ?? row.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[160px]" style={{ color: 'var(--admin-foreground)' }}>
                          {row.full_name ?? '—'}
                        </p>
                        <p className="text-xs truncate max-w-[160px]" style={{ color: 'var(--admin-muted-foreground)' }}>
                          {row.email}
                        </p>
                        {row.phone && (
                          <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{row.phone}</p>
                        )}
                      </div>
                    </Link>
                  </td>
                  {/* Plan */}
                  <td className="py-3 px-4"><PlanBadge plan={row.plan} /></td>
                  {/* Statut */}
                  <td className="py-3 px-4"><StatusBadge status={row.sub_status} /></td>
                  {/* Solde */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      {row.wallet_balance === 0 && <AlertCircle size={14} color="var(--admin-destructive)" />}
                      <span className="font-semibold tabular-nums"
                        style={{ color: row.wallet_balance === 0 ? 'var(--admin-destructive)' : 'var(--admin-foreground)' }}>
                        {row.wallet_balance.toLocaleString('fr-FR')}
                      </span>
                    </div>
                  </td>
                  {/* Dernière transaction */}
                  <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'var(--admin-muted-foreground)' }}>
                    {row.last_tx_date ? (
                      <>
                        {new Date(row.last_tx_date).toLocaleDateString('fr-FR')}
                        {row.last_tx_amount != null && (
                          <span className="ml-1.5 font-medium"
                            style={{ color: row.last_tx_amount < 0 ? 'var(--admin-destructive)' : 'var(--admin-success)' }}>
                            {row.last_tx_amount > 0 ? '+' : ''}{row.last_tx_amount}
                          </span>
                        )}
                      </>
                    ) : '—'}
                  </td>
                  {/* Alertes */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {row.wallet_balance === 0 && (
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(229,62,62,0.12)', color: 'var(--admin-destructive)' }}>
                          Vide
                        </span>
                      )}
                      {row.expired_sub_plan && (
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                          Ancien {row.expired_sub_plan}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Actions */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openTokens(row)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-80"
                        style={{ borderColor: 'var(--admin-primary)', color: 'var(--admin-primary)' }}>
                        <Zap size={12} />
                        Attribuer
                      </button>
                      <button onClick={() => openHistory(row)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-80"
                        style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>
                        <History size={12} />
                        Historique
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--admin-border)' }}>
          <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
            {total.toLocaleString('fr-FR')} abonné{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }}>
              ← Précédent
            </button>
            <span className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
              Page {page + 1}{totalPages > 0 ? ` / ${totalPages}` : ''}
            </span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }}>
              Suivant →
            </button>
          </div>
        </div>
      </div>

      {/* Modal — Attribuer des jetons */}
      <Dialog open={showTokens} onOpenChange={open => { setShowTokens(open); if (!open) setActiveToken(null) }}>
        <DialogContent {...{ 'data-admin-theme': theme }} style={dialogStyle}>
          <DialogHeader><DialogTitle>Attribuer des jetons</DialogTitle></DialogHeader>
          {activeToken && (
            <p className="text-sm -mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
              {activeToken.full_name ?? activeToken.email} — solde actuel : <strong>{activeToken.wallet_balance}</strong>
            </p>
          )}
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Montant (1–50)</Label>
              <input type="number" min="1" max="50"
                value={tokenAmount} onChange={e => setTokenAmount(e.target.value)}
                placeholder="ex : 10"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }} />
            </div>
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <select value={tokenMotifKey} onChange={e => { setTokenMotifKey(e.target.value); setTokenMotifCustom('') }}
                className="w-full rounded-lg border px-3 py-2 text-sm" style={selectStyle}>
                <option value="">— Sélectionner un motif —</option>
                {TOKEN_MOTIF_GROUPS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                ))}
                <option value="Autre">Autre…</option>
              </select>
              {tokenMotifKey === 'Autre' && (
                <input value={tokenMotifCustom} onChange={e => setTokenMotifCustom(e.target.value)}
                  placeholder="Précisez le motif…"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none mt-2"
                  style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }} />
              )}
            </div>
          </div>
          <DialogFooter>
            <button className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}
              onClick={() => setShowTokens(false)}>Annuler</button>
            <button disabled={busy || !tokenAmount || !actualMotif}
              className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
              onClick={submitTokens}>
              {busy ? 'En cours…' : 'Confirmer'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Historique des transactions */}
      <Dialog open={showHistory} onOpenChange={open => { setShowHistory(open); if (!open) { setActiveHistory(null); setHistory([]) } }}>
        <DialogContent {...{ 'data-admin-theme': theme }} style={dialogStyle}>
          <DialogHeader><DialogTitle>Historique des transactions</DialogTitle></DialogHeader>
          {activeHistory && (
            <p className="text-sm -mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
              {activeHistory.full_name ?? activeHistory.email}
            </p>
          )}
          <div className="overflow-y-auto max-h-[60vh]">
            {historyLoading ? (
              <div className="py-8 text-center text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>Chargement…</div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>Aucune transaction</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ backgroundColor: 'var(--admin-card)' }}>
                  <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                    {['Date/Heure', 'Type', 'Montant', 'Solde après', 'Description'].map(h => (
                      <th key={h} className="text-left py-2 pr-3 font-medium"
                        style={{ color: 'var(--admin-muted-foreground)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                      <td className="py-2 pr-3 whitespace-nowrap" style={{ color: 'var(--admin-muted-foreground)' }}>
                        {new Date(tx.created_at).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{TYPE_LABELS[tx.type] ?? tx.type}</td>
                      <td className="py-2 pr-3 font-medium tabular-nums"
                        style={{ color: tx.amount < 0 ? 'var(--admin-destructive)' : 'var(--admin-success)' }}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </td>
                      <td className="py-2 pr-3 tabular-nums" style={{ color: 'var(--admin-muted-foreground)' }}>
                        {tx.balance_after ?? '—'}
                      </td>
                      <td className="py-2 truncate max-w-[140px]" style={{ color: 'var(--admin-muted-foreground)' }}>
                        {tx.description ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <button className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}
              onClick={() => { setShowHistory(false); setActiveHistory(null); setHistory([]) }}>
              Fermer
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

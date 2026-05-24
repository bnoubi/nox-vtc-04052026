'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useAdminTheme } from '@/lib/theme/admin-theme-context'
import {
  getSubscriptions, changeSubscriptionPlan, suspendAccount, reactivateAccount,
  type SubscriptionRow,
} from '@/app/admin/actions'
import { StatusBadge } from '../../users/_components/status-badge'

const PLAN_OPTIONS = ['SOLO', 'DUO', 'TEAM', 'ENTERPRISE']

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
          {[180, 90, 90, 100, 100, 110].map((w, j) => (
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

export function SubscriptionsTable() {
  const router = useRouter()
  const { theme } = useAdminTheme()

  const [subs, setSubs]     = useState<SubscriptionRow[]>([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(false)
  const [plan, setPlan]     = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage]     = useState(0)

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [busy, setBusy]         = useState(false)

  const [activeSub, setActiveSub]       = useState<SubscriptionRow | null>(null)
  const [showPlan, setShowPlan]         = useState(false)
  const [showToggle, setShowToggle]     = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(t)
  }, [feedback])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getSubscriptions({ plan, status, page })
      setSubs(res.subs)
      setTotal(res.total)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [plan, status, page])

  useEffect(() => { load() }, [load])

  async function runAction(fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
    setBusy(true)
    try {
      const res = await fn()
      if (res.success) {
        setFeedback({ type: 'success', message: successMsg })
        setShowPlan(false)
        setShowToggle(false)
        setActiveSub(null)
        router.refresh()
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

  function openPlan(sub: SubscriptionRow) {
    setActiveSub(sub)
    setSelectedPlan(sub.plan)
    setShowPlan(true)
  }

  function openToggle(sub: SubscriptionRow) {
    setActiveSub(sub)
    setShowToggle(true)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const selectStyle = { backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }
  const dialogStyle = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }

  const isBanned = (sub: SubscriptionRow) =>
    sub.account_status === 'suspended' || sub.account_status === 'deleted'

  const effectiveStatus = (sub: SubscriptionRow) =>
    sub.account_status !== 'active' ? sub.account_status : sub.sub_status

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
            <CreditCard size={15} />
            Filtres
          </div>
          <select value={plan} onChange={e => { setPlan(e.target.value); setPage(0) }}
            className="rounded-lg border px-3 py-2 text-sm" style={selectStyle}>
            <option value="all">Tous les plans</option>
            {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}
            className="rounded-lg border px-3 py-2 text-sm" style={selectStyle}>
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="trialing">Essai</option>
            <option value="suspended">Désactivé</option>
            <option value="expired">Expiré</option>
            <option value="deleted">Supprimé</option>
          </select>
          {(plan !== 'all' || status !== 'all') && (
            <button onClick={() => { setPlan('all'); setStatus('all'); setPage(0) }}
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
                {['Abonné', 'Plan', 'Statut', 'Date début', 'Date fin', 'Actions'].map(h => (
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
                <tr><td colSpan={6} className="py-10 text-center text-sm" style={{ color: 'var(--admin-destructive)' }}>
                  Erreur de chargement
                </td></tr>
              ) : subs.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>
                  Aucun abonnement trouvé
                </td></tr>
              ) : subs.map(sub => (
                <tr key={sub.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                  {/* Abonné */}
                  <td className="py-3 px-4">
                    <Link href={`/admin/users/${sub.user_id}`} className="flex items-center gap-3 hover:opacity-80">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                        style={{ backgroundColor: 'var(--admin-active-bg)', color: 'var(--admin-primary)' }}>
                        {(sub.full_name ?? sub.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate max-w-[160px]" style={{ color: 'var(--admin-foreground)' }}>
                          {sub.full_name ?? '—'}
                        </p>
                        <p className="text-xs truncate max-w-[160px]" style={{ color: 'var(--admin-muted-foreground)' }}>
                          {sub.email}
                        </p>
                        {sub.phone && (
                          <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{sub.phone}</p>
                        )}
                      </div>
                    </Link>
                  </td>
                  {/* Plan */}
                  <td className="py-3 px-4"><PlanBadge plan={sub.plan} /></td>
                  {/* Statut */}
                  <td className="py-3 px-4"><StatusBadge status={effectiveStatus(sub)} /></td>
                  {/* Date début */}
                  <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'var(--admin-muted-foreground)' }}>
                    {sub.started_at ? new Date(sub.started_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  {/* Date fin */}
                  <td className="py-3 px-4 whitespace-nowrap" style={{ color: 'var(--admin-muted-foreground)' }}>
                    {sub.ended_at ? new Date(sub.ended_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  {/* Actions */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openPlan(sub)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-80"
                        style={{ borderColor: 'var(--admin-primary)', color: 'var(--admin-primary)' }}>
                        Changer le plan
                      </button>
                      <button
                        onClick={() => openToggle(sub)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-opacity hover:opacity-80"
                        style={{
                          borderColor: isBanned(sub) ? 'var(--admin-success)' : 'var(--admin-destructive)',
                          color: isBanned(sub) ? 'var(--admin-success)' : 'var(--admin-destructive)',
                        }}>
                        {isBanned(sub) ? 'Réactiver' : 'Désactiver'}
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
            {total.toLocaleString('fr-FR')} abonnement{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
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

      {/* Modal — Changer le plan */}
      <Dialog open={showPlan} onOpenChange={open => { setShowPlan(open); if (!open) setActiveSub(null) }}>
        <DialogContent {...{ 'data-admin-theme': theme }} style={dialogStyle}>
          <DialogHeader><DialogTitle>Changer le plan</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>
              Abonné : <strong style={{ color: 'var(--admin-foreground)' }}>{activeSub?.full_name ?? activeSub?.email}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Nouveau plan</Label>
              <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm" style={selectStyle}>
                {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
                Plan actuel : <strong>{activeSub?.plan}</strong>
              </p>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => { setShowPlan(false); setActiveSub(null) }}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>
              Annuler
            </button>
            <button
              disabled={busy || !activeSub || selectedPlan === activeSub?.plan}
              className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
              onClick={() => activeSub && runAction(
                () => changeSubscriptionPlan(activeSub.user_id, selectedPlan),
                `Plan changé en ${selectedPlan}.`
              )}>
              {busy ? 'En cours…' : 'Confirmer'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Désactiver / Réactiver */}
      <Dialog open={showToggle} onOpenChange={open => { setShowToggle(open); if (!open) setActiveSub(null) }}>
        <DialogContent {...{ 'data-admin-theme': theme }} style={dialogStyle}>
          <DialogHeader>
            <DialogTitle>
              {activeSub && isBanned(activeSub) ? 'Réactiver le compte' : 'Désactiver le compte'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm" style={{ color: 'var(--admin-foreground)' }}>
              {activeSub && isBanned(activeSub)
                ? <>Réactiver le compte de <strong>{activeSub.full_name ?? activeSub.email}</strong> ?</>
                : <>Désactiver le compte de <strong>{activeSub?.full_name ?? activeSub?.email}</strong> ?</>
              }
            </p>
            {activeSub && !isBanned(activeSub) && (
              <p className="text-sm" style={{ color: 'var(--admin-destructive)' }}>
                L'abonné ne pourra plus se connecter immédiatement.
              </p>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => { setShowToggle(false); setActiveSub(null) }}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}>
              Annuler
            </button>
            <button
              disabled={busy || !activeSub}
              className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{
                backgroundColor: activeSub && isBanned(activeSub) ? 'var(--admin-success)' : 'var(--admin-destructive)',
                color: '#fff',
              }}
              onClick={() => activeSub && runAction(
                () => isBanned(activeSub) ? reactivateAccount(activeSub.user_id) : suspendAccount(activeSub.user_id),
                isBanned(activeSub) ? 'Compte réactivé.' : 'Compte désactivé.'
              )}>
              {busy ? 'En cours…' : activeSub && isBanned(activeSub) ? 'Réactiver' : 'Désactiver'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

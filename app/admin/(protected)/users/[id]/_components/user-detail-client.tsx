'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, CreditCard, Ban, Mail, ShieldCheck, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useAdminTheme } from '@/lib/theme/admin-theme-context'
import { addTokens, changePlan, suspendAccount, reactivateAccount, deleteAccount, sendAdminEmail, type UserDetail } from '@/app/admin/actions'
import { StatusBadge } from '../../_components/status-badge'

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAN_OPTIONS = ['SOLO', 'DUO', 'TEAM', 'ENTERPRISE']
const PLAN_RANK: Record<string, number> = { SOLO: 1, DUO: 2, TEAM: 3, ENTERPRISE: 4 }
const DURATION_OPTIONS = [
  { value: '1', label: '1 mois' }, { value: '3', label: '3 mois' },
  { value: '6', label: '6 mois' }, { value: '12', label: '12 mois' },
]
const TOKEN_MOTIF_GROUPS = [
  { label: 'Commerciaux', options: ['Offre de bienvenue', 'Offre de lancement', 'Code promo'] },
  { label: 'Support / Compensation', options: ['Compensation incident', 'Remboursement technique', 'Geste commercial'] },
  { label: 'Fidélité / Récompense', options: ['Bonus fidélité', 'Parrainage validé', 'Récompense challenge'] },
  { label: 'Interne / Admin', options: ['Test interne', 'Correction de solde', 'Attribution manuelle'] },
]
// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const min = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (min < 60) return `Il y a ${min} minute${min !== 1 ? 's' : ''}`
  if (h < 24) return `Il y a ${h} heure${h !== 1 ? 's' : ''}`
  if (date.toDateString() === yesterday.toDateString()) {
    return `Hier à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (d < 7) {
    const day = date.toLocaleDateString('fr-FR', { weekday: 'long' })
    return `${day.charAt(0).toUpperCase()}${day.slice(1)} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  }
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-muted-foreground)' }}>{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span style={{ color: 'var(--admin-muted-foreground)' }}>{label}</span>
      <span className="font-medium text-right" style={{ color: 'var(--admin-foreground)' }}>{value ?? '—'}</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { user: UserDetail }

export function UserDetailClient({ user }: Props) {
  const router = useRouter()
  const { theme } = useAdminTheme()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [showTokens, setShowTokens]   = useState(false)
  const [showPlan, setShowPlan]       = useState(false)
  const [showSuspend, setShowSuspend] = useState(false)
  const [showDelete, setShowDelete]   = useState(false)
  const [showEmail, setShowEmail]     = useState(false)

  const [tokenAmount, setTokenAmount]           = useState('')
  const [tokenMotifKey, setTokenMotifKey]       = useState('')
  const [tokenMotifCustom, setTokenMotifCustom] = useState('')
  const [newPlan, setNewPlan]                   = useState(user.plan)
  const [planDuration, setPlanDuration]         = useState('1')
  const [planStartDate, setPlanStartDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [emailSubject, setEmailSubject]         = useState('')
  const [emailMessage, setEmailMessage]         = useState('')

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(t)
  }, [feedback])

  async function run(fn: () => Promise<{ success: boolean; error?: string }>, onClose: () => void, successMsg: string) {
    setBusy(true)
    try {
      const timeout = new Promise<{ success: false; error: string }>(resolve =>
        setTimeout(() => resolve({ success: false, error: 'La requête a expiré. Réessayez.' }), 20_000)
      )
      const res = await Promise.race([fn(), timeout])
      if (res.success) { setFeedback({ type: 'success', message: successMsg }); onClose(); router.refresh() }
      else setFeedback({ type: 'error', message: res.error ?? 'Erreur inconnue.' })
    } catch {
      setFeedback({ type: 'error', message: 'Une erreur inattendue est survenue.' })
    } finally {
      setBusy(false)
    }
  }

  const initials = (user.full_name ?? user.email).slice(0, 2).toUpperCase()
  const nameParts = `${user.prenom ?? ''} ${user.nom ?? ''}`.trim()
  const displayName = user.full_name ?? (nameParts || user.email)
  const balance = user.wallet_balance ?? user.tokens
  const actualMotif = tokenMotifKey === 'Autre' ? tokenMotifCustom : tokenMotifKey
  const planEndDate = planStartDate ? addMonths(planStartDate, parseInt(planDuration)) : ''
  const phone = user.phone ?? user.profile?.telephone ?? null

  // Plan upgrade/downgrade logic
  const newPlanRank = PLAN_RANK[newPlan] ?? 0
  const currentPlanRank = PLAN_RANK[user.plan] ?? 0
  const isUpgradeWithDates = (
    (user.plan === 'SOLO' && (newPlan === 'DUO' || newPlan === 'TEAM')) ||
    (user.plan === 'DUO' && newPlan === 'TEAM')
  )
  const isDowngrade = newPlanRank < currentPlanRank && newPlan !== user.plan
  const downgradeEffectDate = user.subscription?.ended_at

  const isDeleted = user.account_status === 'deleted'
  // Effective account status (account_status takes priority over subscription status)
  const effectiveStatus = user.account_status !== 'active' ? user.account_status : (user.sub_status ?? undefined)

  const dialogStyle = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }
  const selectStyle = { backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{
          backgroundColor: feedback.type === 'success' ? 'rgba(56,161,105,0.1)' : 'rgba(229,62,62,0.1)',
          color: feedback.type === 'success' ? 'var(--admin-success)' : 'var(--admin-destructive)',
          border: `1px solid ${feedback.type === 'success' ? 'var(--admin-success)' : 'var(--admin-destructive)'}44`,
        }}>
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne gauche */}
        <div className="space-y-4">
          <Section title="Profil utilisateur">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                style={{ backgroundColor: 'var(--admin-active-bg)', color: 'var(--admin-primary)' }}>
                {initials}
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--admin-foreground)' }}>{displayName}</p>
                <p className="text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>{user.email}</p>
                {phone && <p className="text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>{phone}</p>}
              </div>
            </div>
            <Row label="Téléphone" value={phone ?? '—'} />
            <Row label="Date d'inscription" value={new Date(user.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} />
            <Row label="Statut onboarding" value={user.onboarding_status} />
            {effectiveStatus && <Row label="Statut compte" value={<StatusBadge status={effectiveStatus} />} />}

          </Section>

          {user.profile && (
            <Section title="Profil entreprise">
              {user.profile.nom_entreprise && <Row label="Entreprise" value={user.profile.nom_entreprise} />}
              {user.profile.statut_juridique && <Row label="Statut juridique" value={user.profile.statut_juridique} />}
              {user.profile.telephone && user.profile.telephone !== phone && (
                <Row label="Téléphone pro" value={user.profile.telephone} />
              )}
            </Section>
          )}
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          <Section title="Abonnement">
            <Row label="Plan actuel" value={
              <span className="font-semibold" style={{ color: 'var(--admin-primary)' }}>{user.plan}</span>
            } />
            {user.subscription ? (
              <>
                <Row label="Statut" value={<StatusBadge status={user.subscription.status} />} />
                {user.subscription.started_at && <Row label="Début" value={new Date(user.subscription.started_at).toLocaleDateString('fr-FR')} />}
                {user.subscription.ended_at && <Row label="Fin" value={new Date(user.subscription.ended_at).toLocaleDateString('fr-FR')} />}
                {user.subscription.pending_plan && (
                  <Row label="Passage prévu" value={
                    <span style={{ color: '#F59E0B' }}>
                      → {user.subscription.pending_plan}
                      {user.subscription.pending_at && ` le ${new Date(user.subscription.pending_at).toLocaleDateString('fr-FR')}`}
                    </span>
                  } />
                )}
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>Données d'abonnement indisponibles</p>
            )}
          </Section>

          <Section title="Jetons">
            <Row label="Solde actuel" value={
              <span className="text-lg font-bold" style={{ color: 'var(--admin-primary)' }}>
                {balance.toLocaleString('fr-FR')}
              </span>
            } />
            {user.tokenHistory.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>10 dernières transactions</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                        {['Date', 'Type', 'Montant', 'Description'].map(h => (
                          <th key={h} className="text-left py-1.5 pr-3 font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {user.tokenHistory.map(tx => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                          <td className="py-1.5 pr-3 whitespace-nowrap" style={{ color: 'var(--admin-muted-foreground)' }}>
                            {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="py-1.5 pr-3">{tx.type === 'purchase' ? 'Achat' : tx.type === 'consumption' ? 'Consommation' : tx.type}</td>
                          <td className="py-1.5 pr-3 font-medium tabular-nums" style={{ color: tx.type === 'consumption' ? 'var(--admin-destructive)' : 'var(--admin-success)' }}>
                            {tx.type === 'consumption' ? '−' : '+'}{Math.abs(tx.amount)}
                          </td>
                          <td className="py-1.5 truncate max-w-[120px]" style={{ color: 'var(--admin-muted-foreground)' }}>{tx.description ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>Aucune transaction</p>
            )}
          </Section>

          <Section title="Activité">
            <Row label="Dernière connexion" value={
              user.last_sign_in_at
                ? formatRelativeTime(user.last_sign_in_at)
                : 'Jamais'
            } />
          </Section>
        </div>
      </div>

      {/* Actions admin */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--admin-muted-foreground)' }}>Actions admin</h3>
        <div className="flex flex-wrap gap-3">
          <ActionBtn icon={<Zap size={15} />} label="Attribuer des jetons" onClick={() => setShowTokens(true)} />
          <ActionBtn icon={<CreditCard size={15} />} label="Changer de plan" onClick={() => setShowPlan(true)} />
          <ActionBtn icon={<Mail size={15} />} label="Envoyer un email" onClick={() => setShowEmail(true)} />
          {(user.is_banned || isDeleted) ? (
            <ActionBtn icon={<ShieldCheck size={15} />} label="Réactiver le compte" onClick={() => setShowSuspend(true)} />
          ) : (
            <ActionBtn icon={<Ban size={15} />} label="Suspendre le compte" onClick={() => setShowSuspend(true)} danger />
          )}
          {!isDeleted && (
            <ActionBtn icon={<Trash2 size={15} />} label="Supprimer le compte" onClick={() => setShowDelete(true)} danger />
          )}
        </div>
      </div>

      {/* Modal — Jetons */}
      <Dialog open={showTokens} onOpenChange={setShowTokens}>
        <DialogContent {...{ 'data-admin-theme': theme }} style={dialogStyle}>
          <DialogHeader><DialogTitle>Attribuer des jetons</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Montant (1–50)</Label>
              <input
                type="number" min="1" max="50"
                value={tokenAmount} onChange={e => setTokenAmount(e.target.value)}
                placeholder="ex : 10"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }}
              />
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
                <input
                  value={tokenMotifCustom} onChange={e => setTokenMotifCustom(e.target.value)}
                  placeholder="Précisez le motif…"
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none mt-2"
                  style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }}
                />
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
              onClick={() => run(
                () => addTokens(user.id, parseInt(tokenAmount), actualMotif),
                () => { setShowTokens(false); setTokenAmount(''); setTokenMotifKey(''); setTokenMotifCustom('') },
                'Jetons attribués avec succès.'
              )}>
              {busy ? 'En cours…' : 'Confirmer'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Plan */}
      <Dialog open={showPlan} onOpenChange={setShowPlan}>
        <DialogContent {...{ 'data-admin-theme': theme }} style={dialogStyle}>
          <DialogHeader><DialogTitle>Changer de plan</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <div className="space-y-1.5">
              <Label>Nouveau plan</Label>
              <select value={newPlan} onChange={e => setNewPlan(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm" style={selectStyle}>
                {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>Plan actuel : <strong>{user.plan}</strong></p>
            </div>

            {isUpgradeWithDates && (
              <>
                <div className="space-y-1.5">
                  <Label>Durée</Label>
                  <select value={planDuration} onChange={e => setPlanDuration(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm" style={selectStyle}>
                    {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Date de début</Label>
                    <input type="date" value={planStartDate} onChange={e => setPlanStartDate(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm" style={selectStyle} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date de fin</Label>
                    <div className="rounded-lg border px-3 py-2 text-sm" style={{ ...selectStyle, opacity: 0.6 }}>
                      {planEndDate || '—'}
                    </div>
                  </div>
                </div>
              </>
            )}

            {isDowngrade && downgradeEffectDate && (
              <div className="rounded-lg px-3 py-2.5 text-sm" style={{
                backgroundColor: 'rgba(245,158,11,0.08)', borderColor: '#F59E0B44',
                border: '1px solid #F59E0B44', color: '#F59E0B',
              }}>
                Prise d'effet le {new Date(downgradeEffectDate).toLocaleDateString('fr-FR')} (fin de la période en cours)
              </div>
            )}
          </div>
          <DialogFooter>
            <button className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}
              onClick={() => setShowPlan(false)}>Annuler</button>
            <button disabled={busy || newPlan === user.plan}
              className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
              onClick={() => run(
                () => changePlan(user.id, newPlan, isUpgradeWithDates ? planStartDate : undefined, isUpgradeWithDates ? planEndDate : (downgradeEffectDate ?? undefined)),
                () => setShowPlan(false),
                isDowngrade ? `Passage en ${newPlan} planifié.` : `Plan changé en ${newPlan}.`
              )}>
              {busy ? 'En cours…' : 'Confirmer'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Suspension / Réactivation */}
      <Dialog open={showSuspend} onOpenChange={setShowSuspend}>
        <DialogContent {...{ 'data-admin-theme': theme }} style={dialogStyle}>
          <DialogHeader>
            <DialogTitle>{user.is_banned ? 'Réactiver le compte' : 'Suspendre le compte'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm" style={{ color: 'var(--admin-foreground)' }}>
              {user.is_banned
                ? <>Êtes-vous sûr de vouloir réactiver le compte de <strong>{displayName}</strong> ?</>
                : <>Êtes-vous sûr de vouloir suspendre le compte de <strong>{displayName}</strong> ?</>
              }
            </p>
            {!user.is_banned && (
              <p className="text-sm mt-2" style={{ color: 'var(--admin-destructive)' }}>
                Cette action empêchera l'utilisateur de se connecter immédiatement.
              </p>
            )}
          </div>
          <DialogFooter>
            <button className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}
              onClick={() => setShowSuspend(false)}>Annuler</button>
            <button disabled={busy}
              className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: user.is_banned ? 'var(--admin-success)' : 'var(--admin-destructive)', color: '#fff' }}
              onClick={() => run(
                () => user.is_banned ? reactivateAccount(user.id) : suspendAccount(user.id),
                () => setShowSuspend(false),
                user.is_banned ? 'Compte réactivé.' : 'Compte suspendu.'
              )}>
              {busy ? 'En cours…' : user.is_banned ? 'Réactiver' : 'Suspendre'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Suppression douce */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent {...{ 'data-admin-theme': theme }} style={dialogStyle}>
          <DialogHeader>
            <DialogTitle>Supprimer le compte</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm" style={{ color: 'var(--admin-foreground)' }}>
              Êtes-vous sûr de vouloir supprimer le compte de <strong>{displayName}</strong> ?
            </p>
            <div className="rounded-lg px-3 py-2.5 text-sm" style={{
              backgroundColor: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.3)',
              color: 'var(--admin-destructive)',
            }}>
              Suppression douce — les données sont conservées. L'abonné ne pourra plus se connecter.
            </div>
          </div>
          <DialogFooter>
            <button className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}
              onClick={() => setShowDelete(false)}>Annuler</button>
            <button disabled={busy}
              className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--admin-destructive)', color: '#fff' }}
              onClick={() => run(
                () => deleteAccount(user.id),
                () => setShowDelete(false),
                'Compte supprimé.'
              )}>
              {busy ? 'En cours…' : 'Confirmer la suppression'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Email */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent {...{ 'data-admin-theme': theme }} style={dialogStyle}>
          <DialogHeader><DialogTitle>Envoyer un email</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Destinataire</Label>
              <p className="text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>{user.email}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Sujet</Label>
              <input
                value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                placeholder="Sujet de l'email…"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <textarea rows={4} value={emailMessage} onChange={e => setEmailMessage(e.target.value)}
                placeholder="Contenu du message…"
                className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none"
                style={{ backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }} />
            </div>
          </div>
          <DialogFooter>
            <button className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }}
              onClick={() => setShowEmail(false)}>Annuler</button>
            <button disabled={busy || !emailSubject || !emailMessage}
              className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
              onClick={() => run(
                () => sendAdminEmail(user.id, emailSubject, emailMessage),
                () => { setShowEmail(false); setEmailSubject(''); setEmailMessage('') },
                'Email envoyé avec succès.'
              )}>
              {busy ? 'Envoi…' : 'Envoyer'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-opacity hover:opacity-80"
      style={{
        borderColor: danger ? 'var(--admin-destructive)' : 'var(--admin-primary)',
        color: danger ? 'var(--admin-destructive)' : 'var(--admin-primary)',
      }}>
      {icon}{label}
    </button>
  )
}

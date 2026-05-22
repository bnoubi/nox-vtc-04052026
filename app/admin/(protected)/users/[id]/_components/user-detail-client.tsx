'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, CreditCard, Ban, Mail, TrendingDown } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addTokens, changePlan, suspendAccount, sendAdminEmail, type UserDetail } from '@/app/admin/actions'

const PLAN_LABELS: Record<string, string> = { SOLO: 'SOLO', TEAM: 'TEAM', ENTERPRISE: 'ENTERPRISE' }
const STATUS_COLORS: Record<string, string> = {
  active: 'var(--admin-success)', trialing: '#F59E0B', expired: 'var(--admin-destructive)',
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

interface Props { user: UserDetail }

export function UserDetailClient({ user }: Props) {
  const router = useRouter()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [showTokens, setShowTokens]   = useState(false)
  const [showPlan, setShowPlan]       = useState(false)
  const [showSuspend, setShowSuspend] = useState(false)
  const [showEmail, setShowEmail]     = useState(false)

  const [tokenAmount, setTokenAmount] = useState('')
  const [tokenMotif, setTokenMotif]   = useState('')
  const [newPlan, setNewPlan]         = useState(user.plan)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(t)
  }, [feedback])

  async function run<T>(fn: () => Promise<{ success: boolean; error?: string }>, onClose: () => void, successMsg: string) {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (res.success) {
      setFeedback({ type: 'success', message: successMsg })
      onClose()
      router.refresh()
    } else {
      setFeedback({ type: 'error', message: res.error ?? 'Erreur inconnue.' })
    }
  }

  const initials = (user.full_name ?? user.email).slice(0, 2).toUpperCase()
  const nameParts = `${user.prenom ?? ''} ${user.nom ?? ''}`.trim()
  const displayName = user.full_name ?? (nameParts || user.email)

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedback && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{
          backgroundColor: feedback.type === 'success' ? 'rgba(56,161,105,0.1)' : 'rgba(229,62,62,0.1)',
          color: feedback.type === 'success' ? 'var(--admin-success)' : 'var(--admin-destructive)',
          border: `1px solid ${feedback.type === 'success' ? 'var(--admin-success)' : 'var(--admin-destructive)'}44`,
        }}>
          {feedback.message}
        </div>
      )}

      {/* Deux colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne gauche — Informations */}
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
              </div>
            </div>
            <Row label="Date d'inscription" value={new Date(user.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} />
            <Row label="Statut onboarding" value={user.onboarding_status} />
            {user.phone && <Row label="Téléphone" value={user.phone} />}
          </Section>

          {user.profile && (
            <Section title="Profil entreprise">
              {user.profile.nom_entreprise && <Row label="Entreprise" value={user.profile.nom_entreprise} />}
              {user.profile.statut_juridique && <Row label="Statut juridique" value={user.profile.statut_juridique} />}
              {user.profile.telephone && <Row label="Téléphone pro" value={user.profile.telephone} />}
            </Section>
          )}
        </div>

        {/* Colonne droite — Abonnement et jetons */}
        <div className="space-y-4">
          <Section title="Abonnement">
            <Row label="Plan actuel" value={
              <span className="font-semibold" style={{ color: 'var(--admin-primary)' }}>{user.plan}</span>
            } />
            {user.subscription ? (
              <>
                <Row label="Statut" value={
                  <span style={{ color: STATUS_COLORS[user.subscription.status] ?? 'var(--admin-muted-foreground)' }}>
                    {user.subscription.status}
                  </span>
                } />
                {user.subscription.started_at && <Row label="Début" value={new Date(user.subscription.started_at).toLocaleDateString('fr-FR')} />}
                {user.subscription.ended_at && <Row label="Fin" value={new Date(user.subscription.ended_at).toLocaleDateString('fr-FR')} />}
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>Données d'abonnement indisponibles</p>
            )}
          </Section>

          <Section title="Jetons">
            <Row label="Solde actuel" value={
              <span className="text-lg font-bold" style={{ color: 'var(--admin-primary)' }}>
                {user.tokens.toLocaleString('fr-FR')}
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
                          <td className="py-1.5 pr-3 truncate max-w-[120px]" style={{ color: 'var(--admin-muted-foreground)' }}>{tx.description ?? '—'}</td>
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
        </div>
      </div>

      {/* Actions admin */}
      <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
        <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--admin-muted-foreground)' }}>Actions admin</h3>
        <div className="flex flex-wrap gap-3">
          <ActionBtn icon={<Zap size={15} />} label="Attribuer des jetons" onClick={() => setShowTokens(true)} />
          <ActionBtn icon={<CreditCard size={15} />} label="Changer de plan" onClick={() => setShowPlan(true)} />
          <ActionBtn icon={<Mail size={15} />} label="Envoyer un email" onClick={() => setShowEmail(true)} />
          <ActionBtn icon={<Ban size={15} />} label="Suspendre le compte" onClick={() => setShowSuspend(true)} danger />
        </div>
      </div>

      {/* Modal — Jetons */}
      <Dialog open={showTokens} onOpenChange={setShowTokens}>
        <DialogContent>
          <DialogHeader><DialogTitle>Attribuer des jetons</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Montant (1–10 000)</Label>
              <Input type="number" min="1" max="10000" value={tokenAmount} onChange={e => setTokenAmount(e.target.value)} placeholder="ex : 100" />
            </div>
            <div className="space-y-1.5">
              <Label>Motif</Label>
              <Input value={tokenMotif} onChange={e => setTokenMotif(e.target.value)} placeholder="Raison de l'attribution…" />
            </div>
          </div>
          <DialogFooter>
            <button className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }} onClick={() => setShowTokens(false)}>Annuler</button>
            <button disabled={busy || !tokenAmount || !tokenMotif} className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
              onClick={() => run(() => addTokens(user.id, parseInt(tokenAmount), tokenMotif), () => { setShowTokens(false); setTokenAmount(''); setTokenMotif('') }, 'Jetons attribués avec succès.')}>
              {busy ? 'En cours…' : 'Confirmer'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Plan */}
      <Dialog open={showPlan} onOpenChange={setShowPlan}>
        <DialogContent>
          <DialogHeader><DialogTitle>Changer de plan</DialogTitle></DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label>Nouveau plan</Label>
            <select value={newPlan} onChange={e => setNewPlan(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }}>
              {Object.keys(PLAN_LABELS).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>Plan actuel : <strong>{user.plan}</strong></p>
          </div>
          <DialogFooter>
            <button className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }} onClick={() => setShowPlan(false)}>Annuler</button>
            <button disabled={busy || newPlan === user.plan} className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
              onClick={() => run(() => changePlan(user.id, newPlan), () => setShowPlan(false), `Plan changé en ${newPlan}.`)}>
              {busy ? 'En cours…' : 'Confirmer'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Suspension */}
      <Dialog open={showSuspend} onOpenChange={setShowSuspend}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suspendre le compte</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-sm" style={{ color: 'var(--admin-foreground)' }}>
              Êtes-vous sûr de vouloir suspendre le compte de <strong>{displayName}</strong> ?
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--admin-destructive)' }}>
              Cette action empêchera l'utilisateur de se connecter immédiatement.
            </p>
          </div>
          <DialogFooter>
            <button className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }} onClick={() => setShowSuspend(false)}>Annuler</button>
            <button disabled={busy} className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--admin-destructive)', color: '#fff' }}
              onClick={() => run(() => suspendAccount(user.id), () => setShowSuspend(false), 'Compte suspendu.')}>
              {busy ? 'En cours…' : 'Suspendre'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Email */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent>
          <DialogHeader><DialogTitle>Envoyer un email</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Destinataire</Label>
              <p className="text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>{user.email}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Sujet</Label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Sujet de l'email…" />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <textarea rows={4} value={emailMessage} onChange={e => setEmailMessage(e.target.value)} placeholder="Contenu du message…"
                className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none"
                style={{ backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }} />
            </div>
          </div>
          <DialogFooter>
            <button className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-muted-foreground)' }} onClick={() => setShowEmail(false)}>Annuler</button>
            <button disabled={busy || !emailSubject || !emailMessage} className="text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }}
              onClick={() => run(() => sendAdminEmail(user.id, emailSubject, emailMessage), () => { setShowEmail(false); setEmailSubject(''); setEmailMessage('') }, 'Email envoyé avec succès.')}>
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

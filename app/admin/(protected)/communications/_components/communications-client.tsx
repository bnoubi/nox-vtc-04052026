'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckSquare, Square, Send, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react'
import { sendCommunication, type Recipient } from '../actions'

export interface SegmentUser {
  userId: string
  email: string
  fullName: string
  prenom: string
  phone: string | null
  contextual: string
  solde?: number
}

export interface CommunicationLog {
  id: string
  segment: string
  subject: string
  recipients_count: number
  sent_at: string
  mode: string
  status: string
}

export interface SegmentsData {
  inactifs15: SegmentUser[]
  inactifs30: SegmentUser[]
  inactifs45: SegmentUser[]
  jetonsEpuises: SegmentUser[]
  jetonsFaibles: SegmentUser[]
  aboExpires: SegmentUser[]
}

type SegmentKey = keyof SegmentsData

const SEGMENTS: { key: SegmentKey; label: string; color: string }[] = [
  { key: 'inactifs15',    label: 'Inactifs J+15',      color: 'text-yellow-400' },
  { key: 'inactifs30',    label: 'Inactifs J+30',      color: 'text-orange-400' },
  { key: 'inactifs45',    label: 'Inactifs J+45+',     color: 'text-red-400' },
  { key: 'jetonsEpuises', label: 'Jetons épuisés',     color: 'text-red-400' },
  { key: 'jetonsFaibles', label: 'Jetons faibles',     color: 'text-yellow-400' },
  { key: 'aboExpires',    label: 'Abonnements expirés', color: 'text-orange-400' },
]

const TEMPLATES: Record<SegmentKey, { subject: string; body: string }> = {
  inactifs15: {
    subject: 'NoX VTC vous attend !',
    body: 'Bonjour {prenom}, cela fait 2 semaines que nous ne vous avons pas vu. Votre espace NoX VTC est prêt et vos documents vous attendent. Reconnectez-vous dès maintenant !',
  },
  inactifs30: {
    subject: 'Votre activité VTC nous manque',
    body: "Bonjour {prenom}, un mois sans activité sur NoX VTC. N'oubliez pas que vos jetons n'expirent jamais et restent disponibles. Reprenez votre activité dès aujourd'hui !",
  },
  inactifs45: {
    subject: 'Offre spéciale - 30% de réduction',
    body: 'Bonjour {prenom}, nous souhaitons vous retrouver sur NoX VTC. Profitez de 30% de réduction sur vos prochains achats avec le code : RETOUR30 (placeholder). Offre valable 7 jours.',
  },
  jetonsEpuises: {
    subject: 'Rechargez vos jetons NoX VTC',
    body: 'Bonjour {prenom}, votre solde de jetons est épuisé. Rechargez dès maintenant pour continuer à générer vos bons de commande et factures en toute simplicité.',
  },
  jetonsFaibles: {
    subject: 'Votre solde de jetons est faible',
    body: 'Bonjour {prenom}, il vous reste seulement {solde} jetons. Pensez à recharger pour ne pas être bloqué dans votre activité.',
  },
  aboExpires: {
    subject: 'Réactivez votre abonnement NoX VTC',
    body: "Bonjour {prenom}, votre abonnement a expiré. Réactivez-le dès maintenant pour profiter de toutes les fonctionnalités NoX VTC sans limitation.",
  },
}

const SEGMENT_LABELS: Record<string, string> = {
  inactifs15: 'Inactifs J+15', inactifs30: 'Inactifs J+30', inactifs45: 'Inactifs J+45+',
  jetonsEpuises: 'Jetons épuisés', jetonsFaibles: 'Jetons faibles', aboExpires: 'Abonnements expirés',
}

const MODE_LABELS: Record<string, string> = { manual: 'Manuel', auto: 'Automatique' }
const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-green-500/20 text-green-400 border-green-500/30',
  partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
}
const STATUS_LABELS: Record<string, string> = { sent: 'Envoyé', partial: 'Partiel', failed: 'Échoué' }

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const card = { backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }
const inputStyle = { backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }

interface Props { segments: SegmentsData; logs: CommunicationLog[] }

export function CommunicationsClient({ segments, logs }: Props) {
  const router = useRouter()
  const [activeKey, setActiveKey] = useState<SegmentKey>('inactifs15')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [useTemplate, setUseTemplate] = useState(true)
  const [subject, setSubject] = useState(TEMPLATES.inactifs15.subject)
  const [body, setBody] = useState(TEMPLATES.inactifs15.body)
  const [preview, setPreview] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [isPending, startTransition] = useTransition()

  const users = segments[activeKey]

  useEffect(() => {
    setSelectedIds(new Set())
    if (useTemplate) {
      setSubject(TEMPLATES[activeKey].subject)
      setBody(TEMPLATES[activeKey].body)
    }
  }, [activeKey])

  useEffect(() => {
    if (useTemplate) {
      setSubject(TEMPLATES[activeKey].subject)
      setBody(TEMPLATES[activeKey].body)
    }
  }, [useTemplate])

  function toggleUser(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds(selectedIds.size === users.length ? new Set() : new Set(users.map(u => u.userId)))
  }

  const previewUser = users.find(u => selectedIds.has(u.userId)) ?? users[0]
  const previewBody = previewUser
    ? body.replace(/\{prenom\}/g, previewUser.prenom).replace(/\{solde\}/g, String(previewUser.solde ?? 0))
    : body

  function handleSend() {
    const recipients: Recipient[] = users
      .filter(u => selectedIds.has(u.userId))
      .map(u => ({ userId: u.userId, email: u.email, prenom: u.prenom, solde: u.solde }))

    if (!recipients.length) return

    startTransition(async () => {
      try {
        const { sent, failed } = await sendCommunication(recipients, subject, body, activeKey)
        toast.success(`${sent} email${sent > 1 ? 's' : ''} envoyé${sent > 1 ? 's' : ''} avec succès${failed > 0 ? ` (${failed} échec${failed > 1 ? 's' : ''})` : ''}`)
        setSelectedIds(new Set())
        router.refresh()
      } catch {
        toast.error("Erreur lors de l'envoi")
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SEGMENTS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveKey(s.key)}
            className="rounded-xl border p-3 text-left transition-all"
            style={activeKey === s.key
              ? { backgroundColor: 'rgba(197,160,89,0.1)', borderColor: '#C5A059' }
              : card}
          >
            <p className="text-[11px] font-medium truncate" style={{ color: 'var(--admin-muted-foreground)' }}>{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{segments[s.key].length}</p>
          </button>
        ))}
      </div>

      {/* Segment tabs */}
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveKey(s.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={activeKey === s.key
              ? { backgroundColor: 'var(--admin-primary)', color: '#0F0F0F' }
              : { backgroundColor: 'var(--admin-background)', color: 'var(--admin-muted-foreground)', border: '1px solid var(--admin-border)' }}
          >
            {s.label} ({segments[s.key].length})
          </button>
        ))}
      </div>

      {/* User list */}
      <div className="rounded-xl border overflow-hidden" style={card}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--admin-foreground)' }}>
            {SEGMENT_LABELS[activeKey]} — {users.length} abonné{users.length !== 1 ? 's' : ''}
          </span>
          {users.length > 0 && (
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: 'var(--admin-primary)' }}
            >
              {selectedIds.size === users.length ? <CheckSquare size={14} /> : <Square size={14} />}
              Tout sélectionner
            </button>
          )}
        </div>

        {users.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--admin-muted-foreground)' }}>
            Aucun abonné dans ce segment.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--admin-border)' }}>
            {users.map(u => (
              <div
                key={u.userId}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--admin-active-bg)] transition-colors"
                onClick={() => toggleUser(u.userId)}
              >
                <span className="shrink-0" style={{ color: selectedIds.has(u.userId) ? 'var(--admin-primary)' : 'var(--admin-muted-foreground)' }}>
                  {selectedIds.has(u.userId) ? <CheckSquare size={16} /> : <Square size={16} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--admin-foreground)' }}>{u.fullName || '—'}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--admin-muted-foreground)' }}>{u.email}</p>
                    {u.phone && <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{u.phone}</p>}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--admin-muted-foreground)' }}>{u.contextual}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send panel */}
      {selectedIds.size > 0 && (
        <div className="rounded-xl border p-4 space-y-4" style={{ backgroundColor: 'rgba(197,160,89,0.05)', borderColor: 'rgba(197,160,89,0.3)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#C5A059' }}>
              {selectedIds.size} abonné{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setUseTemplate(v => !v)}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors"
              style={useTemplate
                ? { backgroundColor: 'var(--admin-primary)', color: '#0F0F0F', borderColor: 'var(--admin-primary)' }
                : { color: 'var(--admin-muted-foreground)', borderColor: 'var(--admin-border)', backgroundColor: 'var(--admin-background)' }}
            >
              {useTemplate ? 'Template prédéfini' : 'Message libre'}
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>Sujet</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>
              Message <span className="font-normal opacity-60">(variables : {'{prenom}'}, {'{solde}'})</span>
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm resize-none"
              style={inputStyle}
            />
          </div>

          {/* Preview */}
          <div>
            <button
              onClick={() => setPreview(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium"
              style={{ color: 'var(--admin-muted-foreground)' }}
            >
              {preview ? <EyeOff size={13} /> : <Eye size={13} />}
              {preview ? 'Masquer la prévisualisation' : 'Prévisualiser'}
            </button>
            {preview && previewUser && (
              <div className="mt-2 rounded-lg border p-3 text-xs space-y-1" style={{ backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)' }}>
                <p style={{ color: 'var(--admin-muted-foreground)' }}>Pour : <span style={{ color: 'var(--admin-foreground)' }}>{previewUser.email}</span></p>
                <p style={{ color: 'var(--admin-muted-foreground)' }}>Sujet : <span style={{ color: 'var(--admin-foreground)' }}>{subject}</span></p>
                <hr style={{ borderColor: 'var(--admin-border)' }} />
                <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--admin-foreground)' }}>{previewBody}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={isPending || !subject.trim() || !body.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-black transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#C5A059' }}
          >
            <Send size={15} />
            {isPending ? 'Envoi en cours…' : `Envoyer à ${selectedIds.size} abonné${selectedIds.size > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border overflow-hidden" style={card}>
        <button
          onClick={() => setHistoryOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--admin-active-bg)] transition-colors"
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--admin-foreground)' }}>Historique des envois</span>
          {historyOpen ? <ChevronUp size={15} style={{ color: 'var(--admin-muted-foreground)' }} /> : <ChevronDown size={15} style={{ color: 'var(--admin-muted-foreground)' }} />}
        </button>
        {historyOpen && (
          <div className="border-t overflow-x-auto" style={{ borderColor: 'var(--admin-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                  {['Date', 'Segment', 'Sujet', 'Destinataires', 'Mode', 'Statut'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center px-4 py-10" style={{ color: 'var(--admin-muted-foreground)' }}>Aucun envoi enregistré.</td></tr>
                ) : logs.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{fmt(l.sent_at)}</td>
                    <td className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--admin-foreground)' }}>{SEGMENT_LABELS[l.segment] ?? l.segment}</td>
                    <td className="px-4 py-2.5 text-xs max-w-[200px] truncate" style={{ color: 'var(--admin-foreground)' }}>{l.subject}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-center" style={{ color: '#C5A059' }}>{l.recipients_count}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{MODE_LABELS[l.mode] ?? l.mode}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[l.status] ?? ''}`}>
                        {STATUS_LABELS[l.status] ?? l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

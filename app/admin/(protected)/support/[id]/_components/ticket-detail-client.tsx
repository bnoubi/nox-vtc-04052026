'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Send, Paperclip, User, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { updateTicketStatus, updateTicketPriority, sendAdminReply } from '../actions'

interface Message {
  role: 'user' | 'admin'
  content: string
  created_at: string
}

interface Ticket {
  id: string
  user_id: string
  subject: string
  subject_category: string
  subject_custom: string | null
  status: string
  priority: string
  messages: Message[]
  attachment_url: string | null
  created_at: string
}

interface UserInfo {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
}

const STATUS_OPTIONS = [
  { value: 'open',        label: 'En attente' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved',    label: 'Résolu' },
  { value: 'closed',      label: 'Fermé' },
]

const PRIORITY_OPTIONS = [
  { value: 'normal',  label: 'Normale' },
  { value: 'urgent',  label: 'Urgente' },
]

const STATUS_COLORS: Record<string, string> = {
  open:        'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  resolved:    'bg-green-500/20 text-green-400 border-green-500/30',
  closed:      'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
}

const PRIORITY_COLORS: Record<string, string> = {
  normal: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Badge({ text, colorClass }: { text: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}>
      {text}
    </span>
  )
}

interface Props {
  ticket: Ticket
  user: UserInfo | null
}

export function TicketDetailClient({ ticket, user }: Props) {
  const router = useRouter()
  const [statusValue, setStatusValue] = useState(ticket.status)
  const [priorityValue, setPriorityValue] = useState(ticket.priority)
  const [reply, setReply] = useState('')
  const [isPendingStatus, startStatus] = useTransition()
  const [isPendingPriority, startPriority] = useTransition()
  const [isPendingReply, startReply] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const statusLabel = STATUS_OPTIONS.find(s => s.value === ticket.status)?.label ?? ticket.status
  const priorityLabel = PRIORITY_OPTIONS.find(p => p.value === ticket.priority)?.label ?? ticket.priority

  function handleStatusUpdate() {
    startStatus(async () => {
      try {
        await updateTicketStatus(ticket.id, statusValue)
        toast.success('Statut mis à jour')
        router.refresh()
      } catch {
        toast.error('Erreur lors de la mise à jour du statut')
      }
    })
  }

  function handlePriorityUpdate() {
    startPriority(async () => {
      try {
        await updateTicketPriority(ticket.id, priorityValue)
        toast.success('Priorité mise à jour')
        router.refresh()
      } catch {
        toast.error('Erreur lors de la mise à jour de la priorité')
      }
    })
  }

  function handleReply() {
    if (!reply.trim()) return
    const userEmail = user?.email ?? ''
    if (!userEmail) { toast.error("Email de l'abonné introuvable"); return }
    startReply(async () => {
      try {
        await sendAdminReply(ticket.id, reply.trim(), userEmail, ticket.subject)
        toast.success('Réponse envoyée')
        setReply('')
        router.refresh()
      } catch {
        toast.error("Erreur lors de l'envoi de la réponse")
      }
    })
  }

  const cardStyle = {
    backgroundColor: 'var(--admin-card)',
    borderColor: 'var(--admin-border)',
  }

  const inputStyle = {
    backgroundColor: 'var(--admin-background)',
    borderColor: 'var(--admin-border)',
    color: 'var(--admin-foreground)',
  }

  const btnBase = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

      {/* ── Colonne gauche ── */}
      <div className="lg:col-span-2 space-y-4">

        {/* Abonné */}
        <div className="rounded-xl border p-4 space-y-3" style={cardStyle}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-muted-foreground)' }}>
            Abonné
          </p>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ backgroundColor: 'var(--admin-active-bg)', color: 'var(--admin-primary)' }}
            >
              {user?.full_name ? user.full_name.slice(0, 2).toUpperCase() : <User size={16} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--admin-foreground)' }}>
                {user?.full_name ?? '—'}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--admin-muted-foreground)' }}>
                {user?.email ?? '—'}
              </p>
            </div>
          </div>
          {user?.phone && (
            <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>
              Tél. : <span style={{ color: 'var(--admin-foreground)' }}>{user.phone}</span>
            </p>
          )}
          <Link
            href={`/admin/users/${ticket.user_id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--admin-primary)' }}
          >
            <ExternalLink size={12} />
            Voir le profil
          </Link>
        </div>

        {/* Infos ticket */}
        <div className="rounded-xl border p-4 space-y-2.5" style={cardStyle}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-muted-foreground)' }}>
            Informations
          </p>
          <Row label="Catégorie" value={ticket.subject_category} />
          {ticket.subject_custom && <Row label="Sujet personnalisé" value={ticket.subject_custom} />}
          <Row label="Créé le" value={fmt(ticket.created_at)} />
          <Row label="ID" value={ticket.id.slice(0, 8) + '…'} mono />
        </div>

        {/* Pièce jointe */}
        {ticket.attachment_url && (
          <div className="rounded-xl border p-4 space-y-2.5" style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-muted-foreground)' }}>
              Pièce jointe
            </p>
            {/\.(png|jpg|jpeg|gif|webp)$/i.test(ticket.attachment_url) && (
              <img
                src={ticket.attachment_url}
                alt="Pièce jointe"
                className="w-full rounded-lg object-cover max-h-48"
              />
            )}
            <a
              href={ticket.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: 'var(--admin-primary)' }}
            >
              <Paperclip size={12} />
              Télécharger le fichier
            </a>
          </div>
        )}

        {/* Actions : statut + priorité */}
        <div className="rounded-xl border p-4 space-y-4" style={cardStyle}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-muted-foreground)' }}>
            Actions
          </p>

          {/* Statut */}
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>Statut</label>
            <div className="flex gap-2">
              <select
                value={statusValue}
                onChange={e => setStatusValue(e.target.value)}
                className="flex-1 rounded-lg border px-2 py-1.5 text-sm"
                style={inputStyle}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={handleStatusUpdate}
                disabled={isPendingStatus || statusValue === ticket.status}
                className={`${btnBase} text-black`}
                style={{ backgroundColor: 'var(--admin-primary)' }}
              >
                {isPendingStatus ? '…' : 'Mettre à jour'}
              </button>
            </div>
          </div>

          {/* Priorité */}
          <div className="space-y-1.5">
            <label className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>Priorité</label>
            <div className="flex gap-2">
              <select
                value={priorityValue}
                onChange={e => setPriorityValue(e.target.value)}
                className="flex-1 rounded-lg border px-2 py-1.5 text-sm"
                style={inputStyle}
              >
                {PRIORITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={handlePriorityUpdate}
                disabled={isPendingPriority || priorityValue === ticket.priority}
                className={`${btnBase} text-black`}
                style={{ backgroundColor: 'var(--admin-primary)' }}
              >
                {isPendingPriority ? '…' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Colonne droite ── */}
      <div className="lg:col-span-3 space-y-4">

        {/* En-tête ticket */}
        <div className="rounded-xl border p-4" style={cardStyle}>
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold leading-snug" style={{ color: 'var(--admin-foreground)' }}>
                {ticket.subject}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                text={statusLabel}
                colorClass={STATUS_COLORS[ticket.status] ?? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}
              />
              <Badge
                text={priorityLabel}
                colorClass={PRIORITY_COLORS[ticket.priority] ?? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}
              />
            </div>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--admin-muted-foreground)' }}>
            {fmt(ticket.created_at)}
          </p>
        </div>

        {/* Messages */}
        <div className="rounded-xl border p-4 space-y-3" style={cardStyle}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-muted-foreground)' }}>
            Historique des messages
          </p>

          {ticket.messages.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--admin-muted-foreground)' }}>
              Aucun message dans ce ticket.
            </p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {ticket.messages.map((msg, i) => {
                const isUser = msg.role === 'user'
                return (
                  <div key={i} className={`flex flex-col gap-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={isUser ? {
                        backgroundColor: 'rgba(197,160,89,0.12)',
                        color: 'var(--admin-foreground)',
                        border: '1px solid rgba(197,160,89,0.25)',
                      } : {
                        backgroundColor: 'var(--admin-background)',
                        color: 'var(--admin-foreground)',
                        border: '1px solid var(--admin-border)',
                      }}
                    >
                      {msg.content}
                    </div>
                    <p className="text-[10px] px-1" style={{ color: 'var(--admin-muted-foreground)' }}>
                      {isUser ? 'Abonné' : 'Admin'} · {fmt(msg.created_at)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Répondre */}
        <div className="rounded-xl border p-4 space-y-3" style={cardStyle}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-muted-foreground)' }}>
            Répondre
          </p>
          <textarea
            ref={textareaRef}
            rows={4}
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Votre réponse…"
            className="w-full rounded-lg border px-3 py-2.5 text-sm resize-none"
            style={inputStyle}
          />
          <div className="flex justify-end">
            <button
              onClick={handleReply}
              disabled={isPendingReply || !reply.trim()}
              className={`${btnBase} flex items-center gap-2 text-black`}
              style={{ backgroundColor: 'var(--admin-primary)' }}
            >
              <Send size={14} />
              {isPendingReply ? 'Envoi…' : 'Envoyer la réponse'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="shrink-0 w-32 text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{label}</span>
      <span className={mono ? 'font-mono text-xs' : ''} style={{ color: 'var(--admin-foreground)' }}>{value}</span>
    </div>
  )
}

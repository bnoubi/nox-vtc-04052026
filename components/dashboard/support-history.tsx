"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, Paperclip, Clock, CheckCircle, XCircle, AlertCircle, Loader2, MessageSquare } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Message {
  role: "user" | "admin"
  content: string
  created_at: string
}

interface Ticket {
  id: string
  created_at: string
  subject: string
  status: "open" | "in_progress" | "resolved" | "closed"
  messages: Message[]
  attachment_url: string | null
}

const STATUS_MAP: Record<Ticket["status"], { label: string; color: string }> = {
  open:        { label: "En attente",  color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  in_progress: { label: "En cours",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  resolved:    { label: "Résolu",     color: "bg-green-500/20 text-green-400 border-green-500/30" },
  closed:      { label: "Fermé",      color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).replace(" à", " à")
}

function StatusBadge({ status }: { status: Ticket["status"] }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.open
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.color}`}>
      {s.label}
    </span>
  )
}

function TicketDetailModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-onyx-border/50 overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Handle bar mobile */}
          <div className="flex justify-center pt-3 sm:hidden shrink-0">
            <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-4 pb-3 shrink-0">
            <div className="flex-1 pr-3">
              <h2 className="text-sm font-bold text-foreground leading-snug">{ticket.subject}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(ticket.created_at)}</p>
              <div className="mt-1.5">
                <StatusBadge status={ticket.status} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors shrink-0"
            >
              <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </button>
          </div>

          <div className="mx-5 h-px bg-onyx-border/30 shrink-0" />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {ticket.messages.map((msg, i) => {
              const isUser = msg.role === "user"
              return (
                <div key={i} className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? "bg-[#C5A059]/20 text-foreground rounded-br-sm border border-[#C5A059]/30"
                        : "bg-onyx-card text-foreground rounded-bl-sm border border-onyx-border/40"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 px-1">
                    {formatDate(msg.created_at)}
                  </p>
                </div>
              )
            })}

            {ticket.attachment_url && (
              <div className="flex justify-end mt-2">
                <a
                  href={ticket.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#C5A059] text-xs font-medium hover:bg-[#C5A059]/20 transition-colors"
                >
                  <Paperclip className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Voir la pièce jointe
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 shrink-0 border-t border-onyx-border/30">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white"
              style={{ backgroundColor: "#C5A059" }}
            >
              Fermer
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

interface SupportHistoryProps {
  isOpen: boolean
  onClose: () => void
}

export function SupportHistory({ isOpen, onClose }: SupportHistoryProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Ticket | null>(null)

  useEffect(() => {
    if (!isOpen) return
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from("support_tickets")
        .select("id, created_at, subject, status, messages, attachment_url")
        .order("created_at", { ascending: false })
      setTickets((data as Ticket[]) ?? [])
      setLoading(false)
    }
    load()
  }, [isOpen])

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-onyx-border/50 overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Handle bar mobile */}
              <div className="flex justify-center pt-3 sm:hidden shrink-0">
                <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-gold" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Mes demandes</h2>
                    <p className="text-[10px] text-muted-foreground">Historique de vos tickets support</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
                >
                  <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                </button>
              </div>

              <div className="mx-5 h-px bg-onyx-border/30 shrink-0" />

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 text-gold animate-spin" strokeWidth={1.5} />
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-onyx-card border border-onyx-border/40 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-muted-foreground/50" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Vous n'avez pas encore de demande de support.
                    </p>
                  </div>
                ) : (
                  tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="rounded-2xl bg-onyx-card border border-onyx-border/40 px-4 py-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground leading-snug flex-1">{ticket.subject}</p>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <p className="text-[10px] text-muted-foreground/70">
                        {formatDate(ticket.created_at)}
                      </p>
                      <button
                        onClick={() => setSelected(ticket)}
                        className="w-full py-2 rounded-xl text-xs font-semibold border border-[#C5A059]/40 text-[#C5A059] hover:bg-[#C5A059]/10 transition-colors"
                      >
                        Voir les détails
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {selected && (
        <TicketDetailModal ticket={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}

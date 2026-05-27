"use client"

import { useState, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, MessageSquare, Paperclip, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

interface SupportTicketModalProps {
  isOpen: boolean
  onClose: () => void
}

const CATEGORIES = [
  "Problème technique",
  "Question sur mon abonnement",
  "Question sur mes jetons",
  "Problème avec un document (BC/Facture)",
  "Incohérence visuelle observée",
  "Autre",
] as const

type Category = (typeof CATEGORIES)[number]

export function SupportTicketModal({ isOpen, onClose }: SupportTicketModalProps) {
  const [category, setCategory] = useState<Category | "">("")
  const [subjectCustom, setSubjectCustom] = useState("")
  const [message, setMessage] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setCategory("")
    setSubjectCustom("")
    setMessage("")
    setAttachment(null)
    setSuccess(false)
    setError(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Format non accepté. Utilisez JPG ou PNG.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Fichier trop volumineux (max 5 Mo).")
      return
    }
    setError(null)
    setAttachment(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category || !message.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Non authentifié")

      let attachmentUrl: string | null = null

      if (attachment) {
        const ext = attachment.name.split(".").pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("support-attachments")
          .upload(path, attachment)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from("support-attachments")
          .getPublicUrl(path)
        attachmentUrl = urlData.publicUrl
      }

      const subject =
        category === "Autre"
          ? subjectCustom.trim() || "Autre"
          : category

      const { error: insertError } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subject,
        subject_category: category,
        subject_custom: category === "Autre" ? subjectCustom.trim() || null : null,
        status: "open",
        priority: "normal",
        messages: [
          {
            role: "user",
            content: message.trim(),
            created_at: new Date().toISOString(),
          },
        ],
        attachment_url: attachmentUrl,
      })

      if (insertError) throw insertError

      setSuccess(true)
      setTimeout(() => {
        onClose()
        setTimeout(resetForm, 300)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.")
    } finally {
      setSubmitting(false)
    }
  }

  const isAutre = category === "Autre"
  const canSubmit = !submitting && category !== "" && message.trim().length > 0

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={!submitting ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-onyx-border/50 overflow-hidden max-h-[90vh]"
          >
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-gold" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Contacter le support</h2>
                  <p className="text-[10px] text-muted-foreground">Nous vous répondons rapidement</p>
                </div>
              </div>
              <button
                onClick={!submitting ? onClose : undefined}
                disabled={submitting}
                className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
              </button>
            </div>

            {/* Divider */}
            <div className="mx-5 h-px bg-onyx-border/30" />

            {/* Success state */}
            {success ? (
              <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-gold" strokeWidth={1.5} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">
                    Votre message a bien été envoyé. Merci.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Nous analysons le problème et revenons très vite vers vous.
                  </p>
                </div>
              </div>
            ) : (
              /* Form */
              <form
                onSubmit={handleSubmit}
                className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]"
              >
                {/* Category */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Sujet *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as Category | "")
                      setSubjectCustom("")
                    }}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors"
                  >
                    <option value="" disabled>
                      Sélectionnez un sujet...
                    </option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject custom — visible uniquement si "Autre" */}
                <AnimatePresence>
                  {isAutre && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Précisez votre sujet
                      </label>
                      <input
                        type="text"
                        value={subjectCustom}
                        onChange={(e) => setSubjectCustom(e.target.value)}
                        placeholder="Décrivez votre sujet"
                        className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Message */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Message *
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Décrivez votre problème en détail..."
                    required
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors resize-none"
                  />
                </div>

                {/* Attachment */}
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Capture d'écran (optionnel)
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed text-sm transition-all",
                      attachment
                        ? "bg-gold/5 border-gold/40 text-gold"
                        : "bg-onyx-card border-onyx-border/50 text-muted-foreground hover:border-gold/30 hover:text-foreground"
                    )}
                  >
                    <Paperclip className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span className="truncate">
                      {attachment ? attachment.name : "Joindre une capture d'écran"}
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <p className="mt-1.5 text-[10px] text-muted-foreground/70 leading-relaxed">
                    Une capture d'écran nous aide à résoudre votre problème plus rapidement.
                    Format accepté : JPG, PNG (max 5 Mo).
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    "w-full py-3.5 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                    canSubmit
                      ? "bg-gold text-primary-foreground hover:bg-gold-light active:scale-[0.98] gold-glow-sm"
                      : "bg-onyx-card text-muted-foreground border border-onyx-border/50 cursor-not-allowed"
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                      Envoi en cours...
                    </>
                  ) : (
                    "Envoyer le message"
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

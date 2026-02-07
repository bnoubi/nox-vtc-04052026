"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, UserRoundPlus } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddClientModalProps {
  open: boolean
  onClose: () => void
}

export function AddClientModal({ open, onClose }: AddClientModalProps) {
  const [form, setForm] = useState({
    civilite: "M.",
    nom: "",
    prenom: "",
    phone: "",
    email: "",
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onClose()
    setForm({ civilite: "M.", nom: "", prenom: "", phone: "", email: "" })
  }

  return (
    <AnimatePresence>
      {open && (
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
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-onyx-border/50 overflow-hidden"
          >
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                  <UserRoundPlus className="h-4 w-4 text-gold" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Nouveau Client
                  </h2>
                  <p className="text-[10px] text-muted-foreground">
                    Ajouter au répertoire CRM
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
              >
                <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
              </button>
            </div>

            {/* Divider */}
            <div className="mx-5 h-px bg-onyx-border/30" />

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Civilité */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Civilité
                </label>
                <div className="flex gap-2">
                  {["M.", "Mme"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, civilite: c }))}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all",
                        form.civilite === c
                          ? "bg-gold/15 border-gold/40 text-gold"
                          : "bg-onyx-card border-onyx-border/50 text-muted-foreground"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nom & Prénom */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Nom
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nom}
                    onChange={(e) => setForm((prev) => ({ ...prev, nom: e.target.value }))}
                    placeholder="Laurent"
                    className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Prénom
                  </label>
                  <input
                    type="text"
                    required
                    value={form.prenom}
                    onChange={(e) => setForm((prev) => ({ ...prev, prenom: e.target.value }))}
                    placeholder="Alexandre"
                    className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                  />
                </div>
              </div>

              {/* Téléphone */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Téléphone
                </label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+33 6 12 34 56 78"
                  className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="client@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-gold text-primary-foreground text-sm font-bold hover:bg-gold-light active:scale-[0.98] transition-all gold-glow-sm"
              >
                Enregistrer
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

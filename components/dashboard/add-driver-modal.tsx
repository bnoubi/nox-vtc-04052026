"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  X,
  UserPlus,
  User,
  Phone,
  Mail,
  FileText,
  Calendar,
  Globe,
  Shield,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PhoneInput } from "@/components/ui/phone-input"

function getExpirationStatus(dateStr: string): { label: string; cls: string } {
  if (!dateStr) return { label: "", cls: "" }
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: "Expiré", cls: "bg-red-500/15 text-red-400 border-red-500/25" }
  if (diff <= 30) return { label: `${diff}j`, cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" }
  return { label: "OK", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" }
}

const LANGUAGES = ["Français", "Anglais", "Arabe", "Espagnol", "Portugais", "Mandarin"]

interface AddDriverModalProps {
  open: boolean
  onClose: () => void
}

export function AddDriverModal({ open, onClose }: AddDriverModalProps) {
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    phone: "",
    email: "",
    langues: ["Français"] as string[],
    carteVTC: "",
    dateCarteVTC: "",
    permis: "",
    datePermis: "",
    dateVisite: "",
  })

  function update(key: string, value: string | string[]) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  function toggleLang(lang: string) {
    setForm((p) => ({
      ...p,
      langues: p.langues.includes(lang)
        ? p.langues.filter((l) => l !== lang)
        : [...p.langues, lang],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
      setForm({
        nom: "", prenom: "", phone: "", email: "",
        langues: ["Français"], carteVTC: "", dateCarteVTC: "",
        permis: "", datePermis: "", dateVisite: "",
      })
    }, 1400)
  }

  const carteStatus = getExpirationStatus(form.dateCarteVTC)
  const permisStatus = getExpirationStatus(form.datePermis)
  const visiteStatus = getExpirationStatus(form.dateVisite)

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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="relative w-full max-w-md max-h-[92vh] bg-background rounded-t-3xl sm:rounded-3xl border border-onyx-border/50 flex flex-col overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 sm:hidden shrink-0">
              <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-2.5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                  <UserPlus className="h-4 w-4 text-gold" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Nouveau Chauffeur</h2>
                  <p className="text-[10px] text-muted-foreground">Ajouter un membre à l&apos;équipe</p>
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

            {/* Scrollable Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* ── Identité ── */}
              <fieldset>
                <legend className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                  <User className="h-3 w-3" strokeWidth={1.5} />
                  Identité
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nom"
                    value={form.nom}
                    onChange={(e) => update("nom", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Prénom"
                    value={form.prenom}
                    onChange={(e) => update("prenom", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <PhoneInput
                      value={form.phone}
                      onChange={(v) => update("phone", v)}
                      required
                      fieldCls="bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                    <input
                      type="email"
                      placeholder="Email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                    />
                  </div>
                </div>
              </fieldset>

              {/* ── Langues ── */}
              <fieldset>
                <legend className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                  <Globe className="h-3 w-3" strokeWidth={1.5} />
                  Langues parlées
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((lang) => {
                    const active = form.langues.includes(lang)
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLang(lang)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all active:scale-95",
                          active
                            ? "bg-gold/15 border-gold/40 text-gold"
                            : "bg-onyx-card border-onyx-border/50 text-muted-foreground hover:border-gold/20"
                        )}
                      >
                        {lang}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              {/* ── Documents administratifs ── */}
              <fieldset>
                <legend className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                  <Shield className="h-3 w-3" strokeWidth={1.5} />
                  Documents & Conformité
                </legend>
                <div className="space-y-2">
                  {/* Carte VTC */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                      <FileText className="h-3 w-3 text-gold" strokeWidth={1.5} />
                    </div>
                    <input
                      type="text"
                      placeholder="N° Carte VTC"
                      value={form.carteVTC}
                      onChange={(e) => update("carteVTC", e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-onyx-card border border-onyx-border/50 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0",
                      carteStatus.label === "Expiré" ? "bg-red-500/10 border-red-500/20" : "bg-gold/10 border-gold/20"
                    )}>
                      <Calendar className={cn("h-3 w-3", carteStatus.label === "Expiré" ? "text-red-400" : "text-gold")} strokeWidth={1.5} />
                    </div>
                    <input
                      type="date"
                      value={form.dateCarteVTC}
                      onChange={(e) => update("dateCarteVTC", e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors [color-scheme:dark]"
                    />
                    {carteStatus.label && (
                      <span className={cn("px-1.5 py-0.5 text-[8px] font-bold rounded border shrink-0", carteStatus.cls)}>
                        {carteStatus.label}
                      </span>
                    )}
                  </div>

                  {/* Permis */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                      <FileText className="h-3 w-3 text-gold" strokeWidth={1.5} />
                    </div>
                    <input
                      type="text"
                      placeholder="N° Permis de conduire"
                      value={form.permis}
                      onChange={(e) => update("permis", e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-onyx-card border border-onyx-border/50 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0",
                      permisStatus.label === "Expiré" ? "bg-red-500/10 border-red-500/20" : "bg-gold/10 border-gold/20"
                    )}>
                      <Calendar className={cn("h-3 w-3", permisStatus.label === "Expiré" ? "text-red-400" : "text-gold")} strokeWidth={1.5} />
                    </div>
                    <input
                      type="date"
                      value={form.datePermis}
                      onChange={(e) => update("datePermis", e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors [color-scheme:dark]"
                    />
                    {permisStatus.label && (
                      <span className={cn("px-1.5 py-0.5 text-[8px] font-bold rounded border shrink-0", permisStatus.cls)}>
                        {permisStatus.label}
                      </span>
                    )}
                  </div>

                  {/* Visite médicale */}
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0",
                      visiteStatus.label === "Expiré" ? "bg-red-500/10 border-red-500/20" : "bg-gold/10 border-gold/20"
                    )}>
                      <Calendar className={cn("h-3 w-3", visiteStatus.label === "Expiré" ? "text-red-400" : "text-gold")} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] text-muted-foreground mb-0.5">Visite médicale</p>
                      <input
                        type="date"
                        value={form.dateVisite}
                        onChange={(e) => update("dateVisite", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors [color-scheme:dark]"
                      />
                    </div>
                    {visiteStatus.label && (
                      <span className={cn("px-1.5 py-0.5 text-[8px] font-bold rounded border shrink-0 mt-3", visiteStatus.cls)}>
                        {visiteStatus.label}
                      </span>
                    )}
                  </div>
                </div>
              </fieldset>

              {/* Submit */}
              <button
                type="submit"
                disabled={saved}
                className={cn(
                  "w-full py-3 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2",
                  saved
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                    : "bg-gold text-primary-foreground hover:bg-gold-light gold-glow-sm"
                )}
              >
                {saved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                    Chauffeur ajouté
                  </>
                ) : (
                  "Enregistrer le chauffeur"
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

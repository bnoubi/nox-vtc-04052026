"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  MapPin,
  Calendar,
  Clock,
  Send,
  Shield,
  ChevronDown,
  User,
  Phone,
  Mail,
  StickyNote,
  CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
}

export function ReservationForm() {
  const [mounted, setMounted] = useState(false)
  const [civilite, setCivilite] = useState<"Mme" | "M.">("M.")
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    tel: "",
    email: "",
    depart: "",
    destination: "",
    date: "",
    heure: "",
    notes: "",
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit() {
    setSubmitted(true)
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center mb-6 gold-glow">
            <CheckCircle className="h-10 w-10 text-gold" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Demande envoyée
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
            Votre chauffeur recevra instantanément votre demande. Vous serez
            contacté sous peu pour confirmer la disponibilité et le tarif.
          </p>
          <div className="mt-8 flex items-center gap-2 text-gold/60">
            <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="text-[10px] font-medium tracking-wider uppercase">
              Sécurisé par NoX Shield
            </span>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background pb-10">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="sticky top-0 z-30 bg-[#0F0F0F]/95 backdrop-blur-xl border-b border-onyx-border/30 px-5 pt-12 pb-5"
        >
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
              <span className="text-base font-black text-gold tracking-tight">
                X
              </span>
            </div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Ma Réservation NoX
            </h1>
          </div>
          <p className="text-[11px] text-muted-foreground tracking-wide pl-12">
            Service de transport privé d{"'"}exception
          </p>
        </motion.header>

        <div className="px-5 pt-6 space-y-6">
          {/* Section 1: Coordonnées */}
          <motion.section
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <SectionHeader number="1" title="Vos coordonnées" />

            <div className="mt-4 space-y-3">
              {/* Civilité toggle */}
              <div className="flex gap-2">
                {(["M.", "Mme"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCivilite(c)}
                    className={cn(
                      "flex-1 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 border",
                      civilite === c
                        ? "bg-gold text-primary-foreground border-gold gold-glow-sm"
                        : "bg-onyx-card text-muted-foreground border-onyx-border/50 hover:border-gold/30"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <FormInput
                  icon={<User className="h-4 w-4" strokeWidth={1.5} />}
                  placeholder="Prénom"
                  value={form.prenom}
                  onChange={(v) => update("prenom", v)}
                />
                <FormInput
                  placeholder="Nom"
                  value={form.nom}
                  onChange={(v) => update("nom", v)}
                />
              </div>

              <FormInput
                icon={<Phone className="h-4 w-4" strokeWidth={1.5} />}
                placeholder="Téléphone"
                type="tel"
                value={form.tel}
                onChange={(v) => update("tel", v)}
              />
              <FormInput
                icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(v) => update("email", v)}
              />
            </div>
          </motion.section>

          {/* Section 2: Trajet */}
          <motion.section
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <SectionHeader number="2" title="Votre trajet" />

            <div className="mt-4">
              {/* Route with gold dotted line */}
              <div className="relative">
                {/* Gold dotted connector */}
                <div className="absolute left-[21px] top-[52px] bottom-[52px] w-px border-l border-dashed border-gold/40" />

                <div className="space-y-3">
                  {/* Départ */}
                  <div className="flex items-center gap-3">
                    <div className="w-[42px] h-[42px] rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0 z-10">
                      <MapPin
                        className="h-4 w-4 text-gold"
                        strokeWidth={1.5}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Lieu de prise en charge"
                      value={form.depart}
                      onChange={(e) => update("depart", e.target.value)}
                      className="flex-1 bg-onyx-card border border-onyx-border/50 rounded-2xl px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all"
                    />
                  </div>

                  {/* Destination */}
                  <div className="flex items-center gap-3">
                    <div className="w-[42px] h-[42px] rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0 z-10">
                      <MapPin
                        className="h-4 w-4 text-gold/70"
                        strokeWidth={1.5}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Destination"
                      value={form.destination}
                      onChange={(e) => update("destination", e.target.value)}
                      className="flex-1 bg-onyx-card border border-onyx-border/50 rounded-2xl px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/60 pointer-events-none z-10">
                    <Calendar className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => update("date", e.target.value)}
                    className="w-full bg-onyx-card border border-onyx-border/50 rounded-2xl pl-11 pr-3 py-3.5 text-sm text-foreground focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all appearance-none [color-scheme:dark]"
                  />
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/60 pointer-events-none z-10">
                    <Clock className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <input
                    type="time"
                    value={form.heure}
                    onChange={(e) => update("heure", e.target.value)}
                    className="w-full bg-onyx-card border border-onyx-border/50 rounded-2xl pl-11 pr-3 py-3.5 text-sm text-foreground focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all appearance-none [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
          </motion.section>

          {/* Section 3: Confort */}
          <motion.section
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <SectionHeader number="3" title="Votre confort" />

            <div className="mt-4">
              <div className="relative">
                <div className="absolute left-4 top-4 text-gold/50 pointer-events-none">
                  <StickyNote className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <textarea
                  rows={4}
                  placeholder="Besoin d'un siège bébé, d'une boisson fraîche ou d'un accueil pancarte ? Précisez-le ici..."
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  className="w-full bg-onyx-card border border-onyx-border/50 rounded-2xl pl-11 pr-4 pt-3.5 pb-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all resize-none leading-relaxed"
                />
              </div>
            </div>
          </motion.section>

          {/* Submit */}
          <motion.section
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="pt-2 pb-4"
          >
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full py-4 rounded-2xl bg-gold text-primary-foreground font-bold text-[15px] tracking-tight hover:bg-gold-light active:scale-[0.98] transition-all gold-glow flex items-center justify-center gap-2.5"
            >
              <Send className="h-4 w-4" strokeWidth={2} />
              Envoyer ma demande de trajet
            </button>

            <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed mt-4 px-2">
              Votre chauffeur recevra instantanément votre demande pour valider
              la disponibilité et le tarif.
            </p>

            {/* Trust badge */}
            <div className="flex items-center justify-center gap-2 mt-6 pt-5 border-t border-onyx-border/20">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-onyx-card/60 border border-onyx-border/30">
                <Shield
                  className="h-3.5 w-3.5 text-gold/60"
                  strokeWidth={1.5}
                />
                <span className="text-[10px] font-medium text-gold/60 tracking-wider uppercase">
                  Sécurisé par NoX Shield
                </span>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  )
}

/* ── Reusable sub-components ───────────────────────────── */

function SectionHeader({
  number,
  title,
}: {
  number: string
  title: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/25 flex items-center justify-center">
        <span className="text-[11px] font-bold text-gold">{number}</span>
      </div>
      <h2 className="text-sm font-semibold text-foreground tracking-tight">
        {title}
      </h2>
      <div className="flex-1 h-px bg-onyx-border/30 ml-2" />
    </div>
  )
}

function FormInput({
  icon,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  icon?: React.ReactNode
  placeholder: string
  type?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50 pointer-events-none">
          {icon}
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full bg-onyx-card border border-onyx-border/50 rounded-2xl pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all",
          icon ? "pl-11" : "pl-4"
        )}
      />
    </div>
  )
}

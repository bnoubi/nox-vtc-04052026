"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Edit3,
  Share2,
  X,
  FileText,
  ChevronLeft,
  ChevronDown,
  Search,
  UserRoundPlus,
  MapPin,
  Clock,
  CalendarDays,
  Car,
  User,
  StickyNote,
  CircleDot,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePlan } from "./plan-context"
import { allDrivers, allVehicles, existingClients } from "./data"

// ── Types ─────────────────────────────────────────────────────

interface CreateBCProps {
  open: boolean
  onClose: () => void
}

type BCStep = "choose" | "manual"

// ── Bottom Sheet : Choose method ──────────────────────────────

function ChooseMethodSheet({
  onManual,
  onLink,
  onClose,
}: {
  onManual: () => void
  onLink: () => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-full max-w-md bg-background rounded-t-3xl border-t border-x border-onyx-border/50 overflow-hidden"
      >
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
        </div>

        <div className="px-5 pt-4 pb-2">
          <h2 className="text-base font-bold text-foreground">
            Nouveau Bon de Commande
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Choisissez votre méthode de création
          </p>
        </div>

        <div className="px-5 pb-6 space-y-2.5">
          <button
            onClick={onManual}
            className="flex items-center gap-3.5 w-full p-4 rounded-2xl bg-onyx-card border border-gold/20 hover:border-gold/40 hover:gold-glow-sm active:scale-[0.98] transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
              <Edit3 className="h-5 w-5 text-gold" strokeWidth={1.5} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                Saisie Manuelle
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Remplir le formulaire complet
              </p>
            </div>
          </button>

          <button
            onClick={onLink}
            className="flex items-center gap-3.5 w-full p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-onyx-border active:scale-[0.98] transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Share2
                className="h-5 w-5 text-muted-foreground"
                strokeWidth={1.5}
              />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                Envoyer un lien de réservation
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Le client remplit ses informations
              </p>
            </div>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Dropdown Select ───────────────────────────────────────────

function SelectField({
  label,
  icon,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string
  icon: React.ReactNode
  placeholder: string
  options: { value: string; label: string; sub?: string }[]
  value: string
  onChange: (val: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        {icon}
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-xl bg-onyx-card border text-sm transition-colors text-left",
          isOpen
            ? "border-gold/40"
            : "border-onyx-border/50 hover:border-onyx-border",
        )}
      >
        <span
          className={
            selected ? "text-foreground" : "text-muted-foreground/50"
          }
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
          strokeWidth={1.5}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 z-20 mt-1 py-1 rounded-xl bg-onyx-card border border-onyx-border/50 shadow-2xl shadow-black/60 max-h-48 overflow-y-auto scrollbar-hide"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-secondary/30 transition-colors",
                  value === option.value && "bg-gold/5",
                )}
              >
                <div>
                  <p
                    className={cn(
                      "text-sm",
                      value === option.value
                        ? "text-gold font-medium"
                        : "text-foreground",
                    )}
                  >
                    {option.label}
                  </p>
                  {option.sub && (
                    <p className="text-[10px] text-muted-foreground">
                      {option.sub}
                    </p>
                  )}
                </div>
                {value === option.value && (
                  <Check
                    className="h-3.5 w-3.5 text-gold shrink-0"
                    strokeWidth={2}
                  />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Full-Screen Manual Form ───────────────────────────────────

function ManualBCForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { plan } = usePlan()
  const isGold = plan === "GOLD"
  const PRO_LIMIT = 2

  const driverOptions = (isGold ? allDrivers : allDrivers.slice(0, PRO_LIMIT))
    .filter((d) => d.online)
    .map((d) => ({ value: d.id, label: d.name, sub: "En ligne" }))

  const vehicleOptions = (isGold ? allVehicles : allVehicles.slice(0, PRO_LIMIT))
    .filter((v) => v.inService)
    .map((v) => ({ value: v.id, label: v.model, sub: v.plate }))

  const clientOptions = existingClients.map((c) => ({
    value: c.id,
    label: `${c.title} ${c.name}`,
    sub: c.phone,
  }))

  const [form, setForm] = useState({
    clientMode: "existing" as "existing" | "new",
    clientId: "",
    civilite: "M.",
    nom: "",
    prenom: "",
    tel: "",
    depart: "",
    arrivee: "",
    date: "",
    heure: "",
    chauffeurId: "",
    vehiculeId: "",
    prix: "",
    notes: "",
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed inset-0 z-[70] bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-onyx-border/30">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">
            Nouveau Bon de Commande
          </h1>
          <p className="text-[10px] text-muted-foreground">
            Conforme Factur-X
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
        >
          <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable Form */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-6 pb-32"
      >
        {/* ── Section Client ── */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" strokeWidth={1.5} />
            Client
          </p>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-3">
            {[
              { id: "existing" as const, label: "Rechercher", icon: Search },
              { id: "new" as const, label: "Nouveau", icon: UserRoundPlus },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => update("clientMode", mode.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium border transition-all",
                  form.clientMode === mode.id
                    ? "bg-gold/15 border-gold/40 text-gold"
                    : "bg-onyx-card border-onyx-border/50 text-muted-foreground",
                )}
              >
                <mode.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                {mode.label}
              </button>
            ))}
          </div>

          {form.clientMode === "existing" ? (
            <SelectField
              label=""
              icon={null}
              placeholder="Sélectionner un client"
              options={clientOptions}
              value={form.clientId}
              onChange={(v) => update("clientId", v)}
            />
          ) : (
            <div className="space-y-3">
              {/* Civilite */}
              <div className="flex gap-2">
                {["M.", "Mme", "Société"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update("civilite", c)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all",
                      form.civilite === c
                        ? "bg-gold/15 border-gold/40 text-gold"
                        : "bg-onyx-card border-onyx-border/50 text-muted-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="Nom"
                  value={form.nom}
                  onChange={(e) => update("nom", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Prénom"
                  value={form.prenom}
                  onChange={(e) => update("prenom", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                />
              </div>
              <input
                type="tel"
                placeholder="Téléphone"
                value={form.tel}
                onChange={(e) => update("tel", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
              />
            </div>
          )}
        </section>

        {/* ── Section Trajet ── */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
            Trajet
          </p>

          <div className="relative">
            {/* Gold dotted line between fields */}
            <div className="absolute left-[19px] top-[44px] bottom-[44px] w-px border-l border-dashed border-gold/40" />

            <div className="space-y-3">
              {/* Depart */}
              <div className="relative flex items-center gap-3">
                <div className="w-[38px] h-[38px] rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0 z-10">
                  <CircleDot
                    className="h-4 w-4 text-gold"
                    strokeWidth={1.5}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Adresse de départ"
                  value={form.depart}
                  onChange={(e) => update("depart", e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                />
              </div>

              {/* Arrivee */}
              <div className="relative flex items-center gap-3">
                <div className="w-[38px] h-[38px] rounded-lg bg-secondary flex items-center justify-center shrink-0 z-10">
                  <MapPin
                    className="h-4 w-4 text-foreground"
                    strokeWidth={1.5}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Adresse d'arrivée"
                  value={form.arrivee}
                  onChange={(e) => update("arrivee", e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <div>
              <label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <CalendarDays className="h-3 w-3" strokeWidth={1.5} />
                Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <Clock className="h-3 w-3" strokeWidth={1.5} />
                Heure
              </label>
              <input
                type="time"
                value={form.heure}
                onChange={(e) => update("heure", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors [color-scheme:dark]"
              />
            </div>
          </div>
        </section>

        {/* ── Section Logistique ── */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5" strokeWidth={1.5} />
            Logistique
          </p>
          <div className="space-y-3">
            <SelectField
              label="Chauffeur"
              icon={<User className="h-3 w-3" strokeWidth={1.5} />}
              placeholder="Assigner un chauffeur"
              options={driverOptions}
              value={form.chauffeurId}
              onChange={(v) => update("chauffeurId", v)}
            />
            <SelectField
              label="Véhicule"
              icon={<Car className="h-3 w-3" strokeWidth={1.5} />}
              placeholder="Assigner un véhicule"
              options={vehicleOptions}
              value={form.vehiculeId}
              onChange={(v) => update("vehiculeId", v)}
            />
          </div>
        </section>

        {/* ── Section Tarif ── */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
            Tarif
          </p>
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={form.prix}
              onChange={(e) => update("prix", e.target.value)}
              className="w-full px-4 py-3 pr-14 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gold">
              EUR
            </div>
          </div>
        </section>

        {/* ── Notes ── */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" strokeWidth={1.5} />
            Notes particulières
          </p>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Ex: Siège bébé, boisson spécifique, accueil pancarte..."
            className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors resize-none"
          />
        </section>
      </form>

      {/* Fixed bottom CTA */}
      <div className="px-4 py-4 border-t border-onyx-border/30 bg-background">
        <button
          type="submit"
          onClick={handleSubmit}
          className="w-full py-4 rounded-2xl bg-gold text-primary-foreground font-bold hover:bg-gold-light active:scale-[0.98] transition-all gold-glow flex flex-col items-center justify-center gap-0.5"
        >
          <span className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" strokeWidth={1.5} />
            Générer le Bon de Commande
          </span>
          <span className="text-xs font-medium text-primary-foreground/70">
            (Conforme Factur-X)
          </span>
        </button>
      </div>
    </motion.div>
  )
}

// ── Export: Create BC Flow ─────────────────────────────────────

export function CreateBCFlow({ open, onClose }: CreateBCProps) {
  const [step, setStep] = useState<BCStep>("choose")

  function handleClose() {
    setStep("choose")
    onClose()
  }

  return (
    <AnimatePresence>
      {open && step === "choose" && (
        <ChooseMethodSheet
          key="choose"
          onManual={() => setStep("manual")}
          onLink={() => {
            // Link sharing would open a share modal in production
            handleClose()
          }}
          onClose={handleClose}
        />
      )}
      {open && step === "manual" && (
        <ManualBCForm
          key="manual"
          onBack={() => setStep("choose")}
          onClose={handleClose}
        />
      )}
    </AnimatePresence>
  )
}

"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ChevronLeft,
  Car,
  Hash,
  FileText,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Fuel,
  Palette,
  Tag,
  Wifi,
  Baby,
  Accessibility,
  Snowflake,
  Briefcase,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────

const ENERGY_OPTIONS = [
  { value: "hybrid", label: "Hybride" },
  { value: "electric", label: "Électrique" },
  { value: "diesel", label: "Diesel" },
  { value: "essence", label: "Essence" },
]

const CATEGORY_OPTIONS = [
  { value: "berline", label: "Berline" },
  { value: "citadine", label: "Citadine" },
  { value: "luxe", label: "Luxe" },
  { value: "van", label: "Van / Minibus" },
]

const VEHICLE_COLORS = [
  { name: "Noir", value: "#0F0F0F" },
  { name: "Blanc", value: "#F5F5F5" },
  { name: "Gris", value: "#6B7280" },
  { name: "Bleu", value: "#1E3A5F" },
  { name: "Bordeaux", value: "#6B1D2A" },
  { name: "Vert", value: "#1B6B4A" },
]

const EQUIPMENTS = [
  { key: "wifi", label: "Wi-Fi", icon: Wifi },
  { key: "siege-bebe", label: "Siège bébé", icon: Baby },
  { key: "pmr", label: "Accès PMR", icon: Accessibility },
  { key: "clim", label: "Clim. arrière", icon: Snowflake },
  { key: "porte-bagage", label: "Grand coffre", icon: Briefcase },
]

// ── Helpers ───────────────────────────────────────────────────

function getExpirationStatus(dateStr: string): { label: string; color: string } {
  if (!dateStr) return { label: "", color: "" }
  const target = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: "Expiré", color: "bg-red-500/15 text-red-400 border-red-500/25" }
  if (diffDays <= 30) return { label: `${diffDays}j`, color: "bg-amber-500/15 text-amber-400 border-amber-500/25" }
  if (diffDays <= 90) return { label: "OK", color: "bg-gold/15 text-gold border-gold/25" }
  return { label: "Valide", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" }
}

// ── Reusable Sub-components ──────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">
      {children}
    </p>
  )
}

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "mx-4 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/40 overflow-hidden",
      className
    )}>
      {children}
    </div>
  )
}

function FieldInput({
  label,
  icon,
  value,
  onChange,
  placeholder,
  mono,
  type = "text",
}: {
  label: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
  type?: string
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold/50 transition-colors",
            mono && "font-mono",
            type === "date" && "[color-scheme:dark]"
          )}
        />
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export function AddVehicleFlow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saved, setSaved] = useState(false)

  // Identification
  const [plate, setPlate] = useState("")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [energy, setEnergy] = useState("")

  // Dates
  const [dateAssurance, setDateAssurance] = useState("")
  const [dateCT, setDateCT] = useState("")
  const [macaron, setMacaron] = useState("")

  // Apparence
  const [vehicleColor, setVehicleColor] = useState("#0F0F0F")
  const [category, setCategory] = useState("")

  // Equipements
  const [equipments, setEquipments] = useState<string[]>([])

  function toggleEquipment(key: string) {
    setEquipments((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => {
      onClose()
      // Reset after close animation
      setTimeout(() => {
        setSaved(false)
        setPlate("")
        setBrand("")
        setModel("")
        setEnergy("")
        setDateAssurance("")
        setDateCT("")
        setMacaron("")
        setVehicleColor("#0F0F0F")
        setCategory("")
        setEquipments([])
      }, 300)
    }, 1200)
  }

  const assuranceStatus = getExpirationStatus(dateAssurance)
  const ctStatus = getExpirationStatus(dateCT)
  const canSave = plate.trim() && brand.trim() && model.trim()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-background flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-onyx-border/30">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 active:scale-95 transition-all"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-foreground">Nouveau Véhicule</h1>
              <p className="text-[10px] text-muted-foreground">Ajouter au parc automobile</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 active:scale-95 transition-all"
            >
              <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto py-4 space-y-1">

            {/* ── Section 1: Identification ── */}
            <SectionLabel>Identification</SectionLabel>
            <GlassCard className="mb-3">
              <div className="p-3 space-y-2.5">
                <FieldInput
                  label="Immatriculation"
                  icon={<Hash className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />}
                  value={plate}
                  onChange={setPlate}
                  placeholder="AB-123-CD"
                  mono
                />
                <FieldInput
                  label="Marque"
                  icon={<Car className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />}
                  value={brand}
                  onChange={setBrand}
                  placeholder="Mercedes-Benz"
                />
                <FieldInput
                  label="Modèle"
                  icon={<FileText className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />}
                  value={model}
                  onChange={setModel}
                  placeholder="Classe S 350d"
                />

                {/* Énergie */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Énergie</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ENERGY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setEnergy(opt.value)}
                        className={cn(
                          "py-2 rounded-lg text-[11px] font-medium transition-all active:scale-95",
                          energy === opt.value
                            ? "bg-gold/15 border border-gold/40 text-gold"
                            : "bg-secondary/40 border border-onyx-border/30 text-muted-foreground hover:border-gold/20"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* ── Section 2: Dates / Conformité ── */}
            <SectionLabel>Conformité</SectionLabel>
            <GlassCard className="mb-3">
              <div className="p-3 space-y-2.5">
                {/* Assurance */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Assurance</p>
                    {assuranceStatus.label && (
                      <span className={cn("px-1.5 py-0.5 text-[8px] font-semibold rounded border", assuranceStatus.color)}>
                        {assuranceStatus.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                      assuranceStatus.label === "Expiré" ? "bg-red-500/10 border-red-500/20" : "bg-gold/10 border-gold/20"
                    )}>
                      <Shield className={cn("h-3.5 w-3.5", assuranceStatus.label === "Expiré" ? "text-red-400" : "text-gold")} strokeWidth={1.5} />
                    </div>
                    <input
                      type="date"
                      value={dateAssurance}
                      onChange={(e) => setDateAssurance(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Contrôle Technique */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contrôle Technique</p>
                    {ctStatus.label && (
                      <span className={cn("px-1.5 py-0.5 text-[8px] font-semibold rounded border", ctStatus.color)}>
                        {ctStatus.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                      ctStatus.label === "Expiré" ? "bg-red-500/10 border-red-500/20" : "bg-gold/10 border-gold/20"
                    )}>
                      <Calendar className={cn("h-3.5 w-3.5", ctStatus.label === "Expiré" ? "text-red-400" : "text-gold")} strokeWidth={1.5} />
                    </div>
                    <input
                      type="date"
                      value={dateCT}
                      onChange={(e) => setDateCT(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Macaron */}
                <FieldInput
                  label="N° Macaron VTC"
                  icon={<Tag className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />}
                  value={macaron}
                  onChange={setMacaron}
                  placeholder="VTC-75-XXXX"
                  mono
                />

                {/* Expiration Warning */}
                {(assuranceStatus.label === "Expiré" || ctStatus.label === "Expiré") && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" strokeWidth={1.5} />
                    <p className="text-[10px] text-red-400 font-medium">
                      Document(s) expiré(s). Mettez-les à jour avant mise en service.
                    </p>
                  </motion.div>
                )}
              </div>
            </GlassCard>

            {/* ── Section 3: Apparence ── */}
            <SectionLabel>Apparence</SectionLabel>
            <GlassCard className="mb-3">
              <div className="p-3 space-y-2.5">
                {/* Couleur */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
                    <Palette className="h-3 w-3" strokeWidth={1.5} />
                    Couleur du véhicule
                  </p>
                  <div className="flex items-start justify-between gap-1">
                    {VEHICLE_COLORS.map((c) => {
                      const isActive = vehicleColor === c.value
                      return (
                        <button
                          key={c.value}
                          onClick={() => setVehicleColor(c.value)}
                          className="flex flex-col items-center gap-1.5 flex-1 min-w-0 active:scale-95 transition-transform"
                        >
                          <div className="relative">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full transition-all duration-200",
                                isActive && "ring-2 ring-gold ring-offset-2 ring-offset-background"
                              )}
                              style={{
                                backgroundColor: c.value,
                                boxShadow: isActive ? `0 0 10px ${c.value}40` : "none",
                              }}
                            />
                            {isActive && (
                              <motion.div
                                layoutId="vcolor-check"
                                className="absolute inset-0 flex items-center justify-center"
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              >
                                <CheckCircle2
                                  className={cn("h-3.5 w-3.5 drop-shadow-md", c.value === "#F5F5F5" ? "text-black" : "text-white")}
                                  strokeWidth={2}
                                />
                              </motion.div>
                            )}
                          </div>
                          <span className={cn(
                            "text-[8px] leading-tight text-center",
                            isActive ? "font-semibold text-gold" : "text-muted-foreground/60"
                          )}>{c.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Catégorie */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Catégorie</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setCategory(opt.value)}
                        className={cn(
                          "py-2 rounded-lg text-[11px] font-medium transition-all active:scale-95",
                          category === opt.value
                            ? "bg-gold/15 border border-gold/40 text-gold"
                            : "bg-secondary/40 border border-onyx-border/30 text-muted-foreground hover:border-gold/20"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* ── Section 4: Équipements ── */}
            <SectionLabel>Équipements</SectionLabel>
            <GlassCard className="mb-3">
              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENTS.map((eq) => {
                    const active = equipments.includes(eq.key)
                    const Icon = eq.icon
                    return (
                      <button
                        key={eq.key}
                        onClick={() => toggleEquipment(eq.key)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all active:scale-[0.97]",
                          active
                            ? "bg-gold/10 border border-gold/30"
                            : "bg-secondary/30 border border-onyx-border/30 hover:border-gold/20"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-gold" : "text-muted-foreground/60")} strokeWidth={1.5} />
                        <span className={cn("text-[11px] font-medium", active ? "text-gold" : "text-muted-foreground")}>{eq.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Fixed bottom: Save button */}
          <div className="px-4 py-4 border-t border-onyx-border/30 bg-background">
            <button
              onClick={handleSave}
              disabled={!canSave || saved}
              className={cn(
                "w-full py-3.5 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2",
                saved
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                  : canSave
                    ? "bg-gold text-primary-foreground hover:bg-gold-light gold-glow"
                    : "bg-secondary/40 border border-onyx-border/30 text-muted-foreground/50 cursor-not-allowed"
              )}
            >
              {saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                  Véhicule ajouté au parc
                </>
              ) : (
                "Enregistrer le véhicule"
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

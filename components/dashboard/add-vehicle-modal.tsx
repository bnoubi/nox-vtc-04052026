"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ChevronLeft,
  ArrowRight,
  Car,
  Hash,
  FileText,
  Calendar,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Palette,
  Tag,
  Wifi,
  Baby,
  Accessibility,
  Snowflake,
  Briefcase,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Data ──────────────────────────────────────────────────────

const ENERGY_OPTIONS = [
  { value: "essence", label: "Essence" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybride" },
  { value: "electric", label: "Electrique" },
  { value: "gnc", label: "GNC" },
]

const CATEGORY_OPTIONS = [
  { value: "berline", label: "Berline" },
  { value: "citadine", label: "Citadine" },
  { value: "luxe", label: "Luxe" },
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
  { key: "siege-bebe", label: "Siege bebe", icon: Baby },
  { key: "pmr", label: "Acces PMR", icon: Accessibility },
  { key: "clim", label: "Clim. arriere", icon: Snowflake },
  { key: "coffre", label: "Grand coffre", icon: Briefcase },
]

// ── Helpers ───────────────────────────────────────────────────

function getExpStatus(d: string) {
  if (!d) return { label: "", color: "" }
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 864e5)
  if (diff < 0) return { label: "Expire", color: "bg-red-500/15 text-red-400 border-red-500/25" }
  if (diff <= 30) return { label: `${diff}j`, color: "bg-amber-500/15 text-amber-400 border-amber-500/25" }
  if (diff <= 90) return { label: "OK", color: "bg-gold/15 text-gold border-gold/25" }
  return { label: "Valide", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" }
}

// ── Main Component ───────────────────────────────────────────

export function AddVehicleFlow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [saved, setSaved] = useState(false)

  // Step 1
  const [plate, setPlate] = useState("")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [energy, setEnergy] = useState("")
  const [dateAssurance, setDateAssurance] = useState("")
  const [dateCT, setDateCT] = useState("")
  const [macaron, setMacaron] = useState("")

  // Step 2
  const [category, setCategory] = useState("")
  const [vehicleColor, setVehicleColor] = useState("#0F0F0F")
  const [equipments, setEquipments] = useState<string[]>([])

  function toggleEquip(k: string) {
    setEquipments((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => {
      onClose()
      setTimeout(() => {
        setSaved(false)
        setStep(1)
        setPlate(""); setBrand(""); setModel(""); setEnergy("")
        setDateAssurance(""); setDateCT(""); setMacaron("")
        setCategory(""); setVehicleColor("#0F0F0F"); setEquipments([])
      }, 300)
    }, 1200)
  }

  function handleClose() {
    onClose()
    setTimeout(() => { setStep(1); setSaved(false) }, 300)
  }

  const asSt = getExpStatus(dateAssurance)
  const ctSt = getExpStatus(dateCT)
  const canNext = plate.trim() && brand.trim() && model.trim()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-background flex flex-col"
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-onyx-border/30">
            <button
              onClick={step === 1 ? handleClose : () => setStep(1)}
              className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 active:scale-95 transition-all"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-foreground">Nouveau Vehicule</h1>
              <p className="text-[10px] text-muted-foreground">Etape {step}/2</p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 active:scale-95 transition-all"
            >
              <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </button>
          </div>

          {/* ── Gold Progress Bar ── */}
          <div className="px-4 pt-2 pb-1">
            <div className="h-1 rounded-full bg-onyx-border/30 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gold"
                initial={false}
                animate={{ width: step === 1 ? "50%" : "100%" }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              />
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 overflow-y-auto pt-1 pb-2">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1"
                >
                  {/* Identification */}
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-1.5">Identification</p>
                  <div className="mx-4 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/40 p-3 space-y-2">
                    {/* Plaque */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Immatriculation</p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                          <Hash className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                        </div>
                        <input type="text" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="AB-123-CD"
                          className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold/50 transition-colors" />
                      </div>
                    </div>
                    {/* Marque + Modele inline */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Marque</p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                            <Car className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                          </div>
                          <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Mercedes"
                            className="flex-1 px-2 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold/50 transition-colors min-w-0" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Modele</p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                            <FileText className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                          </div>
                          <input type="text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Classe S"
                            className="flex-1 px-2 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold/50 transition-colors min-w-0" />
                        </div>
                      </div>
                    </div>
                    {/* Energie */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Energie</p>
                      <div className="grid grid-cols-5 gap-1">
                        {ENERGY_OPTIONS.map((o) => (
                          <button key={o.value} onClick={() => setEnergy(o.value)}
                            className={cn(
                              "py-1.5 rounded-lg text-[10px] font-medium transition-all active:scale-95",
                              energy === o.value
                                ? "bg-gold/15 border border-gold/40 text-gold"
                                : "bg-secondary/40 border border-onyx-border/30 text-muted-foreground hover:border-gold/20"
                            )}>{o.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Conformite */}
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-1.5">Conformite</p>
                  <div className="mx-4 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/40 p-3 space-y-2">
                    {/* Assurance */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Assurance</p>
                        {asSt.label && <span className={cn("px-1.5 py-0.5 text-[8px] font-semibold rounded border", asSt.color)}>{asSt.label}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", asSt.label === "Expire" ? "bg-red-500/10 border-red-500/20" : "bg-gold/10 border-gold/20")}>
                          <Shield className={cn("h-3.5 w-3.5", asSt.label === "Expire" ? "text-red-400" : "text-gold")} strokeWidth={1.5} />
                        </div>
                        <input type="date" value={dateAssurance} onChange={(e) => setDateAssurance(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors [color-scheme:dark]" />
                      </div>
                    </div>
                    {/* CT */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Controle Technique</p>
                        {ctSt.label && <span className={cn("px-1.5 py-0.5 text-[8px] font-semibold rounded border", ctSt.color)}>{ctSt.label}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", ctSt.label === "Expire" ? "bg-red-500/10 border-red-500/20" : "bg-gold/10 border-gold/20")}>
                          <Calendar className={cn("h-3.5 w-3.5", ctSt.label === "Expire" ? "text-red-400" : "text-gold")} strokeWidth={1.5} />
                        </div>
                        <input type="date" value={dateCT} onChange={(e) => setDateCT(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors [color-scheme:dark]" />
                      </div>
                    </div>
                    {/* Macaron */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">N Macaron VTC</p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                          <Tag className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                        </div>
                        <input type="text" value={macaron} onChange={(e) => setMacaron(e.target.value)} placeholder="VTC-75-XXXX"
                          className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold/50 transition-colors" />
                      </div>
                    </div>
                    {/* Warning */}
                    {(asSt.label === "Expire" || ctSt.label === "Expire") && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" strokeWidth={1.5} />
                        <p className="text-[10px] text-red-400 font-medium">Document(s) expire(s).</p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1"
                >
                  {/* Categorie */}
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-1.5">Categorie</p>
                  <div className="mx-4 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/40 p-3">
                    <div className="grid grid-cols-3 gap-1.5">
                      {CATEGORY_OPTIONS.map((o) => (
                        <button key={o.value} onClick={() => setCategory(o.value)}
                          className={cn(
                            "py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95",
                            category === o.value
                              ? "bg-gold/15 border border-gold/40 text-gold"
                              : "bg-secondary/40 border border-onyx-border/30 text-muted-foreground hover:border-gold/20"
                          )}>{o.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Couleur */}
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-1.5 flex items-center gap-1.5">
                    <Palette className="h-3 w-3" strokeWidth={1.5} />
                    Couleur du vehicule
                  </p>
                  <div className="mx-4 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/40 p-3">
                    <div className="flex items-start justify-between gap-1">
                      {VEHICLE_COLORS.map((c) => {
                        const active = vehicleColor === c.value
                        return (
                          <button key={c.value} onClick={() => setVehicleColor(c.value)}
                            className="flex flex-col items-center gap-1.5 flex-1 min-w-0 active:scale-95 transition-transform">
                            <div className="relative">
                              <div className={cn("w-9 h-9 rounded-full transition-all duration-200", active && "ring-2 ring-gold ring-offset-2 ring-offset-background")}
                                style={{ backgroundColor: c.value, boxShadow: active ? `0 0 12px ${c.value}50` : "none" }} />
                              {active && (
                                <motion.div layoutId="vclr" className="absolute inset-0 flex items-center justify-center"
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                                  <CheckCircle2 className={cn("h-4 w-4 drop-shadow-md", c.value === "#F5F5F5" ? "text-black" : "text-white")} strokeWidth={2} />
                                </motion.div>
                              )}
                            </div>
                            <span className={cn("text-[8px] leading-tight text-center", active ? "font-semibold text-gold" : "text-muted-foreground/60")}>{c.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Equipements */}
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-1.5">Equipements</p>
                  <div className="mx-4 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/40 p-3">
                    <div className="grid grid-cols-2 gap-1.5">
                      {EQUIPMENTS.map((eq) => {
                        const on = equipments.includes(eq.key)
                        const Icon = eq.icon
                        return (
                          <button key={eq.key} onClick={() => toggleEquip(eq.key)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all active:scale-[0.97]",
                              on ? "bg-gold/10 border border-gold/30" : "bg-secondary/30 border border-onyx-border/30 hover:border-gold/20"
                            )}>
                            <Icon className={cn("h-4 w-4 shrink-0", on ? "text-gold" : "text-muted-foreground/60")} strokeWidth={1.5} />
                            <span className={cn("text-[11px] font-medium", on ? "text-gold" : "text-muted-foreground")}>{eq.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Fixed Bottom ── */}
          <div className="px-4 py-3 border-t border-onyx-border/30 bg-background">
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={!canNext}
                className={cn(
                  "w-full py-3 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2",
                  canNext
                    ? "bg-gold text-primary-foreground hover:bg-gold-light gold-glow"
                    : "bg-secondary/40 border border-onyx-border/30 text-muted-foreground/50 cursor-not-allowed"
                )}
              >
                Suivant
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saved}
                className={cn(
                  "w-full py-3 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2",
                  saved
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                    : "bg-gold text-primary-foreground hover:bg-gold-light gold-glow"
                )}
              >
                {saved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                    Vehicule ajoute
                  </>
                ) : (
                  "Enregistrer le vehicule"
                )}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

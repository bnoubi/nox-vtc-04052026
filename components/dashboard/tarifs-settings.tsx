"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronLeft, 
  Calculator,
  Eye,
  Briefcase,
  Heart,
  Baby,
  Clock,
  Building2,
  UserCheck,
  MapPin,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface BaseRate {
  priseEnCharge: number
  tarifKm: number
  tarifAttente: number
  courseMinimum: number
}

interface TrancheHoraire {
  id: string
  name: string
  startTime: string
  endTime: string
  coefficient: number
}

interface Supplement {
  id: string
  icon: React.ReactNode
  label: string
  help?: string
  enabled: boolean
  price: number
}

interface Forfait {
  id: string
  name: string
  price: number
}

// ─────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────

function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-onyx-border/30">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl hover:bg-onyx-card active:scale-95 transition-all"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-gold" strokeWidth={1.5} />
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
        </div>
      </div>
    </div>
  )
}

function SectionCard({ 
  title, 
  subtitle, 
  children,
  dimmed = false 
}: { 
  title: string
  subtitle?: string
  children: React.ReactNode
  dimmed?: boolean 
}) {
  return (
    <div className={cn(
      "bg-onyx-card rounded-xl border border-onyx-border/30 overflow-hidden transition-opacity duration-150",
      dimmed && "opacity-40"
    )}>
      <div className="px-4 py-3 border-b border-onyx-border/20">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  suffix,
  disabled = false,
  min = 0,
  step = 0.01
}: {
  value: number
  onChange: (val: number) => void
  suffix: string
  disabled?: boolean
  min?: number
  step?: number
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        min={min}
        step={step}
        className={cn(
          "w-20 px-3 py-2 rounded-lg bg-[#1A1A1A] border text-sm text-right text-foreground transition-colors",
          "focus:outline-none focus:border-gold/50",
          disabled ? "border-onyx-border/20 opacity-50" : "border-onyx-border/30"
        )}
        style={{ fontSize: "16px" }} // Prevent iOS zoom
      />
      <span className="text-xs text-muted-foreground min-w-[40px]">{suffix}</span>
    </div>
  )
}

function TimeInput({
  value,
  onChange,
  disabled = false
}: {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "w-[90px] px-2 py-1.5 rounded-lg bg-[#1A1A1A] border text-xs text-foreground transition-colors [color-scheme:dark]",
        "focus:outline-none focus:border-gold/50",
        disabled ? "border-onyx-border/20 opacity-50" : "border-onyx-border/30"
      )}
      style={{ fontSize: "16px" }}
    />
  )
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean
  onChange: (val: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors duration-150",
        checked ? "bg-gold" : "bg-[#333]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-150",
          checked && "translate-x-5"
        )}
      />
    </button>
  )
}

function CoefficientBadge({ coefficient }: { coefficient: number }) {
  const percentage = Math.round((coefficient - 1) * 100)
  const isStandard = percentage === 0
  
  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-[10px] font-semibold",
      isStandard 
        ? "bg-[#333] text-muted-foreground" 
        : "bg-gold/20 text-gold"
    )}>
      {isStandard ? "Standard" : `Majoré +${percentage}%`}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────

function formatPrice(value: number): string {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function formatPriceUnit(value: number, unit: string): string {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + unit
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function TarifsSettings({ onBack }: { onBack: () => void }) {
  // Base rates
  const [baseRate, setBaseRate] = useState<BaseRate>({
    priseEnCharge: 2.50,
    tarifKm: 1.80,
    tarifAttente: 0.50,
    courseMinimum: 8.00
  })

  // Tranches horaires
  const [tranchesEnabled, setTranchesEnabled] = useState(true)
  const [tranches, setTranches] = useState<TrancheHoraire[]>([
    { id: "a", name: "Tarif A — Journée", startTime: "07:00", endTime: "21:00", coefficient: 1.00 },
    { id: "b", name: "Tarif B — Nuit", startTime: "21:00", endTime: "07:00", coefficient: 1.25 },
    { id: "c", name: "Tarif C — Week-end & Fériés", startTime: "00:00", endTime: "23:59", coefficient: 1.50 }
  ])
  const [applyWeekend, setApplyWeekend] = useState(true)
  const [applyHolidays, setApplyHolidays] = useState(true)

  // Suppléments
  const [supplements, setSupplements] = useState<Supplement[]>([
    { id: "bagage", icon: <Briefcase className="h-4 w-4" strokeWidth={1.5} />, label: "Bagage volumineux", help: "Valise de soute, équipement sportif...", enabled: false, price: 5.00 },
    { id: "animal", icon: <Heart className="h-4 w-4" strokeWidth={1.5} />, label: "Animal de compagnie", enabled: false, price: 5.00 },
    { id: "siege", icon: <Baby className="h-4 w-4" strokeWidth={1.5} />, label: "Siège bébé / enfant", help: "Sur demande préalable", enabled: false, price: 10.00 },
    { id: "disposition", icon: <Clock className="h-4 w-4" strokeWidth={1.5} />, label: "Mise à disposition", help: "Départ repoussé de plus de 30 min", enabled: false, price: 15.00 },
    { id: "terminal", icon: <Building2 className="h-4 w-4" strokeWidth={1.5} />, label: "Supplément terminal / gare", help: "Frais d'accès zone de dépose", enabled: false, price: 5.00 },
    { id: "pancarte", icon: <UserCheck className="h-4 w-4" strokeWidth={1.5} />, label: "Accueil avec pancarte", enabled: false, price: 8.00 }
  ])

  // Forfaits fixes
  const [forfaits, setForfaits] = useState<Forfait[]>([
    { id: "1", name: "CDG → Paris Centre", price: 85.00 },
    { id: "2", name: "Orly → Paris Centre", price: 65.00 }
  ])

  // Estimator
  const [estimatorOpen, setEstimatorOpen] = useState(false)
  const [estimatorDistance, setEstimatorDistance] = useState(12)
  const [estimatorTranche, setEstimatorTranche] = useState("a")
  const [estimatorSupplements, setEstimatorSupplements] = useState<string[]>([])

  // Update functions
  const updateBaseRate = (key: keyof BaseRate, value: number) => {
    setBaseRate(prev => ({ ...prev, [key]: value }))
  }

  const updateTranche = (id: string, key: keyof TrancheHoraire, value: string | number) => {
    setTranches(prev => prev.map(t => t.id === id ? { ...t, [key]: value } : t))
  }

  const toggleSupplement = (id: string) => {
    setSupplements(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  const updateSupplementPrice = (id: string, price: number) => {
    setSupplements(prev => prev.map(s => s.id === id ? { ...s, price } : s))
  }

  const addForfait = () => {
    const newId = Date.now().toString()
    setForfaits(prev => [...prev, { id: newId, name: "", price: 0 }])
  }

  const updateForfait = (id: string, key: keyof Forfait, value: string | number) => {
    setForfaits(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f))
  }

  const deleteForfait = (id: string) => {
    if (forfaits.length > 1) {
      setForfaits(prev => prev.filter(f => f.id !== id))
    }
  }

  // Estimator calculation
  const estimatedTotal = useMemo(() => {
    const tranche = tranches.find(t => t.id === estimatorTranche)
    const coefficient = tranchesEnabled && tranche ? tranche.coefficient : 1

    const priseEnCharge = baseRate.priseEnCharge
    const distanceCost = estimatorDistance * baseRate.tarifKm * coefficient
    const supplementsCost = supplements
      .filter(s => s.enabled && estimatorSupplements.includes(s.id))
      .reduce((sum, s) => sum + s.price, 0)

    const subtotal = Math.max(priseEnCharge + distanceCost + supplementsCost, baseRate.courseMinimum)
    const tva = subtotal * 0.10
    const total = subtotal + tva

    return {
      priseEnCharge,
      distance: distanceCost,
      supplements: supplementsCost,
      subtotal,
      tva,
      total
    }
  }, [baseRate, tranches, tranchesEnabled, estimatorDistance, estimatorTranche, estimatorSupplements, supplements])

  const handleSave = () => {
    toast.success("✓ Grille tarifaire sauvegardée", { duration: 2000 })
  }

  const activeSupplements = supplements.filter(s => s.enabled)

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 bg-background flex flex-col"
    >
      <SubScreenHeader title="Mes Grilles Tarifaires" onBack={onBack} />

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 pb-[280px]">
          
          {/* SECTION 1 - Tarif de Base */}
          <SectionCard 
            title="Tarif de base" 
            subtitle="Applicable à toutes les courses standard"
          >
            <div className="space-y-4">
              {/* Prise en charge */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-foreground">Prise en charge (flag fall)</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Montant fixe déclenché au démarrage</p>
                </div>
                <NumberInput
                  value={baseRate.priseEnCharge}
                  onChange={(v) => updateBaseRate("priseEnCharge", v)}
                  suffix="€"
                />
              </div>

              <div className="h-px bg-onyx-border/20" />

              {/* Tarif km */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground">Tarif kilométrique</p>
                <NumberInput
                  value={baseRate.tarifKm}
                  onChange={(v) => updateBaseRate("tarifKm", v)}
                  suffix="€/km"
                />
              </div>

              <div className="h-px bg-onyx-border/20" />

              {/* Tarif attente */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-foreground">Tarif d&apos;attente / circulation</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Appliqué sous 20 km/h</p>
                </div>
                <NumberInput
                  value={baseRate.tarifAttente}
                  onChange={(v) => updateBaseRate("tarifAttente", v)}
                  suffix="€/min"
                />
              </div>

              <div className="h-px bg-onyx-border/20" />

              {/* Course minimum */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-foreground">Course minimum</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Montant minimum facturé</p>
                </div>
                <NumberInput
                  value={baseRate.courseMinimum}
                  onChange={(v) => updateBaseRate("courseMinimum", v)}
                  suffix="€"
                />
              </div>
            </div>
          </SectionCard>

          {/* SECTION 2 - Tranches Horaires */}
          <SectionCard 
            title="Tranches horaires" 
            subtitle="Coefficients multiplicateurs selon les plages"
            dimmed={!tranchesEnabled}
          >
            {/* Toggle */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-onyx-border/20">
              <p className="text-sm text-foreground">Activer les tranches horaires</p>
              <ToggleSwitch checked={tranchesEnabled} onChange={setTranchesEnabled} />
            </div>

            <div className="space-y-4">
              {/* Tarif A */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground font-medium">Tarif A — Journée</p>
                  <CoefficientBadge coefficient={tranches[0].coefficient} />
                </div>
                <div className="flex items-center gap-2">
                  <TimeInput
                    value={tranches[0].startTime}
                    onChange={(v) => updateTranche("a", "startTime", v)}
                    disabled={!tranchesEnabled}
                  />
                  <span className="text-xs text-muted-foreground">à</span>
                  <TimeInput
                    value={tranches[0].endTime}
                    onChange={(v) => updateTranche("a", "endTime", v)}
                    disabled={!tranchesEnabled}
                  />
                  <div className="flex-1" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">×</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={tranches[0].coefficient}
                      onChange={(e) => updateTranche("a", "coefficient", parseFloat(e.target.value) || 1)}
                      disabled={!tranchesEnabled}
                      min={1}
                      max={3}
                      step={0.05}
                      className="w-16 px-2 py-1.5 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 text-sm text-right text-foreground focus:outline-none focus:border-gold/50 disabled:opacity-50"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-onyx-border/20" />

              {/* Tarif B */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground font-medium">Tarif B — Nuit</p>
                  <CoefficientBadge coefficient={tranches[1].coefficient} />
                </div>
                <div className="flex items-center gap-2">
                  <TimeInput
                    value={tranches[1].startTime}
                    onChange={(v) => updateTranche("b", "startTime", v)}
                    disabled={!tranchesEnabled}
                  />
                  <span className="text-xs text-muted-foreground">à</span>
                  <TimeInput
                    value={tranches[1].endTime}
                    onChange={(v) => updateTranche("b", "endTime", v)}
                    disabled={!tranchesEnabled}
                  />
                  <div className="flex-1" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">×</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={tranches[1].coefficient}
                      onChange={(e) => updateTranche("b", "coefficient", parseFloat(e.target.value) || 1)}
                      disabled={!tranchesEnabled}
                      min={1}
                      max={3}
                      step={0.05}
                      className="w-16 px-2 py-1.5 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 text-sm text-right text-foreground focus:outline-none focus:border-gold/50 disabled:opacity-50"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-onyx-border/20" />

              {/* Tarif C */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground font-medium">Tarif C — Week-end & Fériés</p>
                  <CoefficientBadge coefficient={tranches[2].coefficient} />
                </div>
                <div className="flex flex-wrap gap-3 mb-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={applyWeekend}
                      onChange={(e) => setApplyWeekend(e.target.checked)}
                      disabled={!tranchesEnabled}
                      className="w-4 h-4 rounded border-onyx-border bg-[#1A1A1A] text-gold focus:ring-gold/50 disabled:opacity-50"
                    />
                    Week-ends
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={applyHolidays}
                      onChange={(e) => setApplyHolidays(e.target.checked)}
                      disabled={!tranchesEnabled}
                      className="w-4 h-4 rounded border-onyx-border bg-[#1A1A1A] text-gold focus:ring-gold/50 disabled:opacity-50"
                    />
                    Jours fériés
                  </label>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-xs text-muted-foreground">×</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={tranches[2].coefficient}
                    onChange={(e) => updateTranche("c", "coefficient", parseFloat(e.target.value) || 1)}
                    disabled={!tranchesEnabled}
                    min={1}
                    max={3}
                    step={0.05}
                    className="w-16 px-2 py-1.5 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 text-sm text-right text-foreground focus:outline-none focus:border-gold/50 disabled:opacity-50"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* SECTION 3 - Suppléments */}
          <SectionCard 
            title="Suppléments" 
            subtitle="Frais additionnels optionnels par course"
          >
            <div className="space-y-3">
              {supplements.map((supplement, index) => (
                <div key={supplement.id}>
                  {index > 0 && <div className="h-px bg-onyx-border/20 mb-3" />}
                  <div className={cn(
                    "transition-opacity duration-150",
                    !supplement.enabled && "opacity-60"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-muted-foreground">
                        {supplement.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{supplement.label}</p>
                        {supplement.help && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{supplement.help}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <AnimatePresence>
                          {supplement.enabled && (
                            <motion.div
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: "auto", opacity: 1 }}
                              exit={{ width: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden"
                            >
                              <NumberInput
                                value={supplement.price}
                                onChange={(v) => updateSupplementPrice(supplement.id, v)}
                                suffix="€"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <ToggleSwitch
                          checked={supplement.enabled}
                          onChange={() => toggleSupplement(supplement.id)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* SECTION 4 - Forfaits Fixes */}
          <SectionCard 
            title="Forfaits Fixes" 
            subtitle="Tarifs prédéfinis pour trajets récurrents"
          >
            <div className="space-y-3">
              {forfaits.map((forfait, index) => (
                <div key={forfait.id} className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                  <input
                    type="text"
                    value={forfait.name}
                    onChange={(e) => updateForfait(forfait.id, "name", e.target.value)}
                    placeholder="Nom du trajet..."
                    className="flex-1 px-3 py-2 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                    style={{ fontSize: "16px" }}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={forfait.price}
                    onChange={(e) => updateForfait(forfait.id, "price", parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-2 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 text-sm text-right text-foreground focus:outline-none focus:border-gold/50"
                    style={{ fontSize: "16px" }}
                  />
                  <span className="text-xs text-muted-foreground">€</span>
                  <button
                    onClick={() => deleteForfait(forfait.id)}
                    disabled={forfaits.length <= 1}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      forfaits.length > 1 
                        ? "hover:bg-rose-500/10 text-rose-400 active:scale-95" 
                        : "opacity-30 cursor-not-allowed text-muted-foreground"
                    )}
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              ))}

              <button
                onClick={addForfait}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gold/30 text-gold text-xs font-medium hover:bg-gold/5 hover:border-gold/50 active:scale-[0.98] transition-all"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Ajouter un forfait
              </button>
            </div>
          </SectionCard>

        </div>
      </div>

      {/* LIVE PREVIEW - Sticky Bottom */}
      <div className="sticky bottom-0 left-0 right-0 bg-[#2a2a2a] border-t border-onyx-border/30 rounded-t-2xl shadow-2xl">
        <div className="max-h-[260px] overflow-y-auto">
          {/* Preview Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-onyx-border/20 sticky top-0 bg-[#2a2a2a]">
            <Eye className="h-4 w-4 text-gold" strokeWidth={1.5} />
            <span className="text-xs font-semibold text-foreground">Aperçu Grille Tarifaire</span>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Base rates preview */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Prise en charge</span>
                <span className="text-foreground font-medium">{formatPrice(baseRate.priseEnCharge)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Tarif kilométrique</span>
                <span className="text-foreground font-medium">{formatPriceUnit(baseRate.tarifKm, "€/km")}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Tarif d&apos;attente</span>
                <span className="text-foreground font-medium">{formatPriceUnit(baseRate.tarifAttente, "€/min")}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Course minimum</span>
                <span className="text-foreground font-medium">{formatPrice(baseRate.courseMinimum)}</span>
              </div>
            </div>

            {/* Tranches horaires */}
            {tranchesEnabled && (
              <>
                <div className="h-px bg-onyx-border/20" />
                <div className="space-y-1">
                  <p className="text-[10px] text-gold font-semibold uppercase tracking-wider mb-1">Tranches horaires</p>
                  {tranches.map(t => (
                    <div key={t.id} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {t.id === "a" ? `Tarif A (${t.startTime}–${t.endTime})` :
                         t.id === "b" ? `Tarif B (${t.startTime}–${t.endTime})` :
                         "Tarif C (W-E & fériés)"}
                      </span>
                      <span className="text-foreground font-medium">
                        ×{t.coefficient.toFixed(2)} — {t.coefficient === 1 ? "Standard" : `+${Math.round((t.coefficient - 1) * 100)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Active Supplements */}
            {activeSupplements.length > 0 && (
              <>
                <div className="h-px bg-onyx-border/20" />
                <div className="space-y-1">
                  <p className="text-[10px] text-gold font-semibold uppercase tracking-wider mb-1">Suppléments disponibles</p>
                  {activeSupplements.map(s => (
                    <div key={s.id} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">+ {s.label}</span>
                      <span className="text-foreground font-medium">{formatPrice(s.price)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Forfaits */}
            {forfaits.filter(f => f.name).length > 0 && (
              <>
                <div className="h-px bg-onyx-border/20" />
                <div className="space-y-1">
                  <p className="text-[10px] text-gold font-semibold uppercase tracking-wider mb-1">Forfaits fixes</p>
                  {forfaits.filter(f => f.name).map(f => (
                    <div key={f.id} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">{f.name}</span>
                      <span className="text-foreground font-medium">{formatPrice(f.price)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Estimator */}
            <div className="h-px bg-onyx-border/20" />
            <div>
              <button
                onClick={() => setEstimatorOpen(!estimatorOpen)}
                className="flex items-center justify-between w-full py-1 text-[11px] text-gold font-medium"
              >
                <span>Simuler une course</span>
                {estimatorOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              
              <AnimatePresence>
                {estimatorOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 space-y-2">
                      {/* Distance input */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Distance</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={estimatorDistance}
                            onChange={(e) => setEstimatorDistance(parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 rounded bg-[#1A1A1A] border border-onyx-border/30 text-xs text-right text-foreground focus:outline-none focus:border-gold/50"
                            style={{ fontSize: "16px" }}
                          />
                          <span className="text-[11px] text-muted-foreground">km</span>
                        </div>
                      </div>

                      {/* Tranche selector */}
                      {tranchesEnabled && (
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Tranche</span>
                          <select
                            value={estimatorTranche}
                            onChange={(e) => setEstimatorTranche(e.target.value)}
                            className="px-2 py-1 rounded bg-[#1A1A1A] border border-onyx-border/30 text-xs text-foreground focus:outline-none focus:border-gold/50"
                            style={{ fontSize: "16px" }}
                          >
                            <option value="a">Tarif A</option>
                            <option value="b">Tarif B</option>
                            <option value="c">Tarif C</option>
                          </select>
                        </div>
                      )}

                      {/* Supplements checkboxes */}
                      {activeSupplements.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {activeSupplements.map(s => (
                            <label key={s.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={estimatorSupplements.includes(s.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEstimatorSupplements(prev => [...prev, s.id])
                                  } else {
                                    setEstimatorSupplements(prev => prev.filter(id => id !== s.id))
                                  }
                                }}
                                className="w-3 h-3 rounded border-onyx-border bg-[#1A1A1A] text-gold"
                              />
                              {s.label}
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Result */}
                      <div className="pt-2 border-t border-onyx-border/20 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Prise en charge</span>
                          <span className="text-foreground">{formatPrice(estimatedTotal.priseEnCharge)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Distance ({estimatorDistance} km)</span>
                          <span className="text-foreground">{formatPrice(estimatedTotal.distance)}</span>
                        </div>
                        {estimatedTotal.supplements > 0 && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-muted-foreground">Suppléments</span>
                            <span className="text-foreground">{formatPrice(estimatedTotal.supplements)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Total HT</span>
                          <span className="text-foreground">{formatPrice(estimatedTotal.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">TVA 10%</span>
                          <span className="text-foreground">{formatPrice(estimatedTotal.tva)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-gold">Total TTC</span>
                          <span className="text-gold">{formatPrice(estimatedTotal.total)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Save button */}
          <div className="px-4 py-3 border-t border-onyx-border/20">
            <button
              onClick={handleSave}
              className="w-full py-3.5 rounded-full bg-gold text-black font-semibold text-sm hover:bg-gold/90 active:scale-[0.98] transition-all"
            >
              Enregistrer ma grille tarifaire
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

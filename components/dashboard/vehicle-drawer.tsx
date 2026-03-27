"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, Car, Hash, Palette, Calendar, Shield, Trash2, ChevronLeft, ArrowRight, CheckCircle2, ChevronDown, Fuel, Grid } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Vehicle, MotorType, VehicleCategory } from "./data"

const VEHICLE_COLORS = [
  { name: "Noir", value: "#0F0F0F" },
  { name: "Blanc", value: "#F5F5F5" },
  { name: "Gris", value: "#6B7280" },
  { name: "Bleu", value: "#1E3A5F" },
  { name: "Bordeaux", value: "#6B1D2A" },
  { name: "Autre", value: "custom" },
]

const MOTOR_TYPES: { value: MotorType; label: string }[] = [
  { value: "diesel", label: "Diesel" },
  { value: "essence", label: "Essence" },
  { value: "hybride", label: "Hybride" },
  { value: "electrique", label: "Électrique" },
]

const VEHICLE_CATEGORIES: { value: VehicleCategory; label: string }[] = [
  { value: "citadine", label: "Citadine" },
  { value: "berline", label: "Berline" },
  { value: "suv", label: "SUV" },
  { value: "van", label: "Van" },
]

function getExpirationStatus(dateStr: string): { label: string; cls: string } {
  if (!dateStr) return { label: "", cls: "" }
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: "Expiré", cls: "bg-red-500/15 text-red-400 border-red-500/25" }
  if (diff <= 30) return { label: `${diff}j`, cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" }
  return { label: "OK", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" }
}

function calculateVehicleAge(dateStr: string): { years: number; days: number; display: string } {
  if (!dateStr) return { years: 0, days: 0, display: "" }
  const startDate = new Date(dateStr)
  const today = new Date()
  
  let years = today.getFullYear() - startDate.getFullYear()
  const monthDiff = today.getMonth() - startDate.getMonth()
  const dayDiff = today.getDate() - startDate.getDate()
  
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years--
  }
  
  const yearAnniversary = new Date(startDate)
  yearAnniversary.setFullYear(startDate.getFullYear() + years)
  const daysRemaining = Math.floor((today.getTime() - yearAnniversary.getTime()) / (1000 * 60 * 60 * 24))
  
  return { 
    years, 
    days: daysRemaining, 
    display: `${years} an${years > 1 ? "s" : ""} et ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}`
  }
}

function getAgeStatus(years: number, motorType: MotorType): { color: string; label: string } {
  // Pas de limite d'âge pour hybride et électrique
  if (motorType === "hybride" || motorType === "electrique") {
    return { color: "text-[#00FF00]", label: "Aucune limite" }
  }
  // Pour thermiques (diesel/essence)
  if (years >= 7) return { color: "text-[#FF0000]", label: "Critique - Hors délai" }
  if (years >= 6) return { color: "text-[#FF4500]", label: "Changement impératif" }
  if (years >= 5) return { color: "text-[#FFA500]", label: "Alerte anticipation" }
  return { color: "text-[#00FF00]", label: "Conforme" }
}

interface VehicleDrawerProps {
  open: boolean
  vehicle: Vehicle | null // null = Add mode, Vehicle = Edit mode
  onClose: () => void
  onSave: (data: { 
    plate: string
    brand: string
    model: string
    color: string
    customColor: string
    datePremiereImmat: string
    motorType: MotorType
    category: VehicleCategory
    assuranceTransportExpiration: string
    expirationCT: string
  }) => void
  onDelete?: (vehicle: Vehicle) => void
}

export function VehicleDrawer({ open, vehicle, onClose, onSave, onDelete }: VehicleDrawerProps) {
  const isEditMode = !!vehicle
  const [step, setStep] = useState<1 | 2>(1)
  const [plate, setPlate] = useState("")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [color, setColor] = useState("#0F0F0F")
  const [customColor, setCustomColor] = useState("")
  const [datePremiereImmat, setDatePremiereImmat] = useState("")
  const [motorType, setMotorType] = useState<MotorType>("diesel")
  const [category, setCategory] = useState<VehicleCategory>("berline")
  const [assuranceTransportExpiration, setAssuranceTransportExpiration] = useState("")
  const [expirationCT, setExpirationCT] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved] = useState(false)
  const [motorDropdownOpen, setMotorDropdownOpen] = useState(false)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)

  useEffect(() => {
    if (open) {
      if (vehicle) {
        // Edit mode: pre-fill
        const parts = vehicle.model.split(" ")
        setBrand(parts[0] || "")
        setModel(parts.slice(1).join(" ") || vehicle.model)
        setPlate(vehicle.plate)
        setDatePremiereImmat(vehicle.datePremiereImmat || "")
        setMotorType(vehicle.motorType || "diesel")
        setCategory(vehicle.category || "berline")
        // Check if color is a predefined one or custom
        const isPredefined = VEHICLE_COLORS.some(c => c.value === vehicle.color)
        if (isPredefined) {
          setColor(vehicle.color)
          setCustomColor("")
        } else {
          setColor("custom")
          setCustomColor(vehicle.color || "")
        }
        setAssuranceTransportExpiration(vehicle.assuranceTransportExpiration || "")
        setExpirationCT(vehicle.controleTechniqueExpiration || "")
      } else {
        // Add mode: empty
        setPlate("")
        setBrand("")
        setModel("")
        setColor("#0F0F0F")
        setCustomColor("")
        setDatePremiereImmat("")
        setMotorType("diesel")
        setCategory("berline")
        setAssuranceTransportExpiration("")
        setExpirationCT("")
      }
      setStep(1)
      setConfirmDelete(false)
      setSaved(false)
    }
  }, [vehicle, open])

  const assuranceStatus = getExpirationStatus(assuranceTransportExpiration)
  const ctStatus = getExpirationStatus(expirationCT)
  const vehicleAge = calculateVehicleAge(datePremiereImmat)
  const ageStatus = getAgeStatus(vehicleAge.years, motorType)
  const canNext = plate.trim() && brand.trim() && model.trim() && datePremiereImmat

  function handleSave() {
    setSaved(true)
    setTimeout(() => {
      onSave({ 
        plate, 
        brand, 
        model, 
        color: color === "custom" ? customColor : color, 
        customColor,
        datePremiereImmat,
        motorType,
        category,
        assuranceTransportExpiration,
        expirationCT
      })
      toast(isEditMode ? "Mise à jour effectuée" : "Véhicule ajouté", {
        description: `${brand} ${model} • ${plate}`,
        duration: 2000,
      })
      setSaved(false)
    }, 800)
  }

  function handleDelete() {
    if (!vehicle || !onDelete) return
    onDelete(vehicle)
    toast("Élément supprimé", {
      description: `${vehicle.model}`,
      duration: 2000,
    })
    setConfirmDelete(false)
  }

  function handleClose() {
    onClose()
    setTimeout(() => setStep(1), 300)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] flex items-end justify-center"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="relative w-full max-w-md bg-[#0E0E0E]/95 backdrop-blur-2xl rounded-t-3xl border-t border-[#D4AF37]/25 flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#D4AF37]/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                {step === 2 && (
                  <button
                    onClick={() => setStep(1)}
                    className="w-8 h-8 rounded-xl bg-[#1A1A1A] border border-[#333] flex items-center justify-center hover:border-[#D4AF37]/30 transition-colors mr-1"
                  >
                    <ChevronLeft className="h-4 w-4 text-[#F5F5F5]" strokeWidth={1.5} />
                  </button>
                )}
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
                  <Car className="h-4 w-4 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#D4AF37] tracking-wide">
                    {isEditMode ? "Modifier le Véhicule" : "Nouveau Véhicule"}
                  </h2>
                  <p className="text-[10px] text-[#A1A1AA]">Étape {step}/2</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 flex items-center justify-center hover:bg-[#D4AF37]/20 transition-colors"
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5 text-[#D4AF37]" strokeWidth={2.5} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="px-5 pb-2 shrink-0">
              <div className="h-1 rounded-full bg-[#333] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[#D4AF37]"
                  initial={false}
                  animate={{ width: step === 1 ? "50%" : "100%" }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                />
              </div>
            </div>

            <div className="mx-5 h-px bg-[#D4AF37]/10 shrink-0" />

            {/* Scrollable Form */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* IMMATRICULATION */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-1.5 flex items-center gap-1.5">
                        <Hash className="h-3 w-3" strokeWidth={1.5} />
                        IMMATRICULATION
                      </label>
                      <input
                        type="text"
                        placeholder="AB-123-CD"
                        value={plate}
                        onChange={(e) => setPlate(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] font-mono placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                      />
                    </div>

                    {/* DATE PREMIERE IMMATRICULATION */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-1.5 flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" strokeWidth={1.5} />
                        DATE 1ÈRE IMMATRICULATION *
                      </label>
                      <input
                        type="date"
                        value={datePremiereImmat}
                        onChange={(e) => setDatePremiereImmat(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D4AF37]/50 transition-colors [color-scheme:dark]"
                      />
                      {datePremiereImmat && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-[#1A1A1A] border border-[#333]">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#A1A1AA]">Âge du véhicule</span>
                            <span className={cn("text-xs font-semibold", ageStatus.color)}>{vehicleAge.display}</span>
                          </div>
                          <p className={cn("text-[9px] mt-0.5", ageStatus.color)}>{ageStatus.label}</p>
                        </div>
                      )}
                    </div>

                    {/* MARQUE */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-1.5 flex items-center gap-1.5">
                        <Car className="h-3 w-3" strokeWidth={1.5} />
                        MARQUE
                      </label>
                      <input
                        type="text"
                        placeholder="Mercedes"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                      />
                    </div>

                    {/* MODELE */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-1.5 block">
                        MODÈLE
                      </label>
                      <input
                        type="text"
                        placeholder="Classe S"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                      />
                    </div>

                    {/* TYPE DE MOTEUR */}
                    <div className="relative">
                      <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-1.5 flex items-center gap-1.5">
                        <Fuel className="h-3 w-3" strokeWidth={1.5} />
                        TYPE DE MOTEUR
                      </label>
                      <button
                        type="button"
                        onClick={() => setMotorDropdownOpen(!motorDropdownOpen)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] flex items-center justify-between focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                      >
                        <span>{MOTOR_TYPES.find(m => m.value === motorType)?.label}</span>
                        <ChevronDown className={cn("h-4 w-4 text-[#A1A1AA] transition-transform", motorDropdownOpen && "rotate-180")} strokeWidth={1.5} />
                      </button>
                      {motorDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMotorDropdownOpen(false)} />
                          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-[#1A1A1A] border border-[#333] rounded-xl overflow-hidden shadow-xl">
                            {MOTOR_TYPES.map((m) => (
                              <button
                                key={m.value}
                                type="button"
                                onClick={() => {
                                  setMotorType(m.value)
                                  setMotorDropdownOpen(false)
                                }}
                                className={cn(
                                  "w-full px-3 py-2.5 text-sm text-left transition-colors",
                                  motorType === m.value 
                                    ? "bg-[#D4AF37]/10 text-[#D4AF37]" 
                                    : "text-[#F5F5F5] hover:bg-[#333]/50"
                                )}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* CATEGORIE */}
                    <div className="relative">
                      <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-1.5 flex items-center gap-1.5">
                        <Grid className="h-3 w-3" strokeWidth={1.5} />
                        CATÉGORIE
                      </label>
                      <button
                        type="button"
                        onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] flex items-center justify-between focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                      >
                        <span>{VEHICLE_CATEGORIES.find(c => c.value === category)?.label}</span>
                        <ChevronDown className={cn("h-4 w-4 text-[#A1A1AA] transition-transform", categoryDropdownOpen && "rotate-180")} strokeWidth={1.5} />
                      </button>
                      {categoryDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setCategoryDropdownOpen(false)} />
                          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-[#1A1A1A] border border-[#333] rounded-xl overflow-hidden shadow-xl">
                            {VEHICLE_CATEGORIES.map((c) => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => {
                                  setCategory(c.value)
                                  setCategoryDropdownOpen(false)
                                }}
                                className={cn(
                                  "w-full px-3 py-2.5 text-sm text-left transition-colors",
                                  category === c.value 
                                    ? "bg-[#D4AF37]/10 text-[#D4AF37]" 
                                    : "text-[#F5F5F5] hover:bg-[#333]/50"
                                )}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* COULEUR */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold mb-2 flex items-center gap-1.5">
                        <Palette className="h-3 w-3" strokeWidth={1.5} />
                        COULEUR
                      </label>
                      <div className="flex items-center justify-between gap-1">
                        {VEHICLE_COLORS.map((c) => {
                          const active = color === c.value
                          return (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setColor(c.value)}
                              className="flex flex-col items-center gap-1.5 flex-1 min-w-0"
                            >
                              <div
                                className={cn(
                                  "w-9 h-9 rounded-full transition-all flex items-center justify-center",
                                  active && "ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-[#0E0E0E]",
                                  c.value === "custom" && "border-2 border-dashed border-[#555]"
                                )}
                                style={{ backgroundColor: c.value !== "custom" ? c.value : "#1A1A1A" }}
                              >
                                {c.value === "custom" && <span className="text-[10px] text-[#A1A1AA]">?</span>}
                              </div>
                              <span className={cn(
                                "text-[8px]",
                                active ? "text-[#D4AF37] font-semibold" : "text-[#A1A1AA]/60"
                              )}>{c.name}</span>
                            </button>
                          )
                        })}
                      </div>
                      {color === "custom" && (
                        <input
                          type="text"
                          placeholder="Ex: Bleu nuit métallisé"
                          value={customColor}
                          onChange={(e) => setCustomColor(e.target.value)}
                          className="w-full mt-3 px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] placeholder:text-[#555] focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                        />
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
                    className="space-y-4"
                  >
                    {/* EXPIRATION ASSURANCE TRANSPORT */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                          <Shield className="h-3 w-3" strokeWidth={1.5} />
                          EXPIRATION ASSU. TRANS. ONÉREUX
                        </label>
                        {assuranceStatus.label && (
                          <span className={cn("px-1.5 py-0.5 text-[8px] font-bold rounded border", assuranceStatus.cls)}>
                            {assuranceStatus.label}
                          </span>
                        )}
                      </div>
                      <input
                        type="date"
                        value={assuranceTransportExpiration}
                        onChange={(e) => setAssuranceTransportExpiration(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D4AF37]/50 transition-colors [color-scheme:dark]"
                      />
                      <p className="text-[9px] text-[#666] mt-1">Assurance Transport à Titre Onéreux</p>
                    </div>

                    {/* EXPIRATION CONTROLE TECHNIQUE */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" strokeWidth={1.5} />
                          EXPIRATION CONTRÔLE TECHNIQUE
                        </label>
                        {ctStatus.label && (
                          <span className={cn("px-1.5 py-0.5 text-[8px] font-bold rounded border", ctStatus.cls)}>
                            {ctStatus.label}
                          </span>
                        )}
                      </div>
                      <input
                        type="date"
                        value={expirationCT}
                        onChange={(e) => setExpirationCT(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#333] text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D4AF37]/50 transition-colors [color-scheme:dark]"
                      />
                    </div>

                    {/* Delete - only in edit mode */}
                    {isEditMode && onDelete && (
                      <AnimatePresence mode="wait">
                        {!confirmDelete ? (
                          <motion.button
                            key="delete-trigger"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setConfirmDelete(true)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-red-400/70 hover:text-red-400 transition-colors mt-6"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            Supprimer ce véhicule
                          </motion.button>
                        ) : (
                          <motion.div
                            key="delete-confirm"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 space-y-2 mt-4"
                          >
                            <p className="text-xs text-red-300 text-center leading-relaxed">
                              {"Souhaitez-vous retirer cet élément de votre flotte NoX ?"}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setConfirmDelete(false)}
                                className="flex-1 py-2 rounded-xl bg-[#1A1A1A] border border-[#333] text-xs font-medium text-[#A1A1AA] hover:border-[#555] transition-colors"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={handleDelete}
                                className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-bold text-red-400 hover:bg-red-500/25 active:scale-[0.97] transition-all"
                              >
                                Confirmer
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="px-5 pb-8 pt-3 border-t border-[#D4AF37]/10 shrink-0">
              {step === 1 ? (
                <button
                  onClick={() => setStep(2)}
                  disabled={!canNext}
                  className={cn(
                    "w-full py-3 rounded-2xl text-sm font-bold active:scale-[0.97] transition-all flex items-center justify-center gap-2",
                    canNext
                      ? "bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#E5C44D]"
                      : "bg-[#333] text-[#666] cursor-not-allowed"
                  )}
                >
                  Suivant
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 rounded-2xl text-sm font-medium bg-[#1A1A1A] border border-[#333] text-[#A1A1AA] hover:border-[#555] active:scale-[0.97] transition-all"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saved}
                    className={cn(
                      "flex-1 py-3 rounded-2xl text-sm font-bold active:scale-[0.97] transition-all flex items-center justify-center gap-2",
                      saved
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                        : "bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#E5C44D]"
                    )}
                  >
                    {saved ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                        Enregistré
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

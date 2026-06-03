"use client"

import { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import {
  ChevronLeft, ChevronRight, Plus, RefreshCw, Loader2,
  Search, Building2, Users, X, MapPin, Navigation,
  Car, Euro, User, FileText, MoreHorizontal, Pause, Play,
  CheckCircle2, AlertCircle,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"
import { QuickAddClientModal } from "./quick-add-client-modal"
import { toast } from "sonner"
import { type Client, type EnterpriseProfile } from "./data"
import { generateRecurringContractPDF } from "@/lib/pdf-generator"

function generateCGVSummary(enterprise: EnterpriseProfile): string {
  if (!enterprise.cgvMode || enterprise.cgvMode === "configurator") {
    const cfg = enterprise.cgvConfig
    if (!cfg) return "Aucune condition générale de vente n'a été configurée."
    return `Conditions Générales de Vente :\n- Annulation : sans frais jusqu'à ${cfg.cancellationDelay} avant le départ. Passé ce délai, des frais de ${cfg.cancellationFee}% seront appliqués.\n- Attente : temps d'attente inclus de ${cfg.waitTime} minutes. Au-delà, facturation de ${cfg.waitFee}€/min.\n- No-Show (non-présentation) : pénalité de ${cfg.noShowFee}% appliquée.\n- Paiement : exigé au format ${cfg.paymentDelay} via ${cfg.paymentMethods.join(", ")}.`
  }
  if (enterprise.cgvMode === "freetext") return enterprise.cgvText || "Aucune condition générale de vente n'a été configurée."
  return "Les conditions générales relatives à cette prestation vous ont été remises en annexe ou sont consultables sur demande."
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RecurringContract {
  id: string
  numero: string | null
  label: string | null
  notes: string | null
  passenger_name: string | null
  passenger_phone: string | null
  client_id: string | null
  departure: string
  arrival: string
  outbound_days: number[]
  outbound_time: string | null
  return_enabled: boolean
  return_days: number[] | null
  return_time: string | null
  return_departure: string | null
  return_arrival: string | null
  recurrence_type: string
  price_per_trip: number | null
  billing_mode: string
  billing_frequency: "monthly" | "weekly" | "manual"
  start_date: string
  end_date: string | null
  no_end_date: boolean
  exclude_holidays: boolean
  country_code: string
  excluded_dates: string[] | null
  stops: DaySchedule[] | null
  driver_id: string | null
  vehicle_id: string | null
  distance_km: number | null
  status: "active" | "paused" | "ended" | "cancelled"
  created_at: string
}

interface RecurringTrip {
  id: string
  contract_id: string
  trip_date: string
  trip_time: string | null
  direction: "outbound" | "return"
  status: "upcoming" | "confirmed" | "completed" | "cancelled" | "missed"
  cancelled_by: string | null
  created_at: string
}

interface DaySchedule {
  day: number
  enabled: boolean
  outboundTime: string
  returnEnabled: boolean
  returnTime: string
}

type RecurrenceType = "fixed" | "variable" | "custom"

interface TripPreview {
  date: string
  display: string
  time: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

const TIME_SLOTS = Array.from({ length: 288 }, (_, i) => {
  const h = Math.floor(i / 12)
  const m = (i % 12) * 5
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
})

const COUNTRY_LABELS: Record<string, string> = {
  FR: "🇫🇷 France",
  BE: "🇧🇪 Belgique",
  CH: "🇨🇭 Suisse",
  LU: "🇱🇺 Luxembourg",
}

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  fixed: "Horaire fixe",
  variable: "Horaires variables",
  custom: "Aller/Retour dissociés",
}

function formatRecurrence(days: number[], time: string): string {
  if (!days || days.length === 0) return time
  const sorted = [...days].sort((a, b) => a - b)
  return `${sorted.map(d => DAY_LABELS[d] ?? "?").join("/")} · ${time}`
}

function formatDays(days: number[] | null | undefined): string {
  return [...(days ?? [])].sort((a, b) => a - b).map(d => DAY_NAMES[d - 1] ?? "?").join(", ")
}

function formatTime(t: string | null | undefined): string {
  return t?.substring(0, 5) ?? "—"
}

const statusConfig = {
  active:    { label: "Actif",      className: "bg-green-500/15 text-green-400 border-green-500/30" },
  paused:    { label: "En pause",   className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  ended:     { label: "Terminé",    className: "bg-[#2a2a2a] text-muted-foreground border-onyx-border/30" },
  cancelled: { label: "Résilié",    className: "bg-red-500/15 text-red-400 border-red-500/30" },
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr + "T00:00:00")
  const name = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][d.getDay()]
  return `${name} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

const today = new Date().toISOString().split("T")[0]

const DEFAULT_DAY_SCHEDULES: DaySchedule[] = [
  { day: 1, enabled: true,  outboundTime: "08:00", returnEnabled: false, returnTime: "17:00" },
  { day: 2, enabled: true,  outboundTime: "08:00", returnEnabled: false, returnTime: "17:00" },
  { day: 3, enabled: true,  outboundTime: "08:00", returnEnabled: false, returnTime: "17:00" },
  { day: 4, enabled: true,  outboundTime: "08:00", returnEnabled: false, returnTime: "17:00" },
  { day: 5, enabled: true,  outboundTime: "08:00", returnEnabled: false, returnTime: "17:00" },
  { day: 6, enabled: false, outboundTime: "08:00", returnEnabled: false, returnTime: "17:00" },
  { day: 7, enabled: false, outboundTime: "08:00", returnEnabled: false, returnTime: "17:00" },
]

// ── Section ──────────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode
}) {
  return (
    <div className="border border-onyx-border/30 rounded-xl bg-[#1a1a1a] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-onyx-border/20">
        <Icon className="h-4 w-4 text-gold" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="px-4 pb-4 pt-3 space-y-3">{children}</div>
    </div>
  )
}

// ── RecapRow ──────────────────────────────────────────────────────────────────

function RecapRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-onyx-border/20 last:border-0">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  )
}

// ── DaysSelector ─────────────────────────────────────────────────────────────

function DaysSelector({ selected, onChange }: {
  selected: number[]
  onChange: (d: number[]) => void
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {DAY_NAMES.map((name, i) => {
        const day = i + 1
        const active = selected.includes(day)
        return (
          <button key={day} type="button"
            onClick={() => onChange(active ? selected.filter(d => d !== day) : [...selected, day])}
            className={cn(
              "w-10 h-10 rounded-full text-xs font-semibold transition-colors",
              active
                ? "bg-gold text-black"
                : "bg-[#242424] border border-onyx-border/30 text-muted-foreground hover:border-gold/30 hover:text-foreground"
            )}
          >
            {name}
          </button>
        )
      })}
    </div>
  )
}

// ── TimeSelect ────────────────────────────────────────────────────────────────

function TimeSelect({ value, onChange, className }: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        "px-2 py-1 rounded-lg bg-[#1a1a1a] border border-onyx-border/30 text-xs text-foreground focus:outline-none focus:border-gold/50",
        className
      )}
      style={{ fontSize: "14px" }}
    >
      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  )
}

// ── CreateRecurringContract ───────────────────────────────────────────────────

function CreateRecurringContract({ onBack, onSuccess }: {
  onBack: () => void
  onSuccess: () => void
}) {
  const { clients, drivers, vehicles, enterprise } = useNox()
  const supabase = createClient()

  // Navigation
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 — infos générales
  const [label, setLabel] = useState("")
  const [notes, setNotes] = useState("")

  // Step 1 — client/passager
  const [selectedClientId, setSelectedClientId] = useState("")
  const [clientSearch, setClientSearch] = useState("")
  const [clientFocused, setClientFocused] = useState(false)
  const [inlineSelectedCompany, setInlineSelectedCompany] = useState<Client | null>(null)
  const [passagerNom, setPassagerNom] = useState("")
  const [passagerTelephone, setPassagerTelephone] = useState("")
  const [passengerSearch, setPassengerSearch] = useState("")
  const [showQuickAddClient, setShowQuickAddClient] = useState(false)
  const [showAllClients, setShowAllClients] = useState(false)
  const [modalClientSearch, setModalClientSearch] = useState("")

  // Step 1 — trajet
  const [departure, setDeparture] = useState("")
  const [arrival, setArrival] = useState("")
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [durationDisplay, setDurationDisplay] = useState("")
  const [isCalculating, setIsCalculating] = useState(false)

  // Step 1 — chauffeur/véhicule
  const [selectedDriverId, setSelectedDriverId] = useState("")
  const [selectedVehicleId, setSelectedVehicleId] = useState("")

  // Step 1 — tarif
  const [pricePerTrip, setPricePerTrip] = useState("")
  const [billingFrequency, setBillingFrequency] = useState<"monthly" | "weekly" | "manual">("monthly")

  // Step 1 — période
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [openEnded, setOpenEnded] = useState(false)

  // Step 2 — type de récurrence
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("fixed")

  // Step 2 — Mode "Horaire fixe"
  const [outboundDays, setOutboundDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [outboundTime, setOutboundTime] = useState("08:00")
  const [fixedReturnEnabled, setFixedReturnEnabled] = useState(false)
  const [fixedReturnTime, setFixedReturnTime] = useState("17:00")

  // Step 2 — Mode "Horaires variables"
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>(DEFAULT_DAY_SCHEDULES)

  // Step 2 — Mode "Aller/Retour dissociés" (custom)
  const [enableReturn, setEnableReturn] = useState(false)
  const [returnDays, setReturnDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [returnTime, setReturnTime] = useState("18:00")
  const [returnDeparture, setReturnDeparture] = useState("")

  // Step 2 — Exceptions (tous modes)
  const [excludeHolidays, setExcludeHolidays] = useState(true)
  const [country, setCountry] = useState("FR")
  const [excludedDates, setExcludedDates] = useState<string[]>([])
  const [excludeDateError, setExcludeDateError] = useState("")
  const [excludeDateWarning, setExcludeDateWarning] = useState("")

  // Step 3 — sauvegarde
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [previewNumero, setPreviewNumero] = useState("")

  // Step 3 — CGV contrat
  const [showCGVModal, setShowCGVModal] = useState(false)
  const [contractCgvText, setContractCgvText] = useState("")
  const [generateContractPDF, setGenerateContractPDF] = useState(false)

  useEffect(() => {
    if (enterprise) setContractCgvText(generateCGVSummary(enterprise))
  }, [enterprise]) // eslint-disable-line

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Computed
  const selectedClient = clients?.find(c => c.id === selectedClientId) ?? null

  const filteredClients = useMemo(() => {
    const list = clients ?? []
    const s = clientSearch.trim().toLowerCase()
    const filtered = s
      ? list.filter(c => {
          const name = `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().trim()
          const company = (c.raisonSociale ?? "").toLowerCase()
          return name.includes(s) || company.includes(s) ||
            (c.phone ?? "").includes(s) || (c.email ?? "").toLowerCase().includes(s)
        })
      : list
    return [...filtered].sort((a, b) => {
      const na = a.type === "particulier" ? `${a.prenom ?? ""} ${a.nom ?? ""}`.trim() : (a.raisonSociale ?? "")
      const nb = b.type === "particulier" ? `${b.prenom ?? ""} ${b.nom ?? ""}`.trim() : (b.raisonSociale ?? "")
      return na.localeCompare(nb, "fr")
    })
  }, [clientSearch, clients])

  const modalFilteredClients = useMemo(() => {
    const list = clients ?? []
    const s = modalClientSearch.trim().toLowerCase()
    const filtered = s
      ? list.filter(c => {
          const name = `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().trim()
          const company = (c.raisonSociale ?? "").toLowerCase()
          return name.includes(s) || company.includes(s) ||
            (c.phone ?? "").includes(s) || (c.email ?? "").toLowerCase().includes(s)
        })
      : list
    return [...filtered].sort((a, b) => {
      const na = a.type === "particulier" ? `${a.prenom ?? ""} ${a.nom ?? ""}`.trim() : (a.raisonSociale ?? "")
      const nb = b.type === "particulier" ? `${b.prenom ?? ""} ${b.nom ?? ""}`.trim() : (b.raisonSociale ?? "")
      return na.localeCompare(nb, "fr")
    })
  }, [modalClientSearch, clients])

  const filteredPassengers = useMemo(() => {
    if (!selectedClient?.contacts) return []
    if (!passengerSearch.trim()) return selectedClient.contacts
    const s = passengerSearch.toLowerCase()
    return selectedClient.contacts.filter(c =>
      `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().includes(s) ||
      (c.phone ?? "").includes(s)
    )
  }, [selectedClient, passengerSearch])

  // Auto-clear errors
  useEffect(() => {
    if (selectedClientId) setErrors(prev => { const e = { ...prev }; delete e.client; return e })
  }, [selectedClientId])
  useEffect(() => {
    if (departure.trim()) setErrors(prev => { const e = { ...prev }; delete e.departure; return e })
  }, [departure])
  useEffect(() => {
    if (arrival.trim()) setErrors(prev => { const e = { ...prev }; delete e.arrival; return e })
  }, [arrival])

  // Pré-remplir l'adresse de départ retour avec l'arrivée de l'étape 1
  useEffect(() => {
    if (enableReturn && !returnDeparture && arrival) setReturnDeparture(arrival)
  }, [enableReturn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pré-générer le numéro CR à l'entrée en étape 3
  useEffect(() => {
    if (step === 3 && !previewNumero) {
      supabase.rpc("generate_rc_numero").then(({ data }) => {
        if (typeof data === "string") setPreviewNumero(data)
      })
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  async function calculateDistance() {
    if (!departure || !arrival) return
    setIsCalculating(true)
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) throw new Error("Clé API manquante")
      const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify({
          origin: { address: departure },
          destination: { address: arrival },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      })
      if (!res.ok) throw new Error(`Routes API ${res.status}`)
      const data = await res.json()
      if (data.routes?.[0]) {
        const route = data.routes[0]
        const km = Math.round((route.distanceMeters ?? 0) / 1000)
        const rawSec = parseInt((route.duration ?? "0s").replace("s", ""), 10)
        if (km > 0) setDistanceKm(km)
        if (rawSec > 0) {
          const h = Math.floor(rawSec / 3600)
          const m = Math.floor((rawSec % 3600) / 60)
          setDurationDisplay(h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`)
        }
      }
    } catch {
      // silencieux — pas de valeur trompeuse
    } finally {
      setIsCalculating(false)
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!label.trim()) e.label = "Le label est obligatoire"
    if (!selectedClientId) e.client = "Veuillez sélectionner un client"
    if (!departure.trim()) e.departure = "L'adresse de départ est obligatoire"
    if (!arrival.trim()) e.arrival = "L'adresse d'arrivée est obligatoire"
    if (!selectedDriverId) e.driver = "Veuillez sélectionner un chauffeur"
    if (!selectedVehicleId) e.vehicle = "Veuillez sélectionner un véhicule"
    if (!pricePerTrip || parseFloat(pricePerTrip) <= 0) e.price = "Le prix par trajet est obligatoire"
    if (!startDate) {
      e.startDate = "La date de début est obligatoire"
    } else if (startDate < today) {
      e.startDate = "La date de début ne peut pas être dans le passé"
    }
    if (!openEnded && endDate && startDate && endDate < startDate) {
      e.endDate = "La date de fin doit être postérieure à la date de début"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (!validate()) return
    setStep(2)
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {}
    if (recurrenceType === "fixed") {
      if (outboundDays.length === 0) e.outboundDays = "Sélectionnez au moins un jour"
    } else if (recurrenceType === "variable") {
      const activeDays = daySchedules.filter(s => s.enabled)
      if (activeDays.length === 0) e.daySchedules = "Activez au moins un jour"
      activeDays.forEach(s => {
        if (!s.outboundTime) e[`day_${s.day}`] = "Heure aller obligatoire"
      })
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNextStep2() {
    if (!validateStep2()) return
    setStep(3)
  }

  function patchSchedule(idx: number, patch: Partial<DaySchedule>) {
    setDaySchedules(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function isDateInRange(date: string): boolean {
    if (!date || !startDate) return false
    if (date < startDate) return false
    if (!openEnded && endDate && date > endDate) return false
    return true
  }

  function getActiveDays(): number[] {
    if (recurrenceType === "variable") return daySchedules.filter(s => s.enabled).map(s => s.day)
    return outboundDays // fixed et custom utilisent outboundDays
  }

  function isDayWorked(date: string): boolean {
    const active = getActiveDays()
    if (active.length === 0) return true
    const jsDay = new Date(date + "T00:00:00").getDay()
    const ourDay = jsDay === 0 ? 7 : jsDay
    return active.includes(ourDay)
  }

  function handleAddExcludedDate(val: string) {
    setExcludeDateError("")
    setExcludeDateWarning("")
    if (!val || excludedDates.includes(val)) return
    if (!isDateInRange(val)) {
      const range = (!openEnded && endDate) ? `${startDate} → ${endDate}` : `à partir du ${startDate}`
      setExcludeDateError(`Cette date est en dehors de la période du contrat (${range})`)
      return
    }
    if (!isDayWorked(val)) {
      setExcludeDateWarning("⚠️ Ce jour n'est pas dans votre récurrence")
    }
    setExcludedDates(prev => [...prev, val].sort())
  }


  function getNextTrips(): TripPreview[] {
    if (!startDate) return []
    const results: TripPreview[] = []
    const activeDays = getActiveDays()
    const cursorStart = new Date(startDate + "T00:00:00")
    const endLimit = !openEnded && endDate
      ? new Date(endDate + "T00:00:00")
      : new Date(cursorStart.getTime() + 90 * 24 * 60 * 60 * 1000)
    let cursor = new Date(cursorStart)
    while (cursor <= endLimit && results.length < 5) {
      const isoDate = cursor.toISOString().split("T")[0]
      const jsDay = cursor.getDay()
      const ourDay = jsDay === 0 ? 7 : jsDay
      if (activeDays.includes(ourDay) && !excludedDates.includes(isoDate)) {
        let time = outboundTime
        if (recurrenceType === "variable") {
          const sched = daySchedules.find(s => s.day === ourDay && s.enabled)
          if (sched) time = sched.outboundTime
        }
        results.push({ date: isoDate, display: formatDate(isoDate), time })
      }
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    }
    return results
  }

  function getSaveData() {
    if (recurrenceType === "fixed") {
      return {
        outbound_days: [...outboundDays].sort((a, b) => a - b),
        outbound_time: outboundTime,
        return_enabled: fixedReturnEnabled,
        return_time: fixedReturnEnabled ? fixedReturnTime : null,
        return_days: null as number[] | null,
        return_departure: null as string | null,
        return_arrival: null as string | null,
        stops: null,
      }
    }
    if (recurrenceType === "variable") {
      const active = daySchedules.filter(s => s.enabled)
      return {
        outbound_days: active.map(s => s.day).sort((a, b) => a - b),
        outbound_time: active[0]?.outboundTime ?? null,
        return_enabled: active.some(s => s.returnEnabled),
        return_time: null as string | null,
        return_days: null as number[] | null,
        return_departure: null as string | null,
        return_arrival: null as string | null,
        stops: daySchedules as DaySchedule[],
      }
    }
    // custom
    return {
      outbound_days: [...outboundDays].sort((a, b) => a - b),
      outbound_time: outboundTime,
      return_enabled: enableReturn,
      return_time: enableReturn ? returnTime : null,
      return_days: enableReturn ? [...returnDays].sort((a, b) => a - b) : null,
      return_departure: enableReturn ? (returnDeparture || null) : null,
      return_arrival: enableReturn ? arrival : null,
      stops: null,
    }
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveError("")
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non authentifié")

      // Utiliser le numéro pré-généré à l'entrée étape 3
      const numero = previewNumero || (() => {
        const year = new Date().getFullYear()
        return `CR-${year}-${String(Date.now()).slice(-4)}`
      })()

      const saveData = getSaveData()

      const payload = {
        user_id: user.id,
        numero,
        label: label.trim(),
        notes: notes.trim() || null,
        client_id: selectedClientId || null,
        passenger_name: passagerNom.trim() || null,
        passenger_phone: passagerTelephone.trim() || null,
        departure,
        arrival,
        distance_km: distanceKm,
        driver_id: selectedDriverId || null,
        vehicle_id: selectedVehicleId || null,
        price_per_trip: parseFloat(pricePerTrip),
        billing_frequency: billingFrequency,
        start_date: startDate,
        end_date: openEnded ? null : (endDate || null),
        no_end_date: openEnded,
        recurrence_type: recurrenceType,
        exclude_holidays: excludeHolidays,
        country_code: excludeHolidays ? country : null,
        excluded_dates: excludedDates.length > 0 ? excludedDates : null,
        status: "active",
        ...saveData,
      }

      const { data: newContract, error } = await supabase
        .from("recurring_contracts")
        .insert(payload)
        .select()
        .single()

      if (error) {
        console.error("Recurring contract save error:", JSON.stringify(error, null, 2))
        console.error("Payload:", JSON.stringify(payload, null, 2))
        setSaveError(`Erreur : ${error.message} (code : ${error.code})`)
        return
      }

      console.log("Recurring contract created:", newContract)

      if (generateContractPDF && newContract) {
        const clientForPDF = clients?.find(c => c.id === selectedClientId)
        const clientNamePDF = clientForPDF
          ? clientForPDF.type === "particulier"
            ? `${clientForPDF.prenom ?? ""} ${clientForPDF.nom ?? ""}`.trim()
            : (clientForPDF.raisonSociale ?? "")
          : passagerNom
        const selDriverPDF = drivers?.find(d => d.id === selectedDriverId)
        const selVehiclePDF = vehicles?.find(v => v.id === selectedVehicleId)
        const saveData = getSaveData()
        generateRecurringContractPDF({
          numero: (newContract as { numero?: string }).numero ?? numero,
          createdAt: today,
          enterpriseName: enterprise.name,
          enterpriseSiren: enterprise.siren || undefined,
          enterpriseEvtc: enterprise.evtcNumber || undefined,
          enterpriseAddress: [enterprise.adresse, enterprise.zipCode, enterprise.city].filter(Boolean).join(", ") || undefined,
          enterpriseLogo: enterprise.logo || undefined,
          enterprisePhone: enterprise.phone || undefined,
          clientName: clientNamePDF,
          passengerName: passagerNom.trim() || undefined,
          passengerPhone: passagerTelephone.trim() || undefined,
          departure,
          arrival,
          distanceKm: distanceKm ?? undefined,
          estimatedDuration: durationDisplay || undefined,
          recurrenceType,
          outboundDays: saveData.outbound_days,
          outboundTime: saveData.outbound_time,
          returnEnabled: saveData.return_enabled,
          returnDays: saveData.return_days ?? undefined,
          returnTime: saveData.return_time ?? undefined,
          daySchedules: recurrenceType === "variable" ? daySchedules : undefined,
          driverName: selDriverPDF?.name,
          vehicleName: selVehiclePDF
            ? `${selVehiclePDF.marque ? `${selVehiclePDF.marque} ` : ""}${selVehiclePDF.modele} — ${selVehiclePDF.immatriculation}`
            : undefined,
          startDate,
          endDate: openEnded ? null : (endDate || null),
          noEndDate: openEnded,
          excludeHolidays,
          countryCode: country,
          pricePerTrip: parseFloat(pricePerTrip),
          billingFrequency,
          cgvText: contractCgvText || undefined,
        })
      }

      onSuccess()
    } catch (err: unknown) {
      console.error("Unexpected save error:", err)
      setSaveError(err instanceof Error ? err.message : "Erreur inattendue lors de la sauvegarde")
    } finally {
      setIsSaving(false)
    }
  }

  const inputClass = (err?: string) => cn(
    "w-full px-3 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50",
    err ? "border-red-500" : "border-onyx-border/30"
  )

  return (
    <div className="flex flex-col min-h-full bg-background">

      {/* ── Étape 1 ──────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d] sticky top-0 z-10">
            <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-foreground">Nouveau contrat récurrent</h1>
              <p className="text-[10px] text-muted-foreground">Étape 1/3 — Informations générales</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">

            <Section title="Informations générales" icon={FileText}>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Label du contrat <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={e => { setLabel(e.target.value); if (e.target.value.trim()) setErrors(prev => { const er = { ...prev }; delete er.label; return er }) }}
                  placeholder="Ex: Transport scolaire Dupont, Mission Entreprise Durand..."
                  className={inputClass(errors.label)}
                  style={{ fontSize: "16px" }}
                />
                {errors.label && <p className="text-xs text-red-500">{errors.label}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Notes <span className="text-muted-foreground/50 normal-case">(optionnel)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Instructions particulières, code portail, informations complémentaires..."
                  rows={3}
                  className={cn(inputClass(), "resize-none")}
                  style={{ fontSize: "16px" }}
                />
              </div>
            </Section>

            <Section title="Client & Passager" icon={Building2}>
              <button
                type="button"
                onClick={() => setShowQuickAddClient(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#242424] border border-dashed border-gold/30 text-gold text-[11px] font-medium hover:bg-gold/5 hover:border-gold/50 transition-all"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Ajouter un nouveau client
              </button>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Rechercher un client <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setInlineSelectedCompany(null) }}
                      onFocus={() => setClientFocused(true)}
                      onBlur={() => setTimeout(() => setClientFocused(false), 200)}
                      placeholder="Nom, société, téléphone..."
                      className={cn("w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50", errors.client ? "border-red-500" : "border-onyx-border/30")}
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowAllClients(true); setModalClientSearch("") }}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-[11px] text-muted-foreground hover:border-gold/30 hover:text-gold transition-colors whitespace-nowrap"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Voir tous
                  </button>
                </div>
                {errors.client && <p className="text-xs text-red-500">{errors.client}</p>}
              </div>

              {(clientFocused || clientSearch.trim() || !!inlineSelectedCompany) && !selectedClientId && (
                <div className="max-h-[200px] overflow-y-auto rounded-xl bg-[#242424] border border-onyx-border/30 divide-y divide-onyx-border/20">
                  {inlineSelectedCompany ? (
                    <>
                      <button type="button" className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left"
                        onClick={() => setInlineSelectedCompany(null)}>
                        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground truncate">{inlineSelectedCompany.raisonSociale}</span>
                      </button>
                      <button type="button" className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                        onClick={() => { setSelectedClientId(inlineSelectedCompany.id); setClientSearch(""); setClientFocused(false); setInlineSelectedCompany(null) }}>
                        <div className="w-8 h-8 rounded-full bg-onyx-card border border-onyx-border/30 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Sans passager distinct</p>
                          <p className="text-[10px] text-muted-foreground">Société = client et passager</p>
                        </div>
                      </button>
                      {inlineSelectedCompany.contacts!.map(contact => (
                        <button key={contact.id} type="button" className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                          onClick={() => {
                            setSelectedClientId(inlineSelectedCompany.id)
                            setPassagerNom(`${contact.prenom ?? ""} ${contact.nom ?? ""}`.trim())
                            if (contact.phone) setPassagerTelephone(contact.phone)
                            setClientSearch(""); setClientFocused(false); setInlineSelectedCompany(null)
                          }}>
                          <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold flex-shrink-0">
                            {(contact.prenom?.[0] ?? "").toUpperCase()}{(contact.nom?.[0] ?? "").toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{contact.prenom} {contact.nom}</p>
                            {contact.phone && <p className="text-[10px] text-muted-foreground truncate">{contact.phone}</p>}
                          </div>
                        </button>
                      ))}
                    </>
                  ) : filteredClients.length === 0 ? (
                    <p className="px-4 py-3 text-[11px] text-muted-foreground italic">
                      {(clients ?? []).length === 0 ? "Aucun client enregistré" : "Aucun résultat"}
                    </p>
                  ) : (
                    filteredClients.slice(0, 8).map(c => (
                      <button key={c.id} type="button" className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                        onClick={() => {
                          if (c.type === "professionnel" && (c.contacts?.length ?? 0) > 0) {
                            setInlineSelectedCompany(c)
                          } else {
                            setSelectedClientId(c.id); setClientSearch(""); setClientFocused(false)
                          }
                        }}>
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold flex-shrink-0">
                          {c.type === "particulier"
                            ? `${c.prenom?.[0] ?? ""}${c.nom?.[0] ?? ""}`.toUpperCase()
                            : (c.raisonSociale?.[0] ?? "").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {c.type === "particulier" ? `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() : (c.raisonSociale ?? "")}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {c.type === "professionnel"
                              ? `${c.contacts?.length ?? 0} passager${(c.contacts?.length ?? 0) !== 1 ? "s" : ""}`
                              : (c.phone ?? "")}
                          </p>
                        </div>
                        {c.type === "professionnel" && (c.contacts?.length ?? 0) > 0 && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {selectedClient && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-[#242424] border border-gold/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        {selectedClient.type === "particulier"
                          ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}`.trim()
                          : (selectedClient.raisonSociale ?? "")}
                      </p>
                      <button
                        onClick={() => { setSelectedClientId(""); setPassagerNom(""); setPassagerTelephone(""); setPassengerSearch("") }}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Modifier
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{selectedClient.phone ?? ""} • {selectedClient.email ?? ""}</p>
                    {selectedClient.type === "professionnel" && selectedClient.siren && (
                      <p className="text-[11px] text-gold">SIREN : {selectedClient.siren}</p>
                    )}
                  </div>

                  {selectedClient.type === "professionnel" && (
                    <div className="space-y-2 pt-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Passager transporté <span className="text-muted-foreground/50 normal-case">(si différent du client payeur)</span>
                      </label>
                      {selectedClient.contacts && selectedClient.contacts.length > 0 && !passagerNom && (
                        <div className="space-y-1">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                              type="text"
                              value={passengerSearch}
                              onChange={e => setPassengerSearch(e.target.value)}
                              placeholder="Rechercher un passager existant..."
                              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                              style={{ fontSize: "16px" }}
                            />
                          </div>
                          {passengerSearch.trim() && (
                            <div className="rounded-xl bg-[#242424] border border-onyx-border/30 overflow-hidden">
                              {filteredPassengers.length > 0 ? filteredPassengers.map(contact => (
                                <button key={contact.id} type="button"
                                  onClick={() => { setPassagerNom(`${contact.prenom ?? ""} ${contact.nom ?? ""}`.trim()); if (contact.phone) setPassagerTelephone(contact.phone); setPassengerSearch("") }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left border-b border-onyx-border/20 last:border-0">
                                  <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold shrink-0">
                                    {(contact.prenom?.[0] ?? "").toUpperCase()}{(contact.nom?.[0] ?? "").toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{contact.prenom} {contact.nom}</p>
                                    {contact.phone && <p className="text-[10px] text-muted-foreground truncate">{contact.phone}</p>}
                                  </div>
                                </button>
                              )) : (
                                <p className="px-3 py-2.5 text-[11px] text-muted-foreground/60 italic">Aucun passager trouvé</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <input type="text" value={passagerNom} onChange={e => setPassagerNom(e.target.value)}
                        placeholder="Nom du passager"
                        className={inputClass()}
                        style={{ fontSize: "16px" }} />
                      <input type="tel" value={passagerTelephone} onChange={e => setPassagerTelephone(e.target.value)}
                        placeholder="Téléphone du passager"
                        className={inputClass()}
                        style={{ fontSize: "16px" }} />
                    </div>
                  )}
                </div>
              )}
            </Section>

            <Section title="Trajet" icon={Navigation}>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Adresse de départ <span className="text-red-500">*</span>
                </label>
                <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border focus-within:border-gold/50", errors.departure ? "border-red-500" : "border-onyx-border/30")}>
                  <MapPin className="h-4 w-4 text-green-400 flex-shrink-0" strokeWidth={1.5} />
                  <PlacesAutocomplete value={departure} onChange={v => { setDeparture(v); setDistanceKm(null); setDurationDisplay("") }}
                    placeholder="Rechercher une adresse..."
                    addressMode="full"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                    style={{ fontSize: "16px" }} />
                  {departure && <button type="button" onClick={() => { setDeparture(""); setDistanceKm(null); setDurationDisplay("") }} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="h-4 w-4" /></button>}
                </div>
                {errors.departure && <p className="text-xs text-red-500">{errors.departure}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Adresse d&apos;arrivée <span className="text-red-500">*</span>
                </label>
                <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border focus-within:border-gold/50", errors.arrival ? "border-red-500" : "border-onyx-border/30")}>
                  <MapPin className="h-4 w-4 text-red-400 flex-shrink-0" strokeWidth={1.5} />
                  <PlacesAutocomplete value={arrival} onChange={v => { setArrival(v); setDistanceKm(null); setDurationDisplay("") }}
                    placeholder="Rechercher une adresse..."
                    addressMode="full"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                    style={{ fontSize: "16px" }} />
                  {arrival && <button type="button" onClick={() => { setArrival(""); setDistanceKm(null); setDurationDisplay("") }} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="h-4 w-4" /></button>}
                </div>
                {errors.arrival && <p className="text-xs text-red-500">{errors.arrival}</p>}
              </div>

              {departure && arrival && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void calculateDistance()}
                    disabled={isCalculating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#242424] border border-onyx-border/30 text-[11px] text-muted-foreground hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50"
                  >
                    {isCalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                    Calculer la distance
                  </button>
                  {distanceKm !== null && (
                    <p className="text-[11px] text-gold font-medium">
                      {distanceKm} km{durationDisplay ? ` · ${durationDisplay}` : ""}
                    </p>
                  )}
                </div>
              )}
            </Section>

            <Section title="Chauffeur & Véhicule" icon={Car}>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Chauffeur <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedDriverId}
                  onChange={e => { setSelectedDriverId(e.target.value); setErrors(prev => { const er = { ...prev }; delete er.driver; return er }) }}
                  className={cn("w-full px-3 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground focus:outline-none focus:border-gold/50", errors.driver ? "border-red-500" : "border-onyx-border/30")}
                  style={{ fontSize: "16px" }}
                >
                  <option value="" disabled>Sélectionner un chauffeur...</option>
                  {(drivers ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {errors.driver && <p className="text-xs text-red-500">{errors.driver}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Véhicule <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={e => { setSelectedVehicleId(e.target.value); setErrors(prev => { const er = { ...prev }; delete er.vehicle; return er }) }}
                  className={cn("w-full px-3 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground focus:outline-none focus:border-gold/50", errors.vehicle ? "border-red-500" : "border-onyx-border/30")}
                  style={{ fontSize: "16px" }}
                >
                  <option value="" disabled>Sélectionner un véhicule...</option>
                  {(vehicles ?? []).map(v => <option key={v.id} value={v.id}>{v.marque ? `${v.marque} ` : ""}{v.modele} — {v.immatriculation}</option>)}
                </select>
                {errors.vehicle && <p className="text-xs text-red-500">{errors.vehicle}</p>}
              </div>
            </Section>

            <Section title="Tarif" icon={Euro}>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Prix par trajet (€) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerTrip}
                  onChange={e => { setPricePerTrip(e.target.value); if (parseFloat(e.target.value) > 0) setErrors(prev => { const er = { ...prev }; delete er.price; return er }) }}
                  placeholder="0.00"
                  className={inputClass(errors.price)}
                  style={{ fontSize: "16px" }}
                />
                <p className="text-[10px] text-muted-foreground">Prix convenu avec le client pour chaque trajet</p>
                {errors.price && <p className="text-xs text-red-500">{errors.price}</p>}
              </div>
            </Section>

            <Section title="Période" icon={User}>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Date de début <span className="text-red-500">*</span>
                </label>
                <div className="overflow-hidden max-w-full">
                  <input
                    type="date"
                    value={startDate}
                    min={today}
                    onChange={e => { setStartDate(e.target.value); setErrors(prev => { const er = { ...prev }; delete er.startDate; return er }) }}
                    className={cn(inputClass(errors.startDate), "max-w-full box-border")}
                    style={{ fontSize: "16px" }}
                  />
                </div>
                {errors.startDate && <p className="text-xs text-red-500">{errors.startDate}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Date de fin</label>
                <div className="overflow-hidden max-w-full">
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || today}
                    disabled={openEnded}
                    onChange={e => { setEndDate(e.target.value); setErrors(prev => { const er = { ...prev }; delete er.endDate; return er }) }}
                    className={cn(inputClass(errors.endDate), "max-w-full box-border", openEnded && "opacity-40 cursor-not-allowed")}
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={openEnded}
                    onCheckedChange={v => { setOpenEnded(!!v); if (v) { setEndDate(""); setErrors(prev => { const er = { ...prev }; delete er.endDate; return er }) } }}
                  />
                  <span className="text-[11px] text-muted-foreground">Sans date de fin (contrat ouvert)</span>
                </label>
                {errors.endDate && <p className="text-xs text-red-500">{errors.endDate}</p>}
              </div>
            </Section>

            <Section title="Fréquence de facturation" icon={Euro}>
              <div className="space-y-2">
                {([
                  { value: "monthly", label: "Automatique (1er du mois)", desc: "Document généré automatiquement le 1er de chaque mois" },
                  { value: "weekly",  label: "Automatique (chaque lundi)", desc: "Document généré automatiquement chaque début de semaine" },
                  { value: "manual",  label: "Manuelle uniquement", desc: "Vous générez le document quand vous voulez" },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBillingFrequency(opt.value)}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors",
                      billingFrequency === opt.value
                        ? "bg-gold/10 border-gold/40"
                        : "bg-[#242424] border-onyx-border/30 hover:border-gold/20"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center",
                      billingFrequency === opt.value ? "border-gold" : "border-muted-foreground/40"
                    )}>
                      {billingFrequency === opt.value && <div className="w-2 h-2 rounded-full bg-gold" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                ))}
                <p className="text-[10px] text-muted-foreground pt-1">
                  💡 Vous pouvez toujours générer un document manuellement depuis le détail du contrat.
                </p>
              </div>
            </Section>

            <div className="px-0 pb-32 pt-2">
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-4 rounded-2xl bg-gold text-black font-bold text-base active:scale-[0.98] transition-all"
              >
                Suivant — Configurer la récurrence →
              </button>
            </div>
          </div>

          {/* Modal "Voir tous les clients" */}
          {showAllClients && (
            <div className="fixed inset-0 z-[10000] bg-black/70 flex flex-col" onClick={() => setShowAllClients(false)}>
              <div className="mt-auto w-full max-h-[80vh] bg-[#1a1a1a] rounded-t-3xl flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2" />
                <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/20">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={modalClientSearch}
                      onChange={e => setModalClientSearch(e.target.value)}
                      placeholder="Rechercher..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }}
                      autoFocus
                    />
                  </div>
                  <button onClick={() => setShowAllClients(false)} className="p-2 rounded-lg hover:bg-white/5">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <p className="px-4 py-2 text-[10px] text-muted-foreground">
                  {(clients ?? []).length} client{(clients ?? []).length !== 1 ? "s" : ""} enregistré{(clients ?? []).length !== 1 ? "s" : ""}
                </p>
                <div className="flex-1 overflow-y-auto divide-y divide-onyx-border/20 pb-4">
                  {modalFilteredClients.length === 0 ? (
                    <p className="px-4 py-4 text-[11px] text-muted-foreground italic">Aucun résultat</p>
                  ) : modalFilteredClients.map(c => (
                    <button key={c.id} type="button"
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left"
                      onClick={() => {
                        if (c.type === "professionnel" && (c.contacts?.length ?? 0) > 0) {
                          setInlineSelectedCompany(c)
                        } else {
                          setSelectedClientId(c.id)
                          setClientSearch("")
                        }
                        setShowAllClients(false)
                      }}>
                      <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold flex-shrink-0">
                        {c.type === "particulier"
                          ? `${c.prenom?.[0] ?? ""}${c.nom?.[0] ?? ""}`.toUpperCase()
                          : (c.raisonSociale?.[0] ?? "").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.type === "particulier" ? `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() : (c.raisonSociale ?? "")}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {c.type === "professionnel"
                            ? `${c.contacts?.length ?? 0} passager${(c.contacts?.length ?? 0) !== 1 ? "s" : ""}`
                            : (c.phone ?? "")}
                        </p>
                      </div>
                      {c.type === "professionnel" && (c.contacts?.length ?? 0) > 0 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <QuickAddClientModal
            open={showQuickAddClient}
            onClose={() => setShowQuickAddClient(false)}
            clients={clients ?? []}
            onClientCreated={(clientId) => {
              setSelectedClientId(clientId)
              setShowQuickAddClient(false)
            }}
          />
        </>
      )}

      {/* ── Étape 2 ──────────────────────────────────────────────────────────── */}
      {step === 2 && (
        <>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d] sticky top-0 z-10">
            <button onClick={() => setStep(1)} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-foreground">Nouveau contrat récurrent</h1>
              <p className="text-[10px] text-muted-foreground">Étape 2/3 — Récurrence</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">

            {/* Type de récurrence */}
            <Section title="Type de récurrence" icon={RefreshCw}>
              <div className="flex gap-2">
                {([
                  { value: "fixed",    label: "Horaire fixe" },
                  { value: "variable", label: "Horaires variables" },
                  { value: "custom",   label: "Aller/Retour dissociés" },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRecurrenceType(opt.value)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-[11px] font-semibold transition-colors border leading-tight px-1",
                      recurrenceType === opt.value
                        ? "bg-gold text-black border-gold"
                        : "bg-[#242424] text-muted-foreground border-onyx-border/30 hover:border-gold/30 hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* ── Mode 1 : Horaire fixe ───────────────────────────────────────── */}
            {recurrenceType === "fixed" && (
              <Section title="Jours actifs" icon={Navigation}>
                <DaysSelector selected={outboundDays} onChange={v => { setOutboundDays(v); setErrors(prev => { const er = { ...prev }; delete er.outboundDays; return er }) }} />
                {errors.outboundDays && <p className="text-xs text-red-500">{errors.outboundDays}</p>}

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Heure de prise en charge <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={outboundTime}
                    onChange={e => setOutboundTime(e.target.value)}
                    className={inputClass()}
                    style={{ fontSize: "16px" }}
                  >
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <Checkbox checked={fixedReturnEnabled} onCheckedChange={v => setFixedReturnEnabled(!!v)} />
                  <span className="text-[11px] text-muted-foreground">Activer le retour</span>
                </label>

                {fixedReturnEnabled && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Heure de retour <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={fixedReturnTime}
                      onChange={e => setFixedReturnTime(e.target.value)}
                      className={inputClass()}
                      style={{ fontSize: "16px" }}
                    >
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </Section>
            )}

            {/* ── Mode 2 : Horaires variables ─────────────────────────────────── */}
            {recurrenceType === "variable" && (
              <Section title="Horaires par jour" icon={Navigation}>
                {errors.daySchedules && <p className="text-xs text-red-500 mb-1">{errors.daySchedules}</p>}
                <div className="space-y-2">
                  {daySchedules.map((sched, idx) => (
                    <div
                      key={sched.day}
                      className={cn(
                        "rounded-xl border overflow-hidden",
                        sched.enabled ? "border-gold/20 bg-[#242424]" : "border-onyx-border/20 bg-[#1e1e1e]"
                      )}
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
                        {/* Toggle jour */}
                        <button
                          type="button"
                          onClick={() => patchSchedule(idx, { enabled: !sched.enabled })}
                          className={cn(
                            "w-9 h-9 rounded-full flex-shrink-0 text-xs font-semibold transition-colors",
                            sched.enabled
                              ? "bg-gold text-black"
                              : "bg-[#2a2a2a] border border-onyx-border/30 text-muted-foreground"
                          )}
                        >
                          {DAY_NAMES[sched.day - 1]}
                        </button>

                        {sched.enabled && (
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground">Aller</span>
                              <TimeSelect value={sched.outboundTime} onChange={v => patchSchedule(idx, { outboundTime: v })} />
                            </div>

                            {sched.returnEnabled && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">Retour</span>
                                <TimeSelect value={sched.returnTime} onChange={v => patchSchedule(idx, { returnTime: v })} />
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => patchSchedule(idx, { returnEnabled: !sched.returnEnabled })}
                              className={cn(
                                "text-[10px] px-2 py-1 rounded-lg border transition-colors",
                                sched.returnEnabled
                                  ? "bg-gold/10 text-gold border-gold/30 hover:bg-gold/20"
                                  : "bg-[#1a1a1a] text-muted-foreground border-onyx-border/30 hover:border-gold/30 hover:text-gold"
                              )}
                            >
                              {sched.returnEnabled ? "− Retour" : "+ Retour"}
                            </button>
                          </div>
                        )}
                      </div>
                      {errors[`day_${sched.day}`] && (
                        <p className="px-3 pb-2 text-xs text-red-500">{errors[`day_${sched.day}`]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Mode 3 : Aller/Retour dissociés (custom) ────────────────────── */}
            {recurrenceType === "custom" && (
              <Section title="Planification" icon={Navigation}>
                <p className="text-[10px] uppercase tracking-wider text-gold font-semibold">Trajet aller</p>
                <DaysSelector selected={outboundDays} onChange={setOutboundDays} />
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Heure de prise en charge
                  </label>
                  <select
                    value={outboundTime}
                    onChange={e => setOutboundTime(e.target.value)}
                    className={inputClass()}
                    style={{ fontSize: "16px" }}
                  >
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <Checkbox checked={enableReturn} onCheckedChange={v => setEnableReturn(!!v)} />
                  <span className="text-[11px] text-muted-foreground">Activer le retour</span>
                </label>

                {enableReturn && (
                  <div className="space-y-3 pt-2 border-t border-onyx-border/20">
                    <p className="text-[10px] uppercase tracking-wider text-gold font-semibold">Trajet retour</p>
                    <DaysSelector selected={returnDays} onChange={setReturnDays} />
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Heure de retour
                      </label>
                      <select
                        value={returnTime}
                        onChange={e => setReturnTime(e.target.value)}
                        className={inputClass()}
                        style={{ fontSize: "16px" }}
                      >
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Adresse de départ retour
                      </label>
                      <input
                        type="text"
                        value={returnDeparture}
                        onChange={e => setReturnDeparture(e.target.value)}
                        placeholder="Adresse de départ pour le retour..."
                        className={inputClass()}
                        style={{ fontSize: "16px" }}
                      />
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* ── Exceptions (tous modes) ──────────────────────────────────────── */}
            <Section title="Exceptions" icon={FileText}>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox checked={excludeHolidays} onCheckedChange={v => setExcludeHolidays(!!v)} />
                  <span className="text-[11px] text-foreground">Exclure les jours fériés</span>
                </label>

                {excludeHolidays && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Pays (pour les jours fériés)
                    </label>
                    <select
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      className={inputClass()}
                      style={{ fontSize: "16px" }}
                    >
                      {Object.entries(COUNTRY_LABELS).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Dates à exclure manuellement
                </p>
                {excludedDates.map(date => (
                  <div key={date} className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#242424] border border-onyx-border/30">
                    <span className="text-sm text-foreground">{date}</span>
                    <button
                      type="button"
                      onClick={() => setExcludedDates(prev => prev.filter(d => d !== date))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#242424] border border-dashed border-gold/30 text-gold text-[11px] font-medium hover:bg-gold/5 hover:border-gold/50 transition-all cursor-pointer">
                  <Plus className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
                  Ajouter une date
                  <input
                    type="date"
                    min={startDate || today}
                    max={!openEnded && endDate ? endDate : ""}
                    className="sr-only"
                    onChange={e => {
                      const val = e.target.value
                      handleAddExcludedDate(val)
                      e.target.value = ""
                    }}
                  />
                </label>
                {excludeDateError && (
                  <p className="text-xs text-red-500">{excludeDateError}</p>
                )}
                {!excludeDateError && excludeDateWarning && (
                  <p className="text-xs text-orange-400">{excludeDateWarning}</p>
                )}
              </div>
            </Section>

            <div className="px-0 pb-32 pt-2">
              <button
                type="button"
                onClick={handleNextStep2}
                className="w-full py-4 rounded-2xl bg-gold text-black font-bold text-base active:scale-[0.98] transition-all"
              >
                Suivant — Récapitulatif →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Étape 3 ──────────────────────────────────────────────────────────── */}
      {step === 3 && (
        <>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d] sticky top-0 z-10">
            <button onClick={() => setStep(2)} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-foreground">Nouveau contrat récurrent</h1>
              <p className="text-[10px] text-muted-foreground">Étape 3/3 — Récapitulatif</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">

            <Section title="Contrat" icon={FileText}>
              <RecapRow label="Référence" value={
                <span className="font-mono text-gold">
                  {previewNumero || "Génération..."}
                </span>
              } />
              <RecapRow label="Label" value={label} />
              {notes.trim() && <RecapRow label="Notes" value={notes} />}
            </Section>

            <Section title="Client" icon={Building2}>
              <RecapRow label="Client" value={
                selectedClient?.type === "particulier"
                  ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}`.trim()
                  : (selectedClient?.raisonSociale ?? "")
              } />
              {passagerNom && <RecapRow label="Passager" value={passagerNom} />}
              {passagerTelephone && <RecapRow label="Tél. passager" value={passagerTelephone} />}
            </Section>

            <Section title="Trajet" icon={Navigation}>
              <RecapRow label="Départ" value={departure} />
              <RecapRow label="Arrivée" value={arrival} />
              {distanceKm !== null && (
                <RecapRow label="Distance" value={`${distanceKm} km${durationDisplay ? ` · ${durationDisplay}` : ""}`} />
              )}
            </Section>

            <Section title="Opérateur" icon={Car}>
              <RecapRow label="Chauffeur" value={drivers?.find(d => d.id === selectedDriverId)?.name ?? selectedDriverId} />
              <RecapRow label="Véhicule" value={(() => {
                const veh = vehicles?.find(v => v.id === selectedVehicleId)
                return veh ? `${veh.marque ? `${veh.marque} ` : ""}${veh.modele} — ${veh.immatriculation}` : selectedVehicleId
              })()} />
            </Section>

            <Section title="Tarif & Facturation" icon={Euro}>
              <RecapRow label="Prix / trajet" value={`${parseFloat(pricePerTrip).toFixed(2)} €`} />
              <RecapRow
                label="Fréquence"
                value={
                  billingFrequency === "monthly"
                    ? "Automatique (1er du mois)"
                    : billingFrequency === "weekly"
                      ? "Automatique (chaque lundi)"
                      : "Manuelle uniquement"
                }
              />
            </Section>

            <Section title="Récurrence" icon={RefreshCw}>
              <RecapRow label="Mode" value={RECURRENCE_LABELS[recurrenceType]} />
              {recurrenceType === "fixed" && (
                <>
                  <RecapRow label="Jours" value={formatDays(outboundDays)} />
                  <RecapRow label="Heure aller" value={outboundTime} />
                  <RecapRow label="Retour" value={fixedReturnEnabled ? `Activé — ${fixedReturnTime}` : "Non activé"} />
                </>
              )}
              {recurrenceType === "variable" && daySchedules.filter(s => s.enabled).map(s => (
                <RecapRow
                  key={s.day}
                  label={DAY_NAMES[s.day - 1]}
                  value={s.returnEnabled ? `Aller ${s.outboundTime} · Retour ${s.returnTime}` : `Aller ${s.outboundTime}`}
                />
              ))}
              {recurrenceType === "custom" && (
                <>
                  <RecapRow label="Jours aller" value={formatDays(outboundDays)} />
                  <RecapRow label="Heure aller" value={outboundTime} />
                  {enableReturn && (
                    <>
                      <RecapRow label="Jours retour" value={formatDays(returnDays)} />
                      <RecapRow label="Heure retour" value={returnTime} />
                      {returnDeparture && <RecapRow label="Départ retour" value={returnDeparture} />}
                      <RecapRow label="Arrivée retour" value={arrival} />
                    </>
                  )}
                </>
              )}
            </Section>

            <Section title="Période" icon={FileText}>
              <RecapRow label="Début" value={formatDate(startDate)} />
              {openEnded
                ? <RecapRow label="Fin" value="Contrat ouvert" />
                : endDate && <RecapRow label="Fin" value={formatDate(endDate)} />
              }
              <RecapRow label="Pays" value={COUNTRY_LABELS[country] ?? country} />
              <RecapRow label="Jours fériés" value={excludeHolidays ? "Exclus" : "Non exclus"} />
              <RecapRow label="Dates exclues" value={
                excludedDates.length > 0
                  ? <span className="text-right leading-relaxed">{excludedDates.map(d => formatDate(d)).join(", ")}</span>
                  : "Aucune"
              } />
            </Section>

            {(() => {
              const trips = getNextTrips()
              if (trips.length === 0) return null
              return (
                <Section title="Prochains trajets" icon={Navigation}>
                  <div className="space-y-0">
                    {trips.map(t => (
                      <div key={t.date} className="flex items-center justify-between py-2 border-b border-onyx-border/20 last:border-0">
                        <span className="text-sm text-foreground">{t.display}</span>
                        <span className="text-[11px] text-gold font-semibold">{t.time}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1">5 premiers trajets prévisionnels</p>
                </Section>
              )
            })()}

            <Section title="Conditions Générales de Vente" icon={FileText}>
              <div className="text-xs text-muted-foreground bg-[#111] rounded-xl p-3 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {contractCgvText || "Aucune CGV configurée"}
              </div>
              <button
                type="button"
                onClick={() => setShowCGVModal(true)}
                className="text-xs text-gold underline mt-1"
              >
                ✏️ Modifier pour ce contrat
              </button>
            </Section>

            <label className="flex items-center gap-3 px-1 cursor-pointer">
              <Checkbox
                checked={generateContractPDF}
                onCheckedChange={v => setGenerateContractPDF(!!v)}
              />
              <span className="text-sm text-foreground">Générer le contrat PDF après création</span>
            </label>

            {saveError && (
              <p className="text-sm text-red-500 text-center py-1">{saveError}</p>
            )}

            <div className="px-0 pb-32 pt-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="w-full py-4 rounded-2xl bg-gold text-black font-bold text-base active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="h-5 w-5 animate-spin" />}
                {isSaving ? "Enregistrement..." : "Créer le contrat"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modale — Modifier CGV pour ce contrat */}
      {showCGVModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 flex items-end" onClick={() => setShowCGVModal(false)}>
          <div className="w-full bg-[#1a1a1a] rounded-t-3xl flex flex-col" style={{ maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
            <div className="flex-shrink-0 px-5 pt-5 pb-3">
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
              <p className="text-base font-bold text-foreground">Conditions Générales de Vente</p>
              <p className="text-xs text-muted-foreground mt-1">Modification spécifique à ce contrat — ne modifie pas vos CGV dans les Réglages.</p>
            </div>
            <div className="overflow-y-auto flex-1 px-5">
              <textarea
                value={contractCgvText}
                onChange={e => setContractCgvText(e.target.value)}
                rows={10}
                className="w-full px-3 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:border-gold/50"
              />
            </div>
            <div className="flex gap-3 px-5 pt-3 pb-5 flex-shrink-0 border-t border-onyx-border/20" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
              <button
                type="button"
                onClick={() => setShowCGVModal(false)}
                className="flex-1 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-muted-foreground"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => setShowCGVModal(false)}
                className="flex-1 py-3 rounded-xl bg-gold text-black text-sm font-bold active:scale-95 transition-all"
              >
                Valider
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}

// ── ContractDetailScreen ──────────────────────────────────────────────────────

const tripStatusConfig = {
  upcoming:  { label: "À venir",     cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  confirmed: { label: "Confirmé",    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  completed: { label: "Réalisé",     cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  cancelled: { label: "Annulé",      cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  missed:    { label: "Non réalisé", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
}

function ContractDetailScreen({ contract, onBack, onContractUpdated }: {
  contract: RecurringContract
  onBack: () => void
  onContractUpdated: (updated: RecurringContract) => void
}) {
  const supabase = createClient()
  const { clients, drivers, vehicles, enterprise } = useNox()

  const [trips, setTrips] = useState<RecurringTrip[]>([])
  const [loadingTrips, setLoadingTrips] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [openTripMenu, setOpenTripMenu] = useState<string | null>(null)
  const [cancelTripId, setCancelTripId] = useState<string | null>(null)

  const [showPauseModal, setShowPauseModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [endDateValue, setEndDateValue] = useState(today)
  const [endModalError, setEndModalError] = useState("")
  const [generateFinalInvoice, setGenerateFinalInvoice] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [showGenerateInvoice, setShowGenerateInvoice] = useState(false)
  const [invoicePeriodStart, setInvoicePeriodStart] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
  })
  const [invoicePeriodEnd, setInvoicePeriodEnd] = useState(today)

  useEffect(() => { void loadTrips() }, [contract.id]) // eslint-disable-line

  async function loadTrips() {
    setLoadingTrips(true)
    const { data } = await supabase
      .from("recurring_trips")
      .select("*")
      .eq("contract_id", contract.id)
      .order("trip_date", { ascending: false })
      .limit(30)
    setTrips((data as RecurringTrip[]) ?? [])
    setLoadingTrips(false)
  }

  async function updateContractStatus(newStatus: "active" | "paused" | "ended") {
    setUpdatingStatus(true)
    const { data, error } = await supabase
      .from("recurring_contracts")
      .update({ status: newStatus })
      .eq("id", contract.id)
      .select()
      .single()
    setUpdatingStatus(false)
    setShowMenu(false)
    if (!error && data) onContractUpdated(data as RecurringContract)
  }

  async function updateTripStatus(tripId: string, newStatus: RecurringTrip["status"], cancelledBy?: string) {
    const patch: Record<string, string> = { status: newStatus }
    if (cancelledBy) patch.cancelled_by = cancelledBy
    const { data, error } = await supabase
      .from("recurring_trips")
      .update(patch)
      .eq("id", tripId)
      .select()
      .single()
    if (!error && data) {
      setTrips(prev => prev.map(t => t.id === tripId ? (data as RecurringTrip) : t))
    }
    setOpenTripMenu(null)
    setCancelTripId(null)
  }

  async function handleConfirmPause() {
    setUpdatingStatus(true)
    try {
      const { data, error } = await supabase
        .from("recurring_contracts")
        .update({ status: "paused" })
        .eq("id", contract.id)
        .select()
        .single()
      if (!error && data) {
        setShowPauseModal(false)
        onContractUpdated(data as RecurringContract)
      }
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function handleConfirmEnd() {
    if (endDateValue < today) {
      setEndModalError("La date d'arrêt ne peut pas être dans le passé")
      return
    }
    if (contract.end_date && !contract.no_end_date && endDateValue > contract.end_date) {
      setEndModalError(`La date d'arrêt doit être avant le ${formatDate(contract.end_date)}`)
      return
    }
    setEndModalError("")
    setIsEnding(true)
    try {
      const { data, error } = await supabase
        .from("recurring_contracts")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
          ended_reason: "Résiliation manuelle",
          end_date: endDateValue || null,
        } as Record<string, unknown>)
        .eq("id", contract.id)
        .select()
        .single()
      if (error) throw error

      const { error: cancelError } = await supabase
        .from("recurring_trips")
        .update({
          status: "cancelled",
          cancelled_by: "operator",
        } as Record<string, unknown>)
        .eq("contract_id", contract.id)
        .eq("status", "upcoming")
        .gt("trip_date", endDateValue)
      if (cancelError) throw cancelError

      if (generateFinalInvoice) {
        toast("Facture finale en cours de préparation...", {
          description: "La génération sera disponible à l'Étape 6.",
        })
      }

      toast.success("Contrat résilié avec succès")
      setShowEndModal(false)
      if (data) onContractUpdated(data as RecurringContract)
    } catch {
      toast.error("Erreur lors de la résiliation")
    } finally {
      setIsEnding(false)
    }
  }

  function handleGenerateContractPDF() {
    if (!enterprise) { toast.error("Profil entreprise manquant"); return }
    const ep = enterprise
    const selClient = clients?.find(c => c.id === contract.client_id)
    const cName = selClient
      ? selClient.type === "particulier"
        ? `${selClient.prenom ?? ""} ${selClient.nom ?? ""}`.trim()
        : (selClient.raisonSociale ?? "")
      : (contract.passenger_name ?? "Client inconnu")
    const selDrv = drivers?.find(d => d.id === contract.driver_id)
    const selVeh = vehicles?.find(v => v.id === contract.vehicle_id)
    const vehLabel = selVeh
      ? `${selVeh.marque ? `${selVeh.marque} ` : ""}${selVeh.modele} — ${selVeh.immatriculation}`.trim()
      : undefined
    generateRecurringContractPDF({
      numero: contract.numero ?? "CR-???",
      createdAt: contract.created_at,
      enterpriseName: ep.denomination || ep.name,
      enterpriseSiren: ep.siren,
      enterpriseEvtc: ep.evtcNumber,
      enterpriseAddress: [ep.adresse, [ep.zipCode, ep.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      enterpriseLogo: ep.logo,
      enterprisePhone: ep.phone,
      clientName: cName,
      passengerName: contract.passenger_name ?? undefined,
      passengerPhone: contract.passenger_phone ?? undefined,
      departure: contract.departure,
      arrival: contract.arrival,
      distanceKm: contract.distance_km ?? undefined,
      recurrenceType: contract.recurrence_type,
      outboundDays: contract.outbound_days,
      outboundTime: contract.outbound_time,
      returnEnabled: contract.return_enabled,
      returnDays: contract.return_days ?? undefined,
      returnTime: contract.return_time,
      daySchedules: contract.stops ?? undefined,
      driverName: selDrv?.name,
      vehicleName: vehLabel,
      startDate: contract.start_date,
      endDate: contract.end_date,
      noEndDate: contract.no_end_date,
      excludeHolidays: contract.exclude_holidays,
      countryCode: contract.country_code,
      pricePerTrip: contract.price_per_trip ?? 0,
      billingFrequency: contract.billing_frequency,
      cgvText: generateCGVSummary(ep),
    })
  }

  // Stats
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const thisMonth = trips.filter(t => t.trip_date.startsWith(monthPrefix))
  const completedMonth = thisMonth.filter(t => t.status === "completed").length
  const cancelledMonth = thisMonth.filter(t => t.status === "cancelled").length
  const billableMonth = completedMonth * (contract.price_per_trip ?? 0)
  const completedTotal = trips.filter(t => t.status === "completed").length
  const billableTotal = completedTotal * (contract.price_per_trip ?? 0)

  const client = clients?.find(c => c.id === contract.client_id)
  const clientName = client
    ? client.type === "particulier"
      ? `${client.prenom ?? ""} ${client.nom ?? ""}`.trim()
      : (client.raisonSociale ?? "")
    : (contract.passenger_name ?? "—")

  const selDriver = drivers?.find(d => d.id === contract.driver_id)
  const driverName = selDriver?.name ?? null

  const selVehicle = vehicles?.find(v => v.id === contract.vehicle_id)
  const vehicleName = selVehicle
    ? `${selVehicle.marque ? `${selVehicle.marque} ` : ""}${selVehicle.modele} — ${selVehicle.immatriculation}`.trim()
    : null

  const sCfg = statusConfig[contract.status as keyof typeof statusConfig] ?? statusConfig.ended

  return (
    <div className="flex flex-col min-h-full bg-background">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d] sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          {contract.numero && (
            <p className="text-[9px] font-mono text-gold/60 uppercase tracking-wider">{contract.numero}</p>
          )}
          <h1 className="text-base font-bold text-foreground truncate leading-tight">{contract.label || "Contrat sans nom"}</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", sCfg.className)}>{sCfg.label}</span>
          <div className="relative">
            <button onClick={() => setShowMenu(v => !v)} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-[#1a1a1a] border border-onyx-border/30 rounded-xl overflow-hidden shadow-xl z-20">
                  {contract.status === "active" && (
                    <button
                      onClick={() => { setShowMenu(false); setShowPauseModal(true) }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-white/5 text-left">
                      <Pause className="h-4 w-4 text-orange-400" />
                      Mettre en pause
                    </button>
                  )}
                  {contract.status === "paused" && (
                    <button onClick={() => void updateContractStatus("active")} disabled={updatingStatus}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-white/5 text-left disabled:opacity-50">
                      <Play className="h-4 w-4 text-green-400" />
                      Reprendre
                    </button>
                  )}
                  {contract.status !== "ended" && contract.status !== "cancelled" && (
                    <button
                      onClick={() => { setShowMenu(false); setEndDateValue(today); setGenerateFinalInvoice(false); setEndModalError(""); setShowEndModal(true) }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/5 text-left border-t border-onyx-border/20">
                      <X className="h-4 w-4" />
                      Résilier le contrat
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">

        {/* Informations */}
        <Section title="Informations" icon={FileText}>
          <RecapRow label="Client" value={clientName} />
          {contract.passenger_name && contract.passenger_name !== clientName && (
            <RecapRow label="Passager" value={contract.passenger_name} />
          )}
          {contract.passenger_phone && <RecapRow label="Tél." value={contract.passenger_phone} />}
          {contract.notes && <RecapRow label="Notes" value={contract.notes} />}
          <RecapRow label="Départ" value={contract.departure} />
          <RecapRow label="Arrivée" value={contract.arrival} />
          {contract.distance_km != null && <RecapRow label="Distance" value={`${contract.distance_km} km`} />}
          {driverName && <RecapRow label="Chauffeur" value={driverName} />}
          {vehicleName && <RecapRow label="Véhicule" value={vehicleName} />}
          {contract.price_per_trip != null && (
            <RecapRow label="Prix / trajet" value={`${contract.price_per_trip.toFixed(2)} €`} />
          )}
          {contract.billing_frequency && (
            <RecapRow
              label="Fréquence"
              value={
                contract.billing_frequency === "monthly"
                  ? "Automatique (1er du mois)"
                  : contract.billing_frequency === "weekly"
                    ? "Automatique (chaque lundi)"
                    : "Manuelle uniquement"
              }
            />
          )}
          <RecapRow label="Mode récurrence" value={RECURRENCE_LABELS[contract.recurrence_type as RecurrenceType] ?? contract.recurrence_type} />
          {(contract.recurrence_type === "fixed" || contract.recurrence_type === "daily") && (
            <>
              <RecapRow label="Jours" value={formatDays(contract.outbound_days)} />
              <RecapRow label="Heure aller" value={formatTime(contract.outbound_time)} />
              <RecapRow label="Retour" value={contract.return_enabled ? `Activé — ${formatTime(contract.return_time)}` : "Non activé"} />
            </>
          )}
          {contract.recurrence_type === "variable" && (
            contract.stops?.filter(s => s.enabled).map(s => (
              <RecapRow key={s.day} label={DAY_NAMES[s.day - 1] ?? "?"} value={s.returnEnabled ? `Aller ${s.outboundTime} · Retour ${s.returnTime}` : `Aller ${s.outboundTime}`} />
            )) ?? <RecapRow label="Jours" value={formatDays(contract.outbound_days)} />
          )}
          {contract.recurrence_type === "custom" && (
            <>
              <RecapRow label="Jours aller" value={formatDays(contract.outbound_days)} />
              <RecapRow label="Heure aller" value={formatTime(contract.outbound_time)} />
              {contract.return_enabled && (
                <>
                  <RecapRow label="Jours retour" value={formatDays(contract.return_days)} />
                  <RecapRow label="Heure retour" value={formatTime(contract.return_time)} />
                  {contract.return_departure && <RecapRow label="Départ retour" value={contract.return_departure} />}
                  {contract.return_arrival && <RecapRow label="Arrivée retour" value={contract.return_arrival} />}
                </>
              )}
            </>
          )}
          <RecapRow label="Début" value={formatDate(contract.start_date)} />
          <RecapRow label="Fin" value={contract.no_end_date ? "Contrat ouvert" : contract.end_date ? formatDate(contract.end_date) : "—"} />
          {contract.country_code && (
            <RecapRow label="Pays" value={COUNTRY_LABELS[contract.country_code] ?? contract.country_code} />
          )}
          <RecapRow label="Jours fériés" value={contract.exclude_holidays ? `Exclus${contract.country_code ? ` (${COUNTRY_LABELS[contract.country_code]??contract.country_code})` : ''}` : 'Non exclus'} />
          {contract.excluded_dates && contract.excluded_dates.length > 0 && (
            <RecapRow label="Dates exclues" value={
              <span className="text-right leading-relaxed">{contract.excluded_dates.map(d => formatDate(d)).join(", ")}</span>
            } />
          )}
        </Section>

        {/* Statistiques */}
        <Section title="Ce mois-ci" icon={Euro}>
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: "Réalisés",     value: String(completedMonth), sub: "trajets" },
              { label: "Annulés",      value: String(cancelledMonth), sub: "trajets" },
              { label: "Facturable",   value: `${billableMonth.toFixed(2)} €`, sub: "ce mois" },
              { label: "Total cumulé", value: `${billableTotal.toFixed(2)} €`, sub: `${completedTotal} trajet${completedTotal !== 1 ? "s" : ""}` },
            ]).map(stat => (
              <div key={stat.label} className="p-3 rounded-xl bg-[#242424] border border-onyx-border/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{stat.label}</p>
                <p className="text-lg font-bold text-foreground mt-0.5">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Actions PDF */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowGenerateInvoice(true)}
            className="py-3 rounded-xl border border-gold/40 text-gold text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gold/10 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Générer une facture
          </button>
          <button
            onClick={handleGenerateContractPDF}
            className="py-3 rounded-xl border border-onyx-border/40 text-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Contrat PDF
          </button>
        </div>

        {/* Trajets */}
        <Section title="Trajets" icon={Navigation}>
          {loadingTrips ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 text-gold animate-spin" />
            </div>
          ) : trips.length === 0 ? (
            <div className="py-4 text-center space-y-1.5">
              <p className="text-sm text-muted-foreground">Aucun trajet généré pour le moment.</p>
              <p className="text-[10px] text-muted-foreground/60">Les trajets sont générés automatiquement chaque jour à 6h00.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {trips.map(trip => {
                const tCfg = tripStatusConfig[trip.status] ?? tripStatusConfig.upcoming
                const canAct = trip.status === "upcoming" || trip.status === "confirmed"
                return (
                  <div key={trip.id} className="flex items-center gap-3 py-2.5 border-b border-onyx-border/20 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground font-medium">{formatDate(trip.trip_date)}</p>
                        {trip.trip_time && (
                          <span className="text-[11px] text-gold font-semibold">{trip.trip_time}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {trip.direction === "outbound" ? "Aller" : "Retour"}
                        </span>
                        {trip.status === "cancelled" && trip.cancelled_by && (
                          <span className="text-[10px] text-muted-foreground/50">· {trip.cancelled_by}</span>
                        )}
                      </div>
                    </div>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", tCfg.cls)}>
                      {tCfg.label}
                    </span>
                    {canAct && (
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setOpenTripMenu(openTripMenu === trip.id ? null : trip.id)}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {openTripMenu === trip.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenTripMenu(null)} />
                            <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a1a1a] border border-onyx-border/30 rounded-xl overflow-hidden shadow-xl z-20">
                              <button onClick={() => void updateTripStatus(trip.id, "completed")}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-green-400 hover:bg-white/5 text-left">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Réalisé
                              </button>
                              <button onClick={() => { setOpenTripMenu(null); setCancelTripId(trip.id) }}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-red-400 hover:bg-white/5 text-left border-t border-onyx-border/20">
                                <X className="h-3.5 w-3.5" />
                                Annulé
                              </button>
                              <button onClick={() => void updateTripStatus(trip.id, "missed")}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-orange-400 hover:bg-white/5 text-left border-t border-onyx-border/20">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Non réalisé
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      </div>

      {/* Modale — Mettre en pause */}
      {showPauseModal && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-end" onClick={() => setShowPauseModal(false)}>
          <div className="w-full bg-[#1a1a1a] rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Pause className="h-5 w-5 text-orange-400" />
              </div>
              <p className="text-base font-bold text-foreground">Mettre en pause</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Les trajets futurs ne seront plus générés tant que le contrat est en pause.
              Les trajets déjà générés restent inchangés.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowPauseModal(false)}
                className="flex-1 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-muted-foreground hover:border-gold/20 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => void handleConfirmPause()}
                disabled={updatingStatus}
                className="flex-1 py-3 rounded-xl bg-orange-500/20 border border-orange-500/40 text-sm font-semibold text-orange-300 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
              >
                {updatingStatus ? "..." : "Mettre en pause"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale — Résilier */}
      {showEndModal && (() => {
        const tripsToCancel = trips.filter(t => t.status === "upcoming" && t.trip_date > endDateValue).length
        const endInfo = endDateValue === today
          ? "Le contrat sera résilié immédiatement"
          : endDateValue > today
            ? `Le contrat continuera jusqu'au ${formatDate(endDateValue)} puis sera résilié`
            : null
        return (
          <div className="fixed inset-0 z-[200] bg-black/70 flex items-end" onClick={() => !isEnding && setShowEndModal(false)}>
            <div className="w-full bg-[#1a1a1a] rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                  <X className="h-5 w-5 text-red-400" />
                </div>
                <p className="text-base font-bold text-foreground">Résilier le contrat</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Date d&apos;arrêt
                </label>
                <input
                  type="date"
                  value={endDateValue}
                  min={today}
                  max={contract.end_date && !contract.no_end_date ? contract.end_date : undefined}
                  onChange={e => { setEndDateValue(e.target.value); setEndModalError("") }}
                  className={cn(
                    "w-full px-3 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground focus:outline-none focus:border-gold/50",
                    endModalError ? "border-red-500" : "border-onyx-border/30"
                  )}
                  style={{ fontSize: "16px" }}
                />
                {endModalError && <p className="text-xs text-red-400">{endModalError}</p>}
                {!endModalError && endInfo && (
                  <p className="text-xs text-muted-foreground">{endInfo}</p>
                )}
              </div>
              {tripsToCancel > 0 ? (
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-sm text-orange-300">
                  ⚠️ {tripsToCancel} trajet{tripsToCancel > 1 ? "s" : ""} planifié{tripsToCancel > 1 ? "s" : ""} seront annulés
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-sm text-green-300">
                  ✅ Aucun trajet planifié à annuler
                </div>
              )}
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={generateFinalInvoice}
                  onCheckedChange={v => setGenerateFinalInvoice(!!v)}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground leading-snug">
                  Générer une facture finale pour les trajets réalisés jusqu&apos;à cette date
                </span>
              </label>
              <p className="text-xs text-red-400/80">
                ⚠️ Cette action est irréversible. Les trajets planifiés après la date d&apos;arrêt seront annulés.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowEndModal(false)}
                  disabled={isEnding}
                  className="flex-1 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-muted-foreground hover:border-gold/20 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void handleConfirmEnd()}
                  disabled={isEnding}
                  className="flex-1 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-sm font-semibold text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isEnding && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmer la résiliation
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modale — Générer une facture */}
      {showGenerateInvoice && (() => {
        const previewTrips = trips.filter(t =>
          t.status === "completed" &&
          t.trip_date >= invoicePeriodStart &&
          t.trip_date <= invoicePeriodEnd
        )
        const previewAmount = previewTrips.length * (contract.price_per_trip ?? 0)
        return (
          <div className="fixed inset-0 z-[200] bg-black/70 flex items-end" onClick={() => setShowGenerateInvoice(false)}>
            <div className="w-full bg-[#1a1a1a] rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-gold" />
                </div>
                <p className="text-base font-bold text-foreground">Générer une facture</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Du</label>
                  <input
                    type="date"
                    value={invoicePeriodStart}
                    max={invoicePeriodEnd}
                    onChange={e => setInvoicePeriodStart(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50"
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Au</label>
                  <input
                    type="date"
                    value={invoicePeriodEnd}
                    min={invoicePeriodStart}
                    max={today}
                    onChange={e => setInvoicePeriodEnd(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
              <div className="px-4 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Aperçu</p>
                <p className="text-sm text-foreground">
                  {previewTrips.length} trajet{previewTrips.length !== 1 ? "s" : ""} réalisé{previewTrips.length !== 1 ? "s" : ""} sur cette période
                </p>
                <p className="text-base font-bold text-gold">{previewAmount.toFixed(2)} €</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowGenerateInvoice(false)}
                  className="flex-1 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-muted-foreground hover:border-gold/20 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    toast("Fonctionnalité de facturation en cours d'implémentation", {
                      description: "Disponible à l'Étape 6.",
                    })
                    setShowGenerateInvoice(false)
                  }}
                  className="flex-1 py-3 rounded-xl bg-gold text-black text-sm font-semibold hover:bg-gold/90 transition-colors active:scale-95"
                >
                  Générer
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal annulation — qui annule ? */}
      {cancelTripId && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-end" onClick={() => setCancelTripId(null)}>
          <div className="w-full bg-[#1a1a1a] rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />
            <p className="text-base font-bold text-foreground text-center">Qui annule ?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => void updateTripStatus(cancelTripId, "cancelled", "Abonné")}
                className="py-3.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm font-semibold text-foreground hover:border-red-500/40 active:scale-[0.98] transition-all">
                Abonné
              </button>
              <button onClick={() => void updateTripStatus(cancelTripId, "cancelled", "Client")}
                className="py-3.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm font-semibold text-foreground hover:border-red-500/40 active:scale-[0.98] transition-all">
                Client
              </button>
            </div>
            <button onClick={() => setCancelTripId(null)} className="w-full py-2.5 text-sm text-muted-foreground">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── RecurringScreen ───────────────────────────────────────────────────────────

interface RecurringScreenProps {
  onBack: () => void
}

export function RecurringScreen({ onBack }: RecurringScreenProps) {
  const supabase = createClient()
  const [contracts, setContracts] = useState<RecurringContract[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateContract, setShowCreateContract] = useState(false)
  const [selectedContract, setSelectedContract] = useState<RecurringContract | null>(null)

  async function loadContracts() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from("recurring_contracts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    setContracts((data as RecurringContract[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadContracts() }, [])

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d]">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Trajets Récurrents</h1>
          <p className="text-[10px] text-muted-foreground">Courses régulières planifiées</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-gold animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center mb-4">
              <RefreshCw className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Aucun trajet récurrent pour le moment.
            </p>
            <p className="text-[11px] text-muted-foreground mb-5">
              Créez votre premier contrat pour automatiser vos courses régulières.
            </p>
            <button
              onClick={() => setShowCreateContract(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold text-black text-sm font-semibold hover:bg-gold/90 transition-colors"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Créer un contrat
            </button>
          </div>
        ) : (
          contracts.map(contract => {
            const cfg = statusConfig[contract.status] ?? statusConfig.ended
            return (
              <div key={contract.id} onClick={() => setSelectedContract(contract)} className="p-4 rounded-2xl bg-[#1a1a1a] border border-onyx-border/30 space-y-2 cursor-pointer hover:border-gold/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <RefreshCw className="h-4 w-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{contract.label || "Trajet sans nom"}</p>
                        {contract.numero && (
                          <span className="text-[9px] font-mono text-gold/70 bg-gold/10 px-1.5 py-0.5 rounded flex-shrink-0">{contract.numero}</span>
                        )}
                      </div>
                      {contract.passenger_name && (
                        <p className="text-[11px] text-muted-foreground truncate">{contract.passenger_name}</p>
                      )}
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", cfg.className)}>
                    {cfg.label}
                  </span>
                </div>
                <div className="pl-[52px] space-y-1">
                  <p className="text-[11px] text-muted-foreground truncate">{contract.departure} → {contract.arrival}</p>
                  <p className="text-[11px] text-gold font-medium">{formatRecurrence(contract.outbound_days, contract.outbound_time ?? "")}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Bouton flottant "+" */}
      <button
        onClick={() => setShowCreateContract(true)}
        className="fixed right-5 bottom-28 z-30 w-12 h-12 rounded-full bg-gold flex items-center justify-center gold-glow active:scale-95 transition-all"
      >
        <Plus className="h-5 w-5 text-black" strokeWidth={2} />
      </button>

      {showCreateContract && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background overflow-y-auto">
          <CreateRecurringContract
            onBack={() => setShowCreateContract(false)}
            onSuccess={() => {
              setShowCreateContract(false)
              void loadContracts()
            }}
          />
        </div>,
        document.body
      )}

      {selectedContract && createPortal(
        <div className="fixed inset-0 z-[9999] bg-background overflow-y-auto">
          <ContractDetailScreen
            contract={selectedContract}
            onBack={() => setSelectedContract(null)}
            onContractUpdated={updated => {
              setSelectedContract(updated)
              setContracts(prev => prev.map(c => c.id === updated.id ? updated : c))
            }}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

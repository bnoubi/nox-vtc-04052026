"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"

import { createClient } from "@/lib/supabase/client"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, ChevronLeft, ChevronRight, ChevronDown, FileText, Link2, MessageSquare, Mail, Phone, Copy, Check,
  MapPin, Navigation, Car, Euro, Building2, User, Users, Search, Sparkles, Clock, Calendar,
  RotateCcw, Loader2, Plus, RefreshCw, Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { useNox } from "./nox-context"
import { useNav } from "./nav-context"
import {
  type Client, type Driver, type Vehicle, type TarifForfait, type TarifSupplement,
  type BCDocument, type EnterpriseProfile, type BCStatus,
} from "./data"
import { toast } from "sonner"
import { DateTimePickerSheet } from "./date-time-picker-sheet"
import { QuickAddClientModal } from "./quick-add-client-modal"
import { LimitAlertModal } from "./limit-alert-modal"
import { SubscriptionDrawer } from "./subscription-drawer"
import { TokenCostModal } from "./token-cost-modal"
import { PhoneInput } from "@/components/ui/phone-input"

// ============================================================================
// TYPES & HELPERS
// ============================================================================
type FlowStep = "menu" | "link" | "form"
type FormTab = "formulaire" | "apercu"
type PricingMode = "forfait" | "calcul"
type DiscountType = "percent" | "amount"

export interface BCPrefillClient {
  civilite: string
  nom: string
  prenom: string
  tel: string
}

interface SupplementSelection { id: string; label: string; price: number; selected: boolean }
interface FormErrors { client?: string; departure?: string; arrival?: string; date?: string; time?: string; driver?: string; vehicle?: string; cgv?: string }

function defaultTime(): string {
  const now = new Date()
  const totalMin = now.getHours() * 60 + now.getMinutes()
  const rounded = Math.ceil(totalMin / 5) * 5
  const h = Math.floor(rounded / 60) % 24
  const m = rounded % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function detectTarif(time: string, date: string): { id: string; name: string; coef: number } {
  if (date) {
    const dayOfWeek = new Date(date).getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) return { id: "c", name: "Week-end", coef: 1.5 }
  }
  if (!time) return { id: "a", name: "Journée", coef: 1.0 }
  const [h] = time.split(":").map(Number)
  if (h >= 21 || h < 7) return { id: "b", name: "Nuit", coef: 1.25 }
  return { id: "a", name: "Journée", coef: 1.0 }
}

function formatPrice(v: number): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return ""
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}


const formatDateFR = (dateStr: string): string => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

function formatTimeFrFromString(time: string): string {
  return time?.replace(":", "h") ?? ""
}

function computeDepartureTime(date: string, arrivalTime: string, durationSec: number): string | null {
  try {
    const arrMs = new Date(`${date}T${arrivalTime}:00`).getTime()
    if (isNaN(arrMs)) return null
    const depMs = arrMs - durationSec * 1000
    const d = new Date(depMs)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  } catch { return null }
}

function computeArrivalTime(date: string, departureTime: string, durationSec: number): string | null {
  try {
    const depMs = new Date(`${date}T${departureTime}:00`).getTime()
    if (isNaN(depMs)) return null
    const arrMs = depMs + durationSec * 1000
    const d = new Date(arrMs)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  } catch { return null }
}

function formatCombinedDateTime(date: string, time: string): string {
  try {
    let label = ""
    if (date) {
      const d = new Date(date + "T12:00:00")
      const w = d.toLocaleDateString("fr-FR", { weekday: "short" })
      const weekday = w.charAt(0).toUpperCase() + w.slice(1)
      const month = d.toLocaleDateString("fr-FR", { month: "long" })
      label = `${weekday} ${d.getDate()} ${month}`
    }
    if (time) label = label ? `${label} · ${time.replace(":", "h")}` : time.replace(":", "h")
    return label || "Non défini"
  } catch { return "Non défini" }
}

function generateCGVSummary(enterprise: EnterpriseProfile): string {
  if (!enterprise.cgvMode || enterprise.cgvMode === "configurator") {
    const config = enterprise.cgvConfig
    if (!config) return "Aucune condition générale de vente n'a été configurée."
    return `Conditions Générales de Vente :\n- Annulation : sans frais jusqu'à ${config.cancellationDelay} avant le départ. Passé ce délai, des frais de ${config.cancellationFee}% seront appliqués.\n- Attente : temps d'attente inclus de ${config.waitTime} minutes. Au-delà, facturation de ${config.waitFee}€/min.\n- No-Show (non-présentation) : pénalité de ${config.noShowFee}% appliquée.\n- Paiement : exigé au format ${config.paymentDelay} via ${config.paymentMethods.join(", ")}.`
  } else if (enterprise.cgvMode === "freetext") {
    return enterprise.cgvText || "Aucune condition générale de vente n'a été configurée."
  } else {
    return "Les conditions générales relatives à cette prestation vous ont été remises en annexe ou sont consultables sur demande."
  }
}

function hasCGVConfigured(enterprise: EnterpriseProfile): boolean {
  if (enterprise.cgvMode === "freetext") return !!(enterprise.cgvText?.trim())
  if (enterprise.cgvMode === "import") return true
  return !!(enterprise.cgvConfig)
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================
function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-onyx-border/30 rounded-xl bg-[#1a1a1a] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gold" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-2 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
interface CreateBCFlowProps {
  open: boolean
  onClose: () => void
  prefillClient?: BCPrefillClient | null
  prefillBC?: BCDocument | null
  onNavigateToRecurring?: () => void
  onNavigateToTripRequests?: () => void
  initialStep?: "link"
}

export function CreateBCFlow({ open, onClose, prefillClient, prefillBC, onNavigateToRecurring, onNavigateToTripRequests, initialStep }: CreateBCFlowProps) {
  const { drivers, clients, vehicles, tariffSettings, enterprise, addBC, bcs, saveDraftBC, updateBC, deleteBC, legalProfile, validateDocumentCompliance, updateEnterprise, plan, tokens, userId, refreshTokens } = useNox()
  const supabase = createClient()
  const { navigateToCGV, navigateToSubscription } = useNav()
  const [step, setStep] = useState<FlowStep>(() => initialStep === "link" ? "link" : prefillBC ? "form" : "menu")
  const [tab, setTab] = useState<FormTab>("formulaire")

  useEffect(() => {
    if (open && initialStep === "link") {
      setStep("link")
    } else if (open && prefillBC) {
      setStep("form")
      if (prefillBC?.trajet?.date && prefillBC?.trajet?.time) {
        const prefilledDT = new Date(`${prefillBC.trajet.date}T${prefillBC.trajet.time}:00`)
        if (prefilledDT < new Date()) {
          setTripDate("")
          setTripTime(defaultTime())
          toast.warning("La date du trajet importée est dépassée. Veuillez choisir une nouvelle date et heure.")
        } else {
          setTripDate(prefillBC.trajet.date)
          setTripTime(prefillBC.trajet.time)
        }
      }
    }
    if (!open) {
      setStep(initialStep === "link" ? "link" : prefillBC ? "form" : "menu")
    }
  }, [open, prefillBC, initialStep]) // eslint-disable-line

  // BUG 1 — état de soumission pour éviter les doublons
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Link sharing
  const [linkRecipient, setLinkRecipient] = useState("")
  const [linkCopied, setLinkCopied] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showLinkLimitAlert, setShowLinkLimitAlert] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [tripRequestId, setTripRequestId] = useState<string | null>(null)
  const [tripToken, setTripToken] = useState("")

  // BUG 2 — brNumber et creationDate en state pour permettre le reset
  const [brNumber, setBRNumber] = useState("")
  const [creationDate, setCreationDate] = useState(() => new Date())
  const [showBCTokenModal, setShowBCTokenModal] = useState(false)

  // Selections — pré-remplissage depuis prefillBC si fourni (FEATURE 2 duplication)
  const [selectedDriverId, setSelectedDriverId] = useState<string>(() => {
    if (prefillBC?.driverName) {
      return drivers?.find(d => d.name === prefillBC.driverName)?.id ?? ""
    }
    return ""
  })
  const [selectedClientId, setSelectedClientId] = useState<string>(prefillBC?.clientId ?? "")
  const [clientSearch, setClientSearch] = useState("")
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => {
    if (prefillBC?.vehicleId) return prefillBC.vehicleId
    return ""
  })

  // Passager
  const [passagerNom, setPassagerNom] = useState(prefillBC?.passagerNom ?? "")
  const [passagerTelephone, setPassagerTelephone] = useState(prefillBC?.passagerTelephone ?? "")
  const [passengerSearch, setPassengerSearch] = useState("")

  // LOT 3B — sélection client enrichie
  const [clientFocused, setClientFocused] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [modalSearch, setModalSearch] = useState("")
  const [modalSelectedCompany, setModalSelectedCompany] = useState<Client | null>(null)
  const [inlineSelectedCompany, setInlineSelectedCompany] = useState<Client | null>(null)
  const [showQuickAddClient, setShowQuickAddClient] = useState(false)

  // Client manuel (prefillClient ou pré-rempli depuis BC)
  const [manualClient, setManualClient] = useState<BCPrefillClient | null>(prefillClient || null)

  // Trajet
  const [departure, setDeparture] = useState(prefillBC?.trajet?.depart ?? "")
  const [arrival, setArrival] = useState(prefillBC?.trajet?.arrivee ?? "")
  const [stops, setStops] = useState<string[]>([])
  const [stopsOptimized, setStopsOptimized] = useState(false)
  const [showStopsLimitAlert, setShowStopsLimitAlert] = useState(false)
  const [showSubDrawer, setShowSubDrawer] = useState(false)
  const [subDrawerPlan, setSubDrawerPlan] = useState<"DUO" | "TEAM">("DUO")
  const [tripDate, setTripDate] = useState(prefillBC?.trajet?.date ?? "")
  const [tripTime, setTripTime] = useState(() => prefillBC?.trajet?.time ?? defaultTime())
  const [passengers, setPassengers] = useState(prefillBC?.trajet?.passengers ?? 1)
  const [luggage, setLuggage] = useState(prefillBC?.trajet?.luggage ?? 0)
  const [instructions, setInstructions] = useState(prefillBC?.notes ?? "")

  // BUG 5 — calcul automatique distance
  const [durationDisplay, setDurationDisplay] = useState("")
  const [durationSec, setDurationSec] = useState(0)
  const [isAutoCalculating, setIsAutoCalculating] = useState(false)

  // Lot 4 — mode horaire et sélecteur date/heure combiné
  const [modeHoraire, setModeHoraire] = useState<'depart' | 'arrivee'>('depart')
  const [heureArriveesouhaitee, setHeureArriveesouhaitee] = useState("")
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)

  // Refs pour accéder aux dernières valeurs dans les effets sans les ajouter aux deps
  const modeHoraireRef = useRef(modeHoraire)
  const heureArriveesouhaiteeRef = useRef(heureArriveesouhaitee)

  // FEATURE 3 — auto-save brouillon
  const [draftId, setDraftId] = useState<string | null>(null)
  const [ignoreDraft, setIgnoreDraft] = useState(false)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const formDataRef = useRef({ selectedClientId, departure, arrival, tripDate, tripTime, passengers, luggage, instructions })

  // Pricing
  const [pricingMode, setPricingMode] = useState<PricingMode>("calcul")
  const [baseTvaRate, setBaseTvaRate] = useState<number>(10)
  const [selectedForfaitId, setSelectedForfaitId] = useState<string>("")
  const [distanceKm, setDistanceKm] = useState<number | null>(prefillBC?.trajet?.distance ?? null)
  const [editableBasePrice, setEditableBasePrice] = useState<number | null>(null)

  const availableSupplements = useMemo(() =>
    (tariffSettings.supplements ?? []).filter(s => s.enabled).map(s => ({ ...s, selected: false })),
  [tariffSettings.supplements])
  const [supplements, setSupplements] = useState<SupplementSelection[]>(availableSupplements)
  const [supplementsOpen, setSupplementsOpen] = useState(false)

  const [discountType, setDiscountType] = useState<DiscountType>("percent")
  const [discountValue, setDiscountValue] = useState(0)
  const [isMicroBC, setIsMicroBC] = useState<boolean>(enterprise?.vatMode === 'franchise')

  // Sync isMicroBC when enterprise profile loads from Supabase
  useEffect(() => {
    setIsMicroBC(enterprise?.vatMode === 'franchise')
  }, [enterprise?.vatMode])

  // Validation inline
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const clientRef = useRef<HTMLDivElement>(null)
  const departureRef = useRef<HTMLDivElement>(null)
  const arrivalRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef<HTMLDivElement>(null)
  const driverRef = useRef<HTMLDivElement>(null)
  const vehicleRef = useRef<HTMLDivElement>(null)
  const cgvRef = useRef<HTMLDivElement>(null)

  // CGV — valeurs mémoïsées pour éviter les doubles calculs en render
  const cgvConfigured = useMemo(() => hasCGVConfigured(enterprise), [enterprise.cgvMode, enterprise.cgvConfig, enterprise.cgvText])
  const cgvSummary = useMemo(() => generateCGVSummary(enterprise), [enterprise.cgvMode, enterprise.cgvConfig, enterprise.cgvText])
  const cgvPreview = useMemo(() => cgvSummary.length > 300 ? cgvSummary.slice(0, 300) + "…" : cgvSummary, [cgvSummary])

  const [cgvInclure, setCgvInclure] = useState(false)
  const [showCGVModal, setShowCGVModal] = useState(false)

  // Sync cgvInclure une fois enterprise chargé depuis Supabase
  useEffect(() => {
    setCgvInclure(hasCGVConfigured(enterprise))
  }, [enterprise.cgvMode, enterprise.cgvConfig, enterprise.cgvText])

  // Auto-clear des erreurs de validation dès que le champ est rempli
  useEffect(() => {
    if (selectedClientId || manualClient)
      setFormErrors(prev => { const e = { ...prev }; delete e.client; return e })
  }, [selectedClientId, manualClient])
  useEffect(() => {
    if (departure.trim()) setFormErrors(prev => { const e = { ...prev }; delete e.departure; return e })
  }, [departure])
  useEffect(() => {
    if (arrival.trim()) setFormErrors(prev => { const e = { ...prev }; delete e.arrival; return e })
  }, [arrival])
  useEffect(() => {
    if (tripDate.trim()) setFormErrors(prev => { const e = { ...prev }; delete e.date; return e })
    if (tripTime.trim()) setFormErrors(prev => { const e = { ...prev }; delete e.time; return e })
  }, [tripDate, tripTime])
  useEffect(() => {
    if (selectedVehicleId) setFormErrors(prev => { const e = { ...prev }; delete e.vehicle; return e })
  }, [selectedVehicleId])
  useEffect(() => {
    if (enterprise.cgvMode) setFormErrors(prev => { const e = { ...prev }; delete e.cgv; return e })
  }, [enterprise.cgvMode])

  // Computed
  const selectedDriver = drivers?.find(d => d.id === selectedDriverId) ?? null
  const selectedClient = clients?.find(c => c.id === selectedClientId) ?? null
  const selectedVehicle = vehicles?.find(v => v.id === selectedVehicleId) ?? null
  const selectedForfait = tariffSettings.forfaits?.find(f => f.id === selectedForfaitId) ?? null
  const tarif = useMemo(() => detectTarif(tripTime, tripDate), [tripTime, tripDate])

  const filteredPassengers = useMemo(() => {
    if (!selectedClient?.contacts) return []
    if (!passengerSearch.trim()) return selectedClient.contacts
    const s = passengerSearch.toLowerCase()
    return selectedClient.contacts.filter(c =>
      `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().includes(s) ||
      (c.phone ?? "").includes(s)
    )
  }, [selectedClient, passengerSearch])

  const filteredClients = useMemo(() => {
    const list = clients ?? []
    const s = clientSearch.trim().toLowerCase()
    const filtered = s
      ? list.filter(c => {
          const fullName = `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().trim()
          const company = (c.raisonSociale ?? "").toLowerCase()
          return fullName.includes(s) || company.includes(s) ||
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
    const s = modalSearch.trim().toLowerCase()
    const filtered = s
      ? list.filter(c => {
          const fullName = `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().trim()
          const company = (c.raisonSociale ?? "").toLowerCase()
          return fullName.includes(s) || company.includes(s) ||
            (c.phone ?? "").includes(s) || (c.email ?? "").toLowerCase().includes(s)
        })
      : list
    return [...filtered].sort((a, b) => {
      const na = a.type === "particulier" ? `${a.prenom ?? ""} ${a.nom ?? ""}`.trim() : (a.raisonSociale ?? "")
      const nb = b.type === "particulier" ? `${b.prenom ?? ""} ${b.nom ?? ""}`.trim() : (b.raisonSociale ?? "")
      return na.localeCompare(nb, "fr")
    })
  }, [modalSearch, clients])

  // Pricing calculation
  const pricing = useMemo(() => {
    const { base } = tariffSettings
    const priseEnCharge = base.priseEnCharge
    const prixKm = base.prixKm
    const courseMin = base.courseMinimum

    let baseHT = 0
    let calculDetail = ""

    if (pricingMode === "forfait" && selectedForfait) {
      baseHT = editableBasePrice ?? selectedForfait.price
      calculDetail = `Forfait ${selectedForfait.name}`
    } else {
      const km = distanceKm ?? 0
      const trajetHT = km * prixKm
      const rawBase = priseEnCharge + (trajetHT * tarif.coef)
      baseHT = editableBasePrice ?? Math.max(rawBase, courseMin)
      calculDetail = `Prise en charge (${formatPrice(priseEnCharge)}) + Trajet (${km} km × ${formatPrice(prixKm)}) × Coeff ${tarif.name} (${tarif.coef})`
    }

    const supplementsTotal = supplements.filter(s => s.selected).reduce((sum, s) => sum + s.price, 0)
    const subtotalHT = baseHT + supplementsTotal

    let discountAmount = 0
    if (discountValue > 0) {
      discountAmount = discountType === "percent" ? subtotalHT * (discountValue / 100) : discountValue
    }
    const discountRatio = subtotalHT > 0 ? (discountAmount / subtotalHT) : 0

    const discountedBaseHT = baseHT * (1 - discountRatio)
    const discountedSupplementsHT = supplementsTotal * (1 - discountRatio)

    const tva10Amount = (baseTvaRate === 10 ? discountedBaseHT : 0)
    const tva20Amount = discountedSupplementsHT + (baseTvaRate === 20 ? discountedBaseHT : 0)

    const totalHT = discountedBaseHT + discountedSupplementsHT
    const tva10 = tva10Amount * 0.10
    const tva20 = tva20Amount * 0.20
    const tva = tva10 + tva20
    const totalTTC = totalHT + tva
    const originalTTC = (baseHT * (1 + baseTvaRate / 100)) + (supplementsTotal * 1.20)

    let fullDetail = calculDetail
    if (supplementsTotal > 0) fullDetail += ` + Suppléments (${formatPrice(supplementsTotal)})`
    if (discountAmount > 0) fullDetail += ` - Remise (${formatPrice(discountAmount)})`

    return { baseHT, supplementsTotal, subtotalHT, discountAmount, discountedBaseHT, discountedSupplementsHT, totalHT, tva10, tva20, tva, totalTTC, originalHT: subtotalHT, originalTTC, fullDetail }
  }, [pricingMode, selectedForfait, distanceKm, tarif, supplements, discountType, discountValue, editableBasePrice, baseTvaRate, tariffSettings])

  // ── Calcul automatique distance + durée avec trafic via Routes API ──────
  // departureTime = tripTime (toujours l'heure de départ, calculée ou saisie)
  useEffect(() => {
    if (!departure || !arrival || departure.length < 5 || arrival.length < 5) return
    if (!tripDate || !tripTime) return

    let cancelled = false
    setIsAutoCalculating(true)
    setDistanceKm(null)
    setDurationDisplay("")

    ;(async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) throw new Error("Clé API Google manquante")

        const departureTime = new Date(`${tripDate}T${tripTime}:00`).toISOString()

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
            intermediates: stops.filter(s => s.trim().length > 0).map(s => ({ address: s })),
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            departureTime,
          }),
        })

        if (!res.ok) throw new Error(`Routes API ${res.status}`)
        const data = await res.json()

        if (!cancelled && data.routes?.[0]) {
          const route = data.routes[0]
          const km = Math.round((route.distanceMeters ?? 0) / 1000)
          const rawSec = parseInt((route.duration ?? "0s").replace("s", ""), 10)
          if (km > 0) {
            setDistanceKm(km)
            setEditableBasePrice(null)
          }
          if (rawSec > 0) {
            setDurationSec(rawSec)
            setDurationDisplay(formatDuration(rawSec))
          }
        }
      } catch {
        // Gestion défensive — distance reste vide, pas de valeur trompeuse
      } finally {
        if (!cancelled) setIsAutoCalculating(false)
      }
    })()

    return () => { cancelled = true }
  }, [departure, arrival, stops, tripDate, tripTime])

  // ── Mode Arrivée : reset heure départ si adresses/mode changent ──────────
  useEffect(() => {
    if (modeHoraire !== 'arrivee') return
    setTripTime("")
    setDurationSec(0)
    setDurationDisplay("")
    setDistanceKm(null)
  }, [modeHoraire, departure, arrival])

  // ── Mode Arrivée : appel initial TRAFFIC_UNAWARE quand tripTime inconnu ──
  useEffect(() => {
    if (modeHoraire !== 'arrivee') return
    if (!departure || !arrival || departure.length < 5 || arrival.length < 5) return
    if (!tripDate || !heureArriveesouhaitee) return
    if (tripTime) return // départ déjà calculé, l'effet principal prend le relais

    let cancelled = false
    setIsAutoCalculating(true)
    setDistanceKm(null)
    setDurationDisplay("")

    ;(async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) throw new Error("Clé API Google manquante")

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
            intermediates: stops.filter(s => s.trim().length > 0).map(s => ({ address: s })),
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
          }),
        })

        if (!res.ok) throw new Error(`Routes API ${res.status}`)
        const data = await res.json()

        if (!cancelled && data.routes?.[0]) {
          const route = data.routes[0]
          const km = Math.round((route.distanceMeters ?? 0) / 1000)
          const rawSec = parseInt((route.duration ?? "0s").replace("s", ""), 10)
          if (km > 0) { setDistanceKm(km); setEditableBasePrice(null) }
          if (rawSec > 0) {
            setDurationSec(rawSec)
            setDurationDisplay(formatDuration(rawSec))
            const computed = computeDepartureTime(tripDate, heureArriveesouhaitee, rawSec)
            if (computed) setTripTime(computed)
          }
        }
      } catch {
        // Gestion défensive — utiliser l'heure d'arrivée comme fallback départ
        if (!cancelled && heureArriveesouhaitee) setTripTime(heureArriveesouhaitee)
      } finally {
        if (!cancelled) setIsAutoCalculating(false)
      }
    })()

    return () => { cancelled = true }
  }, [departure, arrival, stops, tripDate, heureArriveesouhaitee, modeHoraire, tripTime])

  // Mettre à jour les refs à chaque render
  modeHoraireRef.current = modeHoraire
  heureArriveesouhaiteeRef.current = heureArriveesouhaitee

  // ── FEATURE 3 — Auto-save brouillon ─────────────────────────────────────
  // Mettre à jour la ref à chaque render pour éviter les closures périmées
  formDataRef.current = { selectedClientId, departure, arrival, tripDate, tripTime, passengers, luggage, instructions }

  useEffect(() => {
    if (!selectedClientId && !departure) return
    if (isSubmitting) return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      const fd = formDataRef.current
      const clientName = selectedClient
        ? (selectedClient.type === "particulier"
            ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}`.trim()
            : selectedClient.raisonSociale ?? "")
        : ""
      const id = await saveDraftBC({
        client: clientName || undefined,
        clientId: fd.selectedClientId || undefined,
        trajet: {
          depart: fd.departure || "Non renseigné",
          arrivee: fd.arrival || "Non renseigné",
          distance: distanceKm ?? undefined,
          date: fd.tripDate,
          time: fd.tripTime,
          passengers: fd.passengers,
          luggage: fd.luggage,
        },
        notes: fd.instructions || undefined,
      })
      if (id && !draftId) setDraftId(id)
    }, 30_000)

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId, departure, arrival, tripDate, tripTime, passengers, luggage, instructions, isSubmitting])

  // ── BUG 2 — Reset complet du formulaire ─────────────────────────────────
  const resetForm = useCallback(() => {
    setBRNumber("")
    setCreationDate(new Date())
    setTab("formulaire")
    setStep("menu")
    setIsSubmitting(false)
    setLinkRecipient("")
    setLinkCopied(false)
    setShowLinkModal(false)
    setShowLinkLimitAlert(false)
    setTripRequestId(null)
    setTripToken("")
    setSelectedDriverId("")
    setSelectedClientId("")
    setClientSearch("")
    setSelectedVehicleId("")
    setPassagerNom("")
    setPassagerTelephone("")
    setPassengerSearch("")
    setManualClient(null)
    setDeparture("")
    setArrival("")
    setStops([])
    setStopsOptimized(false)
    setTripDate("")
    setTripTime("")
    setPassengers(1)
    setLuggage(0)
    setInstructions("")
    setPricingMode("calcul")
    setBaseTvaRate(10)
    setSelectedForfaitId("")
    setDistanceKm(null)
    setEditableBasePrice(null)
    setSupplements(availableSupplements)
    setDiscountType("percent")
    setDiscountValue(0)
    setDurationDisplay("")
    setDurationSec(0)
    setModeHoraire('depart')
    setHeureArriveesouhaitee("")
    setShowDateTimePicker(false)
    setDraftId(null)
    setCgvInclure(cgvConfigured)
    setClientFocused(false)
    setShowClientModal(false)
    setModalSearch("")
    setModalSelectedCompany(null)
  }, [drivers, vehicles, availableSupplements, cgvConfigured])

  const handleClose = () => {
    if (tab === "apercu") {
      resetForm()
    } else {
      setStep("menu")
    }
    onClose()
  }

  const isPhone = (val: string) => /^[+0-9\s]{6,}$/.test(val)

  const cleanPhone = (tel: string) => {
    let cleaned = tel.replace(/\s/g, "").replace(/^\+/, "")
    if (cleaned.startsWith("0")) cleaned = "33" + cleaned.slice(1)
    return cleaned
  }

  const copyLink = () => {
    if (!tripToken) return
    navigator.clipboard.writeText(`https://app.noxvtc.fr/request/${tripToken}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
    toast.success("Lien copié")
  }

  const handleSendWhatsApp = () => {
    if (linkRecipient && linkRecipient.includes("@")) {
      toast.warning("Vous avez saisi un email. Utilisez le bouton 'Par Email' ou copiez le lien.")
      return
    }
    const url = `https://app.noxvtc.fr/request/${tripToken}`
    const message = encodeURIComponent(`Bonjour, voici le lien pour compléter votre demande de trajet : ${url}`)
    if (linkRecipient && isPhone(linkRecipient)) {
      window.open(`https://wa.me/${cleanPhone(linkRecipient)}?text=${message}`, "_blank")
    } else {
      navigator.clipboard.writeText(`https://wa.me/?text=${message}`)
      toast.success("Lien WhatsApp copié !")
    }
  }

  const handleSendSMS = () => {
    if (linkRecipient && linkRecipient.includes("@")) {
      toast.warning("Vous avez saisi un email. Utilisez le bouton 'Par Email' ou copiez le lien.")
      return
    }
    const url = `https://app.noxvtc.fr/request/${tripToken}`
    const message = encodeURIComponent(`Voici le lien pour votre demande de trajet : ${url}`)
    if (linkRecipient && isPhone(linkRecipient)) {
      window.open(`sms:${cleanPhone(linkRecipient)}?body=${message}`)
    } else {
      navigator.clipboard.writeText(url)
      toast.success("Lien copié !")
    }
  }

  const handleSendEmail = () => {
    const url = `https://app.noxvtc.fr/request/${tripToken}`
    const subject = encodeURIComponent("Demande de trajet — Complétez vos informations")
    const validity = plan === "SOLO" ? "24h" : plan === "DUO" ? "48h" : "72h"
    const body = encodeURIComponent(`Bonjour,\n\nVoici le lien pour compléter votre demande de trajet :\n${url}\n\nCe lien est valable ${validity}.\n\nCordialement`)
    if (linkRecipient && linkRecipient.includes("@")) {
      window.open(`mailto:${linkRecipient}?subject=${subject}&body=${body}`)
    } else {
      window.open(`mailto:?subject=${subject}&body=${body}`)
    }
  }

  // ── BUG 1 — Génération avec protection anti-doublon ──────────────────────
  const handleGenerate = async () => {
    if (isSubmitting) return

    const clientName = (selectedClient
      ? (selectedClient.type === "particulier"
          ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}`.trim()
          : selectedClient.raisonSociale ?? "")
      : (manualClient ? `${manualClient.prenom} ${manualClient.nom}`.trim() : "")) || "Client Inconnu"

    const clientPhone = selectedClient
      ? selectedClient.phone
      : (manualClient ? manualClient.tel : undefined)

    // Validation champs obligatoires
    const newErrors: FormErrors = {}
    if (!selectedClient && !manualClient) newErrors.client = "Le client est obligatoire"
    if (!departure.trim()) newErrors.departure = "L'adresse de départ est obligatoire"
    if (!arrival.trim()) newErrors.arrival = "L'adresse d'arrivée est obligatoire"
    if (!tripDate.trim()) newErrors.date = "La date est obligatoire"
    if (!tripTime.trim()) newErrors.time = "L'heure est obligatoire"
    if (!newErrors.date && !newErrors.time && tripDate && tripTime) {
      const selectedDateTime = new Date(`${tripDate}T${tripTime}:00`)
      if (selectedDateTime < new Date()) {
        newErrors.date = "La date et l'heure doivent être dans le futur"
      }
    }
    if (!selectedDriverId) newErrors.driver = "Le chauffeur est obligatoire"
    if (!selectedVehicleId) newErrors.vehicle = "Le véhicule est obligatoire"
    if (!enterprise.cgvMode) newErrors.cgv = "Les CGV doivent être configurées"
    else if (cgvConfigured && !cgvInclure) newErrors.cgv = "Vous devez cocher 'Inclure les CGV dans le PDF'."
    setFormErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      const anchors: Array<{ ref: React.RefObject<HTMLDivElement | null>; key: keyof FormErrors }> = [
        { ref: clientRef, key: "client" },
        { ref: departureRef, key: "departure" },
        { ref: arrivalRef, key: "arrival" },
        { ref: dateRef, key: "date" },
        { ref: driverRef, key: "driver" },
        { ref: vehicleRef, key: "vehicle" },
        { ref: cgvRef, key: "cgv" },
      ]
      const first = anchors.find(a => newErrors[a.key])
      first?.ref.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }

    setIsSubmitting(true)

    const resolvedPassagerNom = passagerNom.trim() ||
      (selectedClient?.type === "particulier"
        ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}`.trim()
        : undefined)
    const resolvedPassagerTel = passagerTelephone.trim() ||
      (selectedClient?.type === "particulier" ? selectedClient.phone : undefined)

    const vehicleLabel = selectedVehicle
      ? [selectedVehicle.marque, selectedVehicle.modele].filter(Boolean).join(' ')
      : undefined

    const cgvText = generateCGVSummary(enterprise)

    const newBC: BCDocument = {
      id: `bc-${Date.now()}`,
      number: brNumber,
      clientId: selectedClientId || undefined,
      client: clientName,
      clientPhone,
      passagerNom: resolvedPassagerNom || undefined,
      passagerTelephone: resolvedPassagerTel || undefined,
      amount: isMicroBC ? pricing.totalHT : pricing.totalTTC,
      amountHT: pricing.totalHT,
      tva: isMicroBC ? 0 : pricing.tva,
      baseHT: pricing.baseHT,
      supplementsHT: pricing.supplementsTotal,
      tva10Amount: isMicroBC ? 0 : pricing.tva10,
      tva20Amount: isMicroBC ? 0 : pricing.tva20,
      tva55Amount: isMicroBC ? 0 : 0,
      discountValue,
      discountType,
      originalHT: pricing.originalHT,
      originalTTC: pricing.originalTTC,
      supplementsList: supplements
        .filter(s => s.selected)
        .map(s => ({
          label: s.label,
          montant: s.price,
          tva_rate: 20,
        })),
      date: new Date().toLocaleDateString("fr-FR"),
      status: "en_attente",
      type: "bc",
      trajet: {
        depart: departure || "Non renseigné",
        arrivee: arrival || "Non renseigné",
        stops: stops.filter(s => s.trim().length > 0),
        stops_optimized: stopsOptimized,
        distance: distanceKm ?? undefined,
        duree: durationDisplay || undefined,
        date: tripDate,
        time: tripTime,
        passengers,
        luggage,
      },
      driverName: selectedDriver?.name,
      driverPhone: selectedDriver?.phone,
      driverCarteVTC: selectedDriver?.carteProNumber,
      vehicleId: selectedVehicle?.id,
      vehicleName: vehicleLabel,
      vehiclePlate: selectedVehicle?.immatriculation,
      notes: instructions || undefined,
      cgvText,
      cgvInclure,
      mode_horaire: modeHoraire,
      heure_arrivee_souhaitee: modeHoraire === 'arrivee' ? (heureArriveesouhaitee || null) : null,
    }

    if (draftId) {
      await deleteBC(draftId)
    }

    const bcResult = await addBC(newBC)
    if (bcResult) setBRNumber(bcResult.numero)
    setTab("apercu")

    if (plan === "SOLO") {
      setShowBCTokenModal(true)
    } else {
      toast.success("Bon de réservation généré et enregistré")
    }

    if (plan === "SOLO" && userId && bcResult?.id) {
      const { data: consumeResult, error: consumeError } = await supabase.rpc("consume_token_for_bc", {
        p_user_id: userId,
        p_bc_id: bcResult.id,
      })
      if (consumeError || consumeResult?.success === false) {
        console.error("[Tokens] Erreur décrément:", consumeError ?? consumeResult?.error)
      }
      await refreshTokens()
    }
  }

  const toggleSupplement = (id: string) => {
    setSupplements(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s))
  }

  // ── Mode horaire : bascule Départ à / Arrivée à ─────────────────────────
  const handleModeChange = (mode: 'depart' | 'arrivee') => {
    if (mode === modeHoraire) return
    if (mode === 'arrivee') {
      // Initialiser l'heure d'arrivée souhaitée depuis l'arrivée estimée ou l'heure de départ
      if (durationSec > 0 && tripTime && tripDate) {
        const arr = computeArrivalTime(tripDate, tripTime, durationSec)
        setHeureArriveesouhaitee(arr ?? tripTime)
      } else {
        setHeureArriveesouhaitee(tripTime)
      }
    } else {
      setHeureArriveesouhaitee("")
    }
    setModeHoraire(mode)
  }

  // ── Confirmation du sélecteur date/heure ────────────────────────────────
  const handlePickerConfirm = (date: string, time: string) => {
    setTripDate(date)
    if (modeHoraireRef.current === 'depart') {
      setTripTime(time)
    } else {
      setHeureArriveesouhaitee(time)
      if (durationSec > 0) {
        const computed = computeDepartureTime(date, time, durationSec)
        setTripTime(computed ?? "")
      } else {
        setTripTime("")
      }
    }
    setShowDateTimePicker(false)
  }

  // ── Message contextuel (arrivée estimée / départ recommandé) ─────────────
  const contextualMessage = useMemo((): string | null => {
    try {
      if (modeHoraire === 'depart') {
        if (!tripDate || !tripTime || !durationSec) return null
        const arr = computeArrivalTime(tripDate, tripTime, durationSec)
        if (!arr) return null
        return `Arrivée estimée vers ${arr.replace(":", "h")} · avec trafic`
      } else {
        if (!tripTime || !heureArriveesouhaitee) return null
        return `Départ recommandé à ${tripTime.replace(":", "h")} pour arriver à ${heureArriveesouhaitee.replace(":", "h")}`
      }
    } catch { return null }
  }, [modeHoraire, tripDate, tripTime, durationSec, heureArriveesouhaitee])

  useEffect(() => {
    if (step !== "link") return
    const generateToken = async () => {
      if (plan === "SOLO") {
        const { data: existing } = await supabase
          .from("trip_requests")
          .select("id, expires_at")
          .eq("user_id", userId)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .maybeSingle()

        if (existing) {
          setShowLinkLimitAlert(true)
          setStep("menu")
          return
        }
      }

      const expiresAt = new Date()
      if (plan === "SOLO") expiresAt.setHours(expiresAt.getHours() + 24)
      else if (plan === "DUO") expiresAt.setHours(expiresAt.getHours() + 48)
      else expiresAt.setHours(expiresAt.getHours() + 72)

      const { data: token } = await supabase.rpc("generate_trip_token")
      if (!token) return

      const { data: tripRequest } = await supabase
        .from("trip_requests")
        .insert({
          user_id: userId,
          token: token,
          expires_at: expiresAt.toISOString(),
          status: "pending",
        })
        .select("id, token")
        .single()

      if (!tripRequest) return
      setTripRequestId(tripRequest.id)
      setTripToken(tripRequest.token)
    }
    void generateToken()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  if (!open) return null

  // Brouillon existant (pour bannière dans le menu)
  const existingDraft = !ignoreDraft && !prefillBC
    ? bcs.find(b => b.status === "brouillon")
    : null

  // ============================================================================
  // STEP 1: MENU
  // ============================================================================
  if (step === "menu") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-[#0d0d0d] flex items-end justify-center" onClick={handleClose}>
        <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-[#1a1a1a] rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3" />
          <div className="px-5 pt-4 pb-2">
            <h2 className="text-base font-bold text-foreground">Nouveau Bon de Réservation</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Choisissez votre méthode</p>
          </div>

          {/* FEATURE 3 — Bannière brouillon existant */}
          {existingDraft && (
            <div className="mx-5 mb-3 p-3 rounded-xl bg-[#242424] border border-gold/30">
              <p className="text-[11px] text-gold font-semibold mb-1">Un brouillon a été sauvegardé</p>
              <p className="text-[10px] text-muted-foreground mb-2">
                Client : {existingDraft.client || "Non renseigné"} — {existingDraft.trajet?.depart || "Départ non renseigné"}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Pré-remplir depuis le brouillon
                    if (existingDraft.clientId) setSelectedClientId(existingDraft.clientId)
                    if (existingDraft.trajet?.depart) setDeparture(existingDraft.trajet.depart)
                    if (existingDraft.trajet?.arrivee) setArrival(existingDraft.trajet.arrivee)
                    if (existingDraft.trajet?.date) setTripDate(existingDraft.trajet.date)
                    if (existingDraft.trajet?.time) setTripTime(existingDraft.trajet.time)
                    if (existingDraft.trajet?.passengers) setPassengers(existingDraft.trajet.passengers)
                    if (existingDraft.trajet?.luggage) setLuggage(existingDraft.trajet.luggage)
                    if (existingDraft.notes) setInstructions(existingDraft.notes)
                    if (existingDraft.id) setDraftId(existingDraft.id)
                    setStep("form")
                  }}
                  className="flex-1 py-2 rounded-lg bg-gold text-black text-[11px] font-bold"
                >
                  Reprendre
                </button>
                <button
                  onClick={() => { void deleteBC(existingDraft.id); setIgnoreDraft(true) }}
                  className="flex-1 py-2 rounded-lg bg-[#2a2a2a] text-muted-foreground text-[11px] font-semibold"
                >
                  Ignorer
                </button>
              </div>
            </div>
          )}

          <div className="px-5 mb-3 py-2 bg-gold/5 border-y border-gold/10">
            <p className="text-[10px] text-gold/80 text-center flex items-center justify-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Automatisez la saisie des données clients
            </p>
          </div>
          <div className="px-5 pb-6 space-y-3">
            <button onClick={() => setStep("form")} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#242424] border border-onyx-border/30 hover:border-gold/30 transition-all active:scale-[0.98]">
              <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center"><FileText className="h-5 w-5 text-gold" /></div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm text-foreground">Bon de réservation direct</p>
                <p className="text-[11px] text-muted-foreground">Vous finalisez les détails maintenant</p>
              </div>
            </button>
            <button onClick={() => {
              if (onNavigateToTripRequests) {
                onClose()
                onNavigateToTripRequests()
              } else if (localStorage.getItem("hide_link_validity_modal") === "true") {
                setStep("link")
              } else {
                setShowLinkModal(true)
              }
            }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#242424] border border-onyx-border/30 hover:border-gold/30 transition-all active:scale-[0.98]">
              <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center"><Link2 className="h-5 w-5 text-gold" /></div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm text-foreground">Bon de réservation partagé</p>
                <p className="text-[11px] text-muted-foreground">Le client complète ses informations de trajet via un lien sécurisé</p>
              </div>
            </button>
            {plan === "SOLO" ? (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#242424] border border-onyx-border/30 hover:border-gold/30 transition-all active:scale-[0.98] opacity-70"
              >
                <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center relative">
                  <RefreshCw className="h-5 w-5 text-gold" />
                  <Lock className="h-3 w-3 text-gold absolute -top-1 -right-1" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-foreground">Trajets récurrents</p>
                  <p className="text-[11px] text-muted-foreground">Gérez vos courses régulières automatiquement — Pro & Premium</p>
                </div>
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose()
                  onNavigateToRecurring?.()
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#242424] border border-onyx-border/30 hover:border-gold/30 transition-all active:scale-[0.98]"
              >
                <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-gold" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-foreground">Trajets récurrents</p>
                  <p className="text-[11px] text-muted-foreground">Gérez vos courses régulières automatiquement</p>
                </div>
              </button>
            )}
          </div>
        </motion.div>
        {/* stopPropagation : empêche les clics dans les overlays de remonter au backdrop onClick={handleClose} */}
        <div onClick={e => e.stopPropagation()}>
          <LimitAlertModal
            open={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            resourceLabel="trajet récurrent"
            customTitle="🔄 Trajets récurrents"
            customMessage="Les trajets récurrents sont disponibles en offre Pro et Premium."
            onManageOffer={() => { setShowUpgradeModal(false); navigateToSubscription() }}
            onUpgradePro={() => { setShowUpgradeModal(false); setSubDrawerPlan("DUO"); setShowSubDrawer(true) }}
            onUpgradePremium={() => { setShowUpgradeModal(false); setSubDrawerPlan("TEAM"); setShowSubDrawer(true) }}
          />
          <LimitAlertModal
            open={showLinkLimitAlert}
            onClose={() => setShowLinkLimitAlert(false)}
            resourceLabel="lien de demande de trajet"
            customTitle="🔒 Lien actif existant"
            customMessage="🔒 Vous avez déjà un lien de demande de trajet actif. Passez en Pro pour en générer plusieurs simultanément."
            onManageOffer={() => { setShowLinkLimitAlert(false); navigateToSubscription() }}
            onUpgradePro={() => { setShowLinkLimitAlert(false); setSubDrawerPlan("DUO"); setShowSubDrawer(true) }}
            onUpgradePremium={() => { setShowLinkLimitAlert(false); setSubDrawerPlan("TEAM"); setShowSubDrawer(true) }}
          />
          {showLinkModal && (
            <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center px-5"
              onClick={() => setShowLinkModal(false)}>
              <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl p-5 space-y-4"
                onClick={e => e.stopPropagation()}>
                <div className="text-center">
                  <p className="text-2xl mb-2">⏱️</p>
                  <h3 className="text-base font-bold text-foreground">Durée de validité du lien</h3>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm text-muted-foreground">Votre lien sera valable :</p>
                  <ul className="space-y-1 text-sm text-foreground">
                    <li>• <span className="text-muted-foreground">Starter :</span> 24 heures</li>
                    <li>• <span className="text-muted-foreground">Pro :</span> 48 heures</li>
                    <li>• <span className="text-muted-foreground">Premium :</span> 72 heures</li>
                  </ul>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Passé ce délai, le lien expirera automatiquement et ne pourra plus être utilisé.
                  </p>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    id="hide-validity-modal"
                    onCheckedChange={(checked) => {
                      if (checked) localStorage.setItem("hide_link_validity_modal", "true")
                      else localStorage.removeItem("hide_link_validity_modal")
                    }}
                  />
                  <span className="text-[11px] text-muted-foreground">Ne plus afficher ce message</span>
                </label>
                <button
                  onClick={() => { setShowLinkModal(false); setStep("link") }}
                  className="w-full py-3 rounded-xl bg-gold text-black font-semibold text-sm"
                >
                  J&apos;ai compris — Générer le lien
                </button>
              </div>
            </div>
          )}
          <SubscriptionDrawer
            open={showSubDrawer}
            targetPlan={subDrawerPlan}
            onClose={() => setShowSubDrawer(false)}
          />
        </div>
      </motion.div>
    )
  }

  // ============================================================================
  // STEP 2: LINK SHARING
  // ============================================================================
  if (step === "link") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-[#0d0d0d] flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d]">
          <button onClick={() => setStep("menu")} className="p-2 -ml-2 rounded-lg hover:bg-white/5"><ChevronLeft className="h-5 w-5 text-foreground" /></button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-foreground">Partage du lien</h1>
            <p className="text-[10px] text-muted-foreground">Le client remplira ses informations</p>
          </div>
          <button onClick={handleClose} className="p-2 -mr-2 rounded-lg hover:bg-white/5"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Destinataire</label>
            <input type="text" value={linkRecipient} onChange={e => setLinkRecipient(e.target.value)} placeholder="Email ou téléphone du client"
              className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lien de réservation</label>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#1a1a1a] border border-onyx-border/30">
              <div className="flex-1 text-sm font-mono truncate">
                {tripToken
                  ? <span className="text-gold">{`https://app.noxvtc.fr/request/${tripToken}`}</span>
                  : <span className="text-muted-foreground/50 italic text-xs">Génération en cours…</span>}
              </div>
              <button onClick={copyLink} className="p-2 rounded-lg bg-gold/10 hover:bg-gold/20 transition-colors">
                {linkCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-gold" />}
              </button>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-[11px] text-blue-400 text-center">Le client recevra un lien sécurisé pour remplir ses informations de trajet.</p>
          </div>
        </div>
        <div className="px-4 py-4 border-t border-onyx-border/30 bg-[#0d0d0d] space-y-3">
          <div className="flex gap-2">
            <button
              onClick={handleSendSMS}
              disabled={!tripToken}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-gold text-gold font-semibold text-xs hover:bg-gold/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Phone className="h-4 w-4" /> Par SMS
            </button>
            <button
              onClick={handleSendEmail}
              disabled={!tripToken}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-gold text-gold font-semibold text-xs hover:bg-gold/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Mail className="h-4 w-4" /> Par Email
            </button>
            <button
              onClick={handleSendWhatsApp}
              disabled={!tripToken}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gold text-black font-semibold text-xs hover:bg-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <MessageSquare className="h-4 w-4" /> WhatsApp
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  function handleClientCreated(clientId: string, passagerNom?: string, passagerTel?: string) {
    setSelectedClientId(clientId)
    setClientSearch("")
    setClientFocused(false)
    setShowQuickAddClient(false)
    if (passagerNom) setPassagerNom(passagerNom)
    if (passagerTel) setPassagerTelephone(passagerTel)
  }

  // ============================================================================
  // STEP 3: FORM
  // ============================================================================
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-[#0d0d0d] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d]">
        <button onClick={() => setStep("menu")} className="p-2 -ml-2 rounded-lg hover:bg-white/5"><ChevronLeft className="h-5 w-5 text-foreground" /></button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">
            {prefillBC
              ? (prefillBC.status === "brouillon" ? "Reprendre le brouillon" : "Dupliquer le Bon de Réservation")
              : "Nouveau Bon de Réservation"}
          </h1>
          <p className="text-[10px] text-muted-foreground">{brNumber} • Émis le {formatDateFr(creationDate)}</p>
        </div>
        <button onClick={handleClose} className="p-2 -mr-2 rounded-lg hover:bg-white/5"><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-onyx-border/30 bg-[#0d0d0d]">
        {(["formulaire", "apercu"] as FormTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn("flex-1 py-2.5 text-xs font-semibold transition-colors", tab === t ? "text-gold border-b-2 border-gold" : "text-muted-foreground")}>
            {t === "formulaire" ? "Formulaire" : "Aperçu PDF"}
          </button>
        ))}
      </div>

      {/* Form Content */}
      {tab === "formulaire" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
          {/* Bandeau solde de jetons — SOLO uniquement */}
          {plan === "SOLO" && tokens <= 2 && (
            <div className={cn(
              "px-3 py-2 rounded-xl text-xs font-medium border",
              tokens === 0
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            )}>
              {tokens === 0
                ? "🔴 Solde épuisé — Rechargez pour générer"
                : `⚠️ Il vous reste ${tokens} jeton${tokens > 1 ? "s" : ""}. Pensez à recharger.`}
            </div>
          )}
          {/* SECTION: Émetteur & Entreprise */}
          <Section title="Émetteur & Entreprise" icon={User}>
            <div className="p-3 rounded-xl bg-[#242424] border border-gold/20 space-y-1 mb-3">
              <p className="text-xs text-gold font-semibold">Émetteur du document</p>
              <p className="text-sm font-semibold text-foreground">{enterprise?.denomination ?? "Entreprise"}</p>
              <p className="text-[11px] text-muted-foreground">SIREN : {enterprise?.siren ?? ""}</p>
              <p className="text-[11px] text-muted-foreground">TVA : {enterprise?.tvaIntra ?? ""}</p>
              <p className="text-[11px] text-gold">Registre EVTC : {enterprise?.evtcNumber ?? ""}</p>
              <p className="text-[11px] text-muted-foreground">{enterprise?.adresse ?? ""}</p>
            </div>
            <div className="space-y-1" ref={driverRef}>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Chauffeur assigné <span className="text-red-500">*</span></label>
              <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}
                className={cn("w-full px-3 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground focus:outline-none focus:border-gold/50", formErrors.driver ? "border-red-500" : "border-onyx-border/30")} style={{ fontSize: "16px" }}>
                <option value="" disabled>Sélectionner un chauffeur…</option>
                {(drivers ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {formErrors.driver && <p className="text-xs text-red-500 mt-1">{formErrors.driver}</p>}
            </div>
          </Section>

          {/* SECTION: Client */}
          <Section title="Client" icon={Building2}>
            {/* Prefilled Client Badge */}
            {manualClient && !selectedClientId && (
              <div className="p-3 rounded-xl bg-gold/10 border border-gold/30 space-y-1 mb-3 relative group">
                <p className="text-[10px] text-gold font-bold uppercase tracking-tighter">Client pré-sélectionné</p>
                <p className="text-sm font-semibold text-foreground">{manualClient.civilite} {manualClient.prenom} {manualClient.nom}</p>
                <p className="text-[11px] text-muted-foreground">{manualClient.tel}</p>
                <button onClick={() => setManualClient(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-gold/10 text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => { setShowQuickAddClient(true) }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#242424] border border-dashed border-gold/30 text-gold text-[11px] font-medium hover:bg-gold/5 hover:border-gold/50 transition-all"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Ajouter un nouveau client
            </button>

            <div ref={clientRef} className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Rechercher un client <span className="text-red-500">*</span></label>
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
                    className={cn("w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50", formErrors.client ? "border-red-500" : "border-onyx-border/30")}
                    style={{ fontSize: "16px" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setShowClientModal(true); setModalSearch(""); setModalSelectedCompany(null) }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-[11px] text-muted-foreground hover:border-gold/30 hover:text-gold transition-colors whitespace-nowrap"
                >
                  <Users className="h-3.5 w-3.5" />
                  Voir tous
                </button>
              </div>
              {formErrors.client && <p className="text-xs text-red-500 mt-1">{formErrors.client}</p>}
            </div>

            {(clientFocused || clientSearch.trim() || !!inlineSelectedCompany) && !selectedClientId && (
              <div className="max-h-[200px] overflow-y-auto rounded-xl bg-[#242424] border border-onyx-border/30 divide-y divide-onyx-border/20">
                {inlineSelectedCompany ? (
                  <>
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left"
                      onClick={() => setInlineSelectedCompany(null)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground truncate">{inlineSelectedCompany.raisonSociale}</span>
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                      onClick={() => {
                        setSelectedClientId(inlineSelectedCompany.id)
                        setClientSearch("")
                        setClientFocused(false)
                        setInlineSelectedCompany(null)
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-onyx-card border border-onyx-border/30 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">Sans passager distinct</p>
                        <p className="text-[10px] text-muted-foreground">Société = client et passager</p>
                      </div>
                    </button>
                    {inlineSelectedCompany.contacts!.map(contact => (
                      <button
                        key={contact.id}
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                        onClick={() => {
                          setSelectedClientId(inlineSelectedCompany.id)
                          setPassagerNom(`${contact.prenom ?? ""} ${contact.nom ?? ""}`.trim())
                          if (contact.phone) setPassagerTelephone(contact.phone)
                          setClientSearch("")
                          setClientFocused(false)
                          setInlineSelectedCompany(null)
                        }}
                      >
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold flex-shrink-0">
                          {(contact.prenom?.[0] ?? "").toUpperCase()}{(contact.nom?.[0] ?? "").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {contact.prenom ?? ""} {contact.nom ?? ""}
                          </p>
                          {contact.phone && (
                            <p className="text-[10px] text-muted-foreground truncate">{contact.phone}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                ) : filteredClients.length === 0 ? (
                  <>
                    <p className="px-4 py-3 text-[11px] text-muted-foreground italic">
                      {(clients ?? []).length === 0
                        ? "Aucun client enregistré"
                        : "Aucun résultat"}
                    </p>
                  </>
                ) : (
                  <>
                    {filteredClients.slice(0, 8).map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (c.type === "professionnel" && (c.contacts?.length ?? 0) > 0) {
                            setInlineSelectedCompany(c)
                          } else {
                            setSelectedClientId(c.id)
                            setClientSearch("")
                            setClientFocused(false)
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                      >
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
                              ? `${(c.contacts?.length ?? 0)} passager${(c.contacts?.length ?? 0) !== 1 ? "s" : ""}`
                              : (c.phone ?? "")}
                          </p>
                        </div>
                        {c.type === "professionnel" && (c.contacts?.length ?? 0) > 0 && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                        )}
                      </button>
                    ))}
                  </>
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
                    <button onClick={() => { setSelectedClientId(""); setPassagerNom(""); setPassagerTelephone(""); setPassengerSearch("") }}
                      className="text-[10px] text-muted-foreground hover:text-foreground">Modifier</button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{selectedClient.phone ?? ""} • {selectedClient.email ?? ""}</p>
                  {selectedClient.type === "professionnel" && selectedClient.siren && (
                    <p className="text-[11px] text-gold">SIREN : {selectedClient.siren}</p>
                  )}
                </div>

                {/* Passager distinct pour les sociétés */}
                {selectedClient.type === "professionnel" && (
                  <div className="space-y-2 pt-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Passager transporté <span className="text-muted-foreground/50 normal-case">(si différent du client payeur)</span>
                    </label>

                    {/* Sélection passager existant — combobox searchable */}
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
                            {filteredPassengers.length > 0 ? (
                              filteredPassengers.map(contact => (
                                <button
                                  key={contact.id}
                                  type="button"
                                  onClick={() => {
                                    setPassagerNom(`${contact.prenom ?? ""} ${contact.nom ?? ""}`.trim())
                                    if (contact.phone) setPassagerTelephone(contact.phone)
                                    setPassengerSearch("")
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left border-b border-onyx-border/20 last:border-0"
                                >
                                  <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold shrink-0">
                                    {(contact.prenom?.[0] ?? "").toUpperCase()}{(contact.nom?.[0] ?? "").toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {contact.prenom ?? ""} {contact.nom ?? ""}
                                    </p>
                                    {contact.phone && (
                                      <p className="text-[10px] text-muted-foreground truncate">{contact.phone}</p>
                                    )}
                                  </div>
                                </button>
                              ))
                            ) : (
                              <p className="px-3 py-2.5 text-[11px] text-muted-foreground/60 italic">Aucun passager trouvé</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <input type="text" value={passagerNom} onChange={e => setPassagerNom(e.target.value)}
                      placeholder="Nom du passager"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }} />
                    <PhoneInput
                      value={passagerTelephone}
                      onChange={setPassagerTelephone}
                      placeholder="Téléphone du passager"
                      fieldCls="bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50"
                    />
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* SECTION: Trajet */}
          <Section title="Trajet" icon={Navigation}>
            <div ref={departureRef} className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Adresse de départ <span className="text-red-500">*</span></label>
              <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border focus-within:border-gold/50", formErrors.departure ? "border-red-500" : "border-onyx-border/30")}>
                <MapPin className="h-4 w-4 text-green-400 flex-shrink-0" strokeWidth={1.5} />
                <PlacesAutocomplete value={departure} onChange={setDeparture} placeholder="Rechercher une adresse..."
                  addressMode="full"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  style={{ fontSize: "16px" }} />
                {departure && (
                  <button
                    type="button"
                    aria-label="Effacer l'adresse"
                    onClick={() => { setDeparture(""); setDistanceKm(null); setDurationDisplay(""); setEditableBasePrice(null) }}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {formErrors.departure && <p className="text-xs text-red-500 mt-1">{formErrors.departure}</p>}
            </div>

            {/* Arrêts intermédiaires */}
            {stops.map((stop, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Arrêt {index + 1}
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => {
                        const s = [...stops]
                        ;[s[index - 1], s[index]] = [s[index], s[index - 1]]
                        setStops(s)
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Monter"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M18 15l-6-6-6 6"/></svg>
                    </button>
                    <button
                      type="button"
                      disabled={index === stops.length - 1}
                      onClick={() => {
                        const s = [...stops]
                        ;[s[index], s[index + 1]] = [s[index + 1], s[index]]
                        setStops(s)
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Descendre"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStops(stops.filter((_, i) => i !== index))}
                      className="p-1 rounded text-muted-foreground hover:text-red-400"
                      aria-label="Supprimer l'arrêt"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 focus-within:border-gold/50">
                  <div className="h-4 w-4 rounded-full bg-orange-400 flex-shrink-0" />
                  <PlacesAutocomplete
                    value={stop}
                    onChange={(val) => {
                      const s = [...stops]
                      s[index] = val
                      setStops(s)
                    }}
                    placeholder="Rechercher une adresse..."
                    addressMode="full"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                    style={{ fontSize: "16px" }}
                  />
                  {stop && (
                    <button
                      type="button"
                      aria-label="Effacer l'arrêt"
                      onClick={() => {
                        const s = [...stops]
                        s[index] = ""
                        setStops(s)
                      }}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {stops.length < 5 && (
              <button
                type="button"
                onClick={() => {
                  if (plan === "SOLO") { setShowStopsLimitAlert(true); return }
                  setStops([...stops, ""])
                }}
                className="flex items-center gap-1.5 text-[11px] text-orange-400 hover:text-orange-300 transition-colors py-0.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter un arrêt intermédiaire
              </button>
            )}

            {/* Toggle optimisation d'ordre des arrêts */}
            {stops.filter(s => s.trim().length > 0).length >= 2 && (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium text-foreground">
                    Optimiser l&apos;ordre des arrêts
                  </span>
                </div>
                <button
                    type="button"
                    onClick={async () => {
                      if (stopsOptimized) {
                        setStopsOptimized(false)
                        return
                      }
                      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                      if (!apiKey) return
                      const filled = stops.filter(s => s.trim().length > 0)
                      try {
                        const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "X-Goog-Api-Key": apiKey,
                            "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex",
                          },
                          body: JSON.stringify({
                            origin: { address: departure },
                            destination: { address: arrival },
                            intermediates: filled.map(s => ({ address: s })),
                            travelMode: "DRIVE",
                            optimizeWaypointOrder: true,
                          }),
                        })
                        if (res.ok) {
                          const data = await res.json()
                          const order: number[] = data.routes?.[0]?.optimizedIntermediateWaypointIndex ?? []
                          if (order.length === filled.length) {
                            const reordered = order.map(i => filled[i])
                            // Préserver les entrées vides aux positions d'origine
                            const next = [...stops]
                            let fi = 0
                            for (let i = 0; i < next.length; i++) {
                              if (next[i].trim().length > 0) { next[i] = reordered[fi++] }
                            }
                            setStops(next)
                          }
                        }
                      } catch { /* silencieux */ }
                      setStopsOptimized(true)
                      toast.success("Ordre des arrêts optimisé par Google Maps ✓")
                    }}
                    className={cn(
                      "relative w-9 h-5 rounded-full transition-colors shrink-0",
                      stopsOptimized ? "bg-gold" : "bg-[#444]"
                    )}
                    aria-label="Optimiser l'ordre des arrêts"
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      stopsOptimized ? "translate-x-4" : "translate-x-0"
                    )} />
                  </button>
              </div>
            )}
            {stops.filter(s => s.trim().length > 0).length >= 2 && (
              <p className="text-[10px] text-muted-foreground/60 px-1">
                {stopsOptimized ? "Optimisé par Google ✓" : "Ordre manuel"}
              </p>
            )}

            <div ref={arrivalRef} className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Adresse d&apos;arrivée <span className="text-red-500">*</span></label>
              <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border focus-within:border-gold/50", formErrors.arrival ? "border-red-500" : "border-onyx-border/30")}>
                <MapPin className="h-4 w-4 text-red-400 flex-shrink-0" strokeWidth={1.5} />
                <PlacesAutocomplete value={arrival} onChange={setArrival} placeholder="Rechercher une adresse..."
                  addressMode="full"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  style={{ fontSize: "16px" }} />
                {arrival && (
                  <button
                    type="button"
                    aria-label="Effacer l'adresse"
                    onClick={() => { setArrival(""); setDistanceKm(null); setDurationDisplay(""); setEditableBasePrice(null) }}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {formErrors.arrival && <p className="text-xs text-red-500 mt-1">{formErrors.arrival}</p>}
            </div>

            {/* Toggle Départ à / Arrivée à */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Mode horaire <span className="text-red-500">*</span>
              </label>
              <div className="flex bg-[#242424] border border-onyx-border/30 rounded-xl p-1 mt-1.5">
                <button type="button" onClick={() => handleModeChange('depart')}
                  className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all text-center",
                    modeHoraire === 'depart' ? "bg-gold text-black" : "text-muted-foreground hover:text-foreground")}>
                  Départ à
                </button>
                <button type="button" onClick={() => handleModeChange('arrivee')}
                  className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all text-center",
                    modeHoraire === 'arrivee' ? "bg-gold text-black" : "text-muted-foreground hover:text-foreground")}>
                  Arrivée à
                </button>
              </div>
            </div>

            {/* Sélecteur date/heure combiné */}
            <div ref={dateRef} className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {modeHoraire === 'depart' ? "Date et heure de départ" : "Date et heure d'arrivée souhaitée"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <button type="button" onClick={() => setShowDateTimePicker(true)}
                className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#242424] border hover:border-gold/50 transition-colors text-left", (formErrors.date || formErrors.time) ? "border-red-500" : "border-onyx-border/30")}>
                <Calendar className="h-4 w-4 text-gold/70 flex-shrink-0" strokeWidth={1.5} />
                <span className={cn("flex-1 text-sm",
                  tripDate ? "text-foreground" : "text-muted-foreground/50")}>
                  {modeHoraire === 'depart'
                    ? (tripDate ? formatCombinedDateTime(tripDate, tripTime) : "Choisir la date et l'heure")
                    : (tripDate ? formatCombinedDateTime(tripDate, heureArriveesouhaitee) : "Choisir la date et l'heure")
                  }
                </span>
                <span className="text-[11px] text-gold font-medium">Modifier</span>
              </button>
              {(formErrors.date || formErrors.time) && (
                <p className="text-xs text-red-500 mt-1">{formErrors.date ?? formErrors.time}</p>
              )}
            </div>

            {/* Message contextuel arrivée estimée / départ recommandé */}
            {contextualMessage && (
              <div className="flex items-center gap-1.5 px-1">
                <Clock className="h-3 w-3 text-gold/60 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-[11px] text-muted-foreground/80">{contextualMessage}</p>
              </div>
            )}

            {/* Distance & Durée — calculées après saisie adresses + date + heure */}
            {modeHoraire === 'depart' && !tripDate && !tripTime && (departure.length >= 5 || arrival.length >= 5) && (
              <p className="text-[11px] text-muted-foreground/50 italic">
                Renseignez la date et l&apos;heure pour obtenir une durée avec trafic
              </p>
            )}
            <div className="flex gap-2">
              <div className="flex-1 rounded-xl bg-[#1c1c1c] border border-onyx-border/20 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Distance estimée</p>
                {isAutoCalculating ? (
                  <span className="flex items-center gap-1.5 text-sm text-gold/60"><Loader2 className="h-3.5 w-3.5 animate-spin" />…</span>
                ) : distanceKm !== null ? (
                  <p className="text-sm font-medium text-foreground">{distanceKm} km</p>
                ) : (
                  <p className="text-sm text-muted-foreground/40 select-none">—</p>
                )}
              </div>
              <div className="flex-1 rounded-xl bg-[#1c1c1c] border border-onyx-border/20 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
                  Durée{durationDisplay ? " (trafic estimé)" : ""}
                </p>
                {isAutoCalculating ? (
                  <span className="flex items-center gap-1.5 text-sm text-gold/60"><Loader2 className="h-3.5 w-3.5 animate-spin" />…</span>
                ) : durationDisplay ? (
                  <p className="text-sm font-medium text-foreground">{durationDisplay}</p>
                ) : (
                  <p className="text-sm text-muted-foreground/40 select-none">—</p>
                )}
              </div>
            </div>

            {/* Tarif badge */}
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold",
                tarif.id === "c" ? "bg-purple-500/20 text-purple-400" : tarif.id === "b" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400")}>
                Tarif {tarif.id.toUpperCase()} — {tarif.name} (×{tarif.coef})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Passagers</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPassengers(Math.max(1, passengers - 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5">-</button>
                  <span className="flex-1 text-center text-sm font-semibold text-foreground">{passengers}</span>
                  <button onClick={() => setPassengers(Math.min(8, passengers + 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5">+</button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bagages</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setLuggage(Math.max(0, luggage - 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5">-</button>
                  <span className="flex-1 text-center text-sm font-semibold text-foreground">{luggage}</span>
                  <button onClick={() => setLuggage(Math.min(10, luggage + 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5">+</button>
                </div>
              </div>
            </div>
          </Section>

          {/* SECTION: Véhicule */}
          <div ref={vehicleRef}>
          <Section title="Véhicule" icon={Car}>
            <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Véhicule <span className="text-red-500">*</span></label>
            <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}
              className={cn("w-full px-3 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground focus:outline-none focus:border-gold/50", formErrors.vehicle ? "border-red-500" : "border-onyx-border/30")} style={{ fontSize: "16px" }}>
              <option value="">Sélectionner un véhicule...</option>
              {(vehicles ?? []).filter(v => v.inService).map(v => (
                <option key={v.id} value={v.id}>
                  {[v.marque, v.modele].filter(Boolean).join(' ')} — {v.immatriculation}
                </option>
              ))}
              {(vehicles ?? []).filter(v => !v.inService).length > 0 && (
                <>
                  <option disabled>── Hors service ──</option>
                  {(vehicles ?? []).filter(v => !v.inService).map(v => (
                    <option key={v.id} value={v.id} disabled>
                      {[v.marque, v.modele].filter(Boolean).join(' ')} — {v.immatriculation}
                    </option>
                  ))}
                </>
              )}
            </select>
            {formErrors.vehicle && <p className="text-xs text-red-500 mt-1">{formErrors.vehicle}</p>}
            </div>
            {selectedVehicle && (
              <div className="p-3 rounded-xl bg-[#242424] space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {[selectedVehicle.marque, selectedVehicle.modele].filter(Boolean).join(' ')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedVehicle.immatriculation} • {selectedVehicle.category} • {selectedVehicle.type_energie}
                </p>
              </div>
            )}
          </Section>
          </div>

          {/* SECTION: Tarification */}
          <Section title="Tarification" icon={Euro}>
            <div className="flex bg-secondary/30 border border-onyx-border/30 rounded-xl p-1 mt-3">
              <button
                className={cn("flex-1 text-xs py-2 rounded-lg font-medium transition-all text-center", pricingMode === "calcul" ? "bg-onyx-card shadow text-gold border border-gold/20" : "text-muted-foreground hover:text-foreground")}
                onClick={() => { setPricingMode("calcul"); setBaseTvaRate(10) }}
              >Calcul au km</button>
              <button
                className={cn("flex-1 text-xs py-2 rounded-lg font-medium transition-all text-center", pricingMode === "forfait" ? "bg-onyx-card shadow text-gold border border-gold/20" : "text-muted-foreground hover:text-foreground")}
                onClick={() => { setPricingMode("forfait"); setBaseTvaRate(10) }}
              >Forfait fixe</button>
            </div>


            {pricingMode === "forfait" && (
              <select value={selectedForfaitId} onChange={e => { setSelectedForfaitId(e.target.value); setEditableBasePrice(null) }}
                className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }}>
                <option value="">Sélectionner un forfait...</option>
                {(tariffSettings.forfaits ?? []).map(f => (
                  <option key={f.id} value={f.id}>{f.name} — {formatPrice(f.price)}</option>
                ))}
              </select>
            )}

            {supplements.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setSupplementsOpen(o => !o)}
                  className="w-full flex items-center justify-between py-1.5 text-left"
                >
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {(() => {
                      const n = supplements.filter(s => s.selected).length
                      return n > 0 ? `Suppléments (${n} sélectionné${n > 1 ? "s" : ""})` : "Suppléments disponibles"
                    })()}
                  </span>
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200", supplementsOpen && "rotate-180")} />
                </button>
                {supplementsOpen && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {supplements.map(s => (
                      <button key={s.id} onClick={() => toggleSupplement(s.id)}
                        className={cn("px-3 py-1.5 rounded-full text-[11px] font-medium transition-all",
                          s.selected ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground border border-onyx-border/30 hover:border-gold/30")}>
                        {s.label} (+{formatPrice(s.price)})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Remise commerciale</label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2">
                  <input type="number" inputMode="decimal" value={discountValue || ""} onChange={e => setDiscountValue(Number(e.target.value) || 0)} placeholder="0"
                    className="flex-1 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
                </div>
                <div className="flex">
                  <button onClick={() => setDiscountType("percent")}
                    className={cn("px-3 py-2 rounded-l-xl text-xs font-semibold", discountType === "percent" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground border border-onyx-border/30")}>%</button>
                  <button onClick={() => setDiscountType("amount")}
                    className={cn("px-3 py-2 rounded-r-xl text-xs font-semibold", discountType === "amount" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground border border-onyx-border/30")}>€</button>
                </div>
              </div>
            </div>

            {/* Checkbox micro-entrepreneur */}
            <label className="flex items-center gap-2.5 cursor-pointer py-1">
              <Checkbox
                id="micro-bc"
                checked={isMicroBC}
                onCheckedChange={(v) => setIsMicroBC(v === true)}
                className="border-white/40 data-[state=checked]:bg-gold data-[state=checked]:border-gold data-[state=checked]:text-black"
              />
              <span className="text-[12px] text-foreground/80 select-none">TVA non applicable (art. 293B CGI)</span>
            </label>

            {/* Montant éditable — prérempli par la grille tarifaire */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {isMicroBC ? "Montant de la prestation" : "Montant HT"}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={editableBasePrice !== null ? editableBasePrice : Math.round(pricing.baseHT * 100) / 100}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  setEditableBasePrice(isNaN(v) ? null : v)
                }}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50"
                style={{ fontSize: "16px" }}
              />
            </div>

            {/* Pricing Summary */}
            <div className="p-4 rounded-xl bg-[#242424] border border-gold/20 space-y-2">
              {!isMicroBC && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-muted-foreground">Base HT</span>
                  <span className="text-foreground">{formatPrice(pricing.baseHT)}</span>
                </div>
              )}
              {pricing.supplementsTotal > 0 ? (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-muted-foreground">Suppléments HT</span>
                  <span className="text-foreground">+{formatPrice(pricing.supplementsTotal)}</span>
                </div>
              ) : (
                !isMicroBC && <div className="h-4" />
              )}
              {pricing.discountAmount > 0 && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-red-400">Remise commerciale</span>
                  <span className="text-red-400">-{formatPrice(pricing.discountAmount)}</span>
                </div>
              )}
              <div className="border-t border-onyx-border/30 pt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">{isMicroBC ? "Montant de la prestation" : "Total HT"}</span>
                <span className="text-foreground font-medium">{formatPrice(pricing.totalHT)}</span>
              </div>
              {!isMicroBC && pricing.tva10 > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA (10%)</span>
                  <span className="text-foreground font-medium">{formatPrice(pricing.tva10)}</span>
                </div>
              )}
              {!isMicroBC && pricing.tva20 > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA (20%)</span>
                  <span className="text-foreground font-medium">{formatPrice(pricing.tva20)}</span>
                </div>
              )}
              {isMicroBC && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600 font-medium text-[11px]">{legalProfile.vatMention ?? "TVA non applicable, art. 293 B du CGI"}</span>
                </div>
              )}
              {!isMicroBC ? (
                <div className="border-t border-onyx-border/30 pt-2 flex justify-between items-end">
                  <span className="text-foreground font-bold">Total TTC</span>
                  {pricing.discountAmount > 0 ? (
                    <div className="text-right">
                      <span className="text-muted-foreground line-through text-xs mr-2">{formatPrice(pricing.originalTTC)}</span>
                      <span className="text-gold font-bold text-lg">{formatPrice(pricing.totalTTC)}</span>
                    </div>
                  ) : (
                    <span className="text-gold font-bold text-lg">{formatPrice(pricing.totalTTC)}</span>
                  )}
                </div>
              ) : (
                <div className="border-t border-onyx-border/30 pt-2 flex justify-between items-end">
                  <span className="text-foreground font-bold">Total</span>
                  {pricing.discountAmount > 0 ? (
                    <div className="text-right">
                      <span className="text-muted-foreground line-through text-xs mr-2">{formatPrice(pricing.originalHT)}</span>
                      <span className="text-gold font-bold text-lg">{formatPrice(pricing.totalHT)}</span>
                    </div>
                  ) : (
                    <span className="text-gold font-bold text-lg">{formatPrice(pricing.totalHT)}</span>
                  )}
                </div>
              )}
              <div className="pt-2 border-t border-onyx-border/30">
                <p className="text-[9px] text-muted-foreground leading-relaxed">Détail : {pricing.fullDetail}</p>
              </div>
            </div>
          </Section>

          {/* SECTION: Notes & Instructions */}
          <Section title="Notes & Instructions" icon={MessageSquare}>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="Instructions particulières, informations complémentaires..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50 resize-none"
            />
          </Section>

          {/* SECTION: Conditions Générales de Vente applicables */}
          <div ref={cgvRef} className={cn("border rounded-xl bg-[#1a1a1a] overflow-hidden", (!enterprise.cgvMode || formErrors.cgv) ? "border-red-500/60" : "border-emerald-500/50")}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-onyx-border/20">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gold" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-foreground">Conditions Générales de Vente applicables</span>
              </div>
              {cgvConfigured && (
                <button
                  type="button"
                  onClick={() => setShowCGVModal(true)}
                  className="text-[11px] text-gold hover:text-gold/80 transition-colors font-medium"
                >
                  Voir les CGV complètes
                </button>
              )}
            </div>
            <div className="px-4 py-3 space-y-3">
              {!enterprise.cgvMode ? (
                <p className="text-[11px] text-red-400">
                  Les CGV sont obligatoires —{" "}
                  <button
                    type="button"
                    onClick={() => { handleClose(); navigateToCGV() }}
                    className="underline font-medium hover:text-red-300 transition-colors"
                  >
                    Configurer maintenant
                  </button>
                </p>
              ) : (
                <p className={cn("text-[11px] leading-relaxed whitespace-pre-wrap", cgvConfigured ? "text-foreground/80" : "text-muted-foreground italic")}>
                  {cgvConfigured ? cgvPreview : "Aucune condition générale de vente n'a été configurée."}
                </p>
              )}
              {!cgvConfigured && enterprise.cgvMode && (
                <button
                  type="button"
                  onClick={() => { handleClose(); navigateToCGV() }}
                  className="text-[11px] text-gold font-medium hover:underline"
                >
                  Configurer maintenant
                </button>
              )}
              {formErrors.cgv && <p className="text-xs text-red-500">{formErrors.cgv}</p>}
              <label htmlFor="cgv-inclure" className={cn(
                "flex items-center gap-2.5 cursor-pointer",
                !cgvConfigured && "opacity-50 cursor-not-allowed"
              )}>
                <Checkbox
                  id="cgv-inclure"
                  checked={cgvInclure && cgvConfigured}
                  disabled={!cgvConfigured}
                  onCheckedChange={(v) => setCgvInclure(v === true)}
                  className="border-onyx-border/50 data-[state=checked]:bg-gold data-[state=checked]:border-gold data-[state=checked]:text-black"
                />
                <span className="text-[12px] text-foreground/80 select-none">
                  Inclure les CGV dans le PDF
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Modale CGV complètes */}
      <AnimatePresence>
        {showCGVModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/70 flex items-end justify-center"
            onClick={() => setShowCGVModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="w-full max-w-md bg-[#1a1a1a] rounded-t-3xl overflow-hidden max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-onyx-border/30 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gold" strokeWidth={1.5} />
                  <span className="text-sm font-bold text-foreground">Conditions Générales de Vente</span>
                </div>
                <button
                  onClick={() => setShowCGVModal(false)}
                  className="w-8 h-8 rounded-xl bg-onyx-card/60 border border-onyx-border/20 flex items-center justify-center hover:bg-onyx-card active:scale-95 transition-all"
                >
                  <X className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {cgvSummary}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modale sélection client */}
      <AnimatePresence>
        {showClientModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-black/70 flex items-end justify-center"
            onClick={() => setShowClientModal(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="w-full max-w-md bg-[#1a1a1a] rounded-t-3xl overflow-hidden max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-onyx-border/30 flex-shrink-0">
                {modalSelectedCompany ? (
                  <button
                    onClick={() => setModalSelectedCompany(null)}
                    className="w-8 h-8 rounded-xl bg-onyx-card/60 border border-onyx-border/20 flex items-center justify-center hover:bg-onyx-card active:scale-95 transition-all"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowClientModal(false)}
                    className="w-8 h-8 rounded-xl bg-onyx-card/60 border border-onyx-border/20 flex items-center justify-center hover:bg-onyx-card active:scale-95 transition-all"
                  >
                    <X className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {modalSelectedCompany ? (modalSelectedCompany.raisonSociale ?? "Société") : "Sélectionner un client"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {modalSelectedCompany
                      ? "Choisissez le passager à transporter"
                      : `${(clients ?? []).length} client${(clients ?? []).length !== 1 ? "s" : ""} enregistré${(clients ?? []).length !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>

              {/* Barre de recherche (uniquement hors vue société) */}
              {!modalSelectedCompany && (
                <div className="px-5 pt-3 pb-2 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={modalSearch}
                      onChange={e => setModalSearch(e.target.value)}
                      placeholder="Nom, société, téléphone..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }}
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Liste */}
              <div className="flex-1 overflow-y-auto divide-y divide-onyx-border/20">
                {modalSelectedCompany ? (
                  // Vue contacts d'une société
                  (modalSelectedCompany.contacts?.length ?? 0) > 0 ? (
                    <>
                      <button
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 text-left"
                        onClick={() => {
                          setSelectedClientId(modalSelectedCompany.id)
                          setClientSearch("")
                          setShowClientModal(false)
                          setModalSelectedCompany(null)
                        }}
                      >
                        <div className="w-8 h-8 rounded-full bg-onyx-card border border-onyx-border/30 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Sans passager distinct</p>
                          <p className="text-[10px] text-muted-foreground">Société = client et passager</p>
                        </div>
                      </button>
                      {modalSelectedCompany.contacts!.map(contact => (
                        <button
                          key={contact.id}
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 text-left"
                          onClick={() => {
                            setSelectedClientId(modalSelectedCompany.id)
                            setPassagerNom(`${contact.prenom ?? ""} ${contact.nom ?? ""}`.trim())
                            if (contact.phone) setPassagerTelephone(contact.phone)
                            setClientSearch("")
                            setShowClientModal(false)
                            setModalSelectedCompany(null)
                          }}
                        >
                          <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold flex-shrink-0">
                            {(contact.prenom?.[0] ?? "").toUpperCase()}{(contact.nom?.[0] ?? "").toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {contact.prenom ?? ""} {contact.nom ?? ""}
                            </p>
                            {contact.phone && (
                              <p className="text-[10px] text-muted-foreground truncate">{contact.phone}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="px-5 py-8 text-center space-y-3">
                      <p className="text-[12px] text-muted-foreground">Aucun passager enregistré pour cette société</p>
                      <button
                        className="text-[11px] text-gold"
                        onClick={() => {
                          setSelectedClientId(modalSelectedCompany.id)
                          setClientSearch("")
                          setShowClientModal(false)
                          setModalSelectedCompany(null)
                        }}
                      >
                        Sélectionner la société quand même
                      </button>
                    </div>
                  )
                ) : (
                  // Vue liste clients
                  modalFilteredClients.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-[12px] text-muted-foreground italic">
                        {(clients ?? []).length === 0
                          ? "Aucun client enregistré — vous pouvez saisir manuellement"
                          : "Aucun client ne correspond à la recherche"}
                      </p>
                    </div>
                  ) : (
                    modalFilteredClients.map(c => (
                      <button
                        key={c.id}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 text-left"
                        onClick={() => {
                          if (c.type === "professionnel" && (c.contacts?.length ?? 0) > 0) {
                            setModalSelectedCompany(c)
                          } else {
                            setSelectedClientId(c.id)
                            setClientSearch("")
                            setShowClientModal(false)
                          }
                        }}
                      >
                        <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold flex-shrink-0">
                          {c.type === "particulier"
                            ? `${c.prenom?.[0] ?? ""}${c.nom?.[0] ?? ""}`.toUpperCase()
                            : (c.raisonSociale?.[0] ?? "").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {c.type === "particulier"
                              ? `${c.prenom ?? ""} ${c.nom ?? ""}`.trim()
                              : (c.raisonSociale ?? "")}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {c.type === "professionnel"
                              ? `${c.contacts?.length ?? 0} passager${(c.contacts?.length ?? 0) !== 1 ? "s" : ""} enregistré${(c.contacts?.length ?? 0) !== 1 ? "s" : ""}`
                              : (c.phone ?? "")}
                          </p>
                        </div>
                        {c.type === "professionnel" && (c.contacts?.length ?? 0) > 0 && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                        )}
                      </button>
                    ))
                  )
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Preview */}
      {tab === "apercu" && (
        <div className="flex-1 overflow-y-auto p-4 bg-[#1a1a1a]">
          {/* BUG 2 — Bouton "Nouveau bon" visible dans l'aperçu */}
          {isSubmitting && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <p className="text-[11px] text-emerald-400 font-semibold">BC généré avec succès</p>
              <button onClick={resetForm}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242424] border border-onyx-border/30 text-[11px] text-foreground hover:border-gold/30 transition-colors">
                <RotateCcw className="h-3 w-3" />
                Nouveau bon
              </button>
            </div>
          )}

          <div className="max-w-[400px] mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                <div className="flex-1 pr-2 border-r border-gray-200">
                  <p className="text-[12px] font-bold text-gray-900">{enterprise?.denomination ?? ""}</p>
                  <p className="text-[8px] text-gray-500">{enterprise?.adresse ?? ""}</p>
                  <p className="text-[8px] text-gray-500">SIREN : {enterprise?.siren ?? ""}</p>
                  {legalProfile.mustDisplayVatNumber && (
                    <p className="text-[8px] text-gray-500">TVA : {enterprise?.tvaIntra ?? ""}</p>
                  )}
                  {legalProfile.mustDisplayVatExemption && (
                    <p className="text-[8px] text-amber-600 font-medium">{legalProfile.vatMention ?? "TVA non applicable, art. 293 B du CGI"}</p>
                  )}
                  <p className="text-[8px] text-amber-600 font-medium">EVTC : {enterprise?.evtcNumber ?? ""}</p>
                </div>
                <div className="text-right pl-2">
                  <p className="text-[12px] font-bold text-gray-900">BON DE RÉSERVATION</p>
                  <p className="text-[10px] text-gray-500">{brNumber}</p>
                  <p className="text-[10px] text-gray-500">Émis le {formatDateFr(creationDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <p className="font-bold text-gray-700 mb-1">CHAUFFEUR</p>
                  <p className="text-gray-900">{selectedDriver?.name ?? "Non assigné"}</p>
                  {selectedDriver?.carteProNumber && selectedDriver.carteProNumber !== "—" && selectedDriver.carteProNumber.trim() && (
                    <p className="text-amber-600">Carte VTC : {selectedDriver.carteProNumber}</p>
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-700 mb-1">CLIENT</p>
                  {selectedClient ? (
                    <>
                      <p className="text-gray-900">
                        {selectedClient.type === "particulier" ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}` : (selectedClient.raisonSociale ?? "")}
                      </p>
                      <p className="text-gray-500">{selectedClient.phone ?? ""}</p>
                    </>
                  ) : manualClient ? (
                    <>
                      <p className="text-gray-900">{manualClient.civilite} {manualClient.prenom} {manualClient.nom}</p>
                      <p className="text-gray-500">{manualClient.tel}</p>
                    </>
                  ) : <p className="text-gray-400">Non sélectionné</p>}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-[10px]">
                <p className="font-bold text-gray-700 mb-2">TRAJET</p>
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-green-500">●</span>
                  <span className="text-gray-900">{departure || "Départ non renseigné"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-500">●</span>
                  <span className="text-gray-900">{arrival || "Arrivée non renseignée"}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between">
                  <span className="text-gray-500">Date & Heure :</span>
                  <span className="text-gray-900">{tripDate ? formatDateFR(tripDate) : "—"} à {formatTimeFrFromString(tripTime) || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Distance - Durée :</span>
                  <span className="text-gray-900">
                    {distanceKm !== null ? `${distanceKm} km` : "—"}
                    {durationDisplay ? ` - ${durationDisplay}` : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Passagers / Bagages :</span>
                  <span className="text-gray-900">{passengers} / {luggage}</span>
                </div>
              </div>

              {selectedVehicle && (
                <div className="text-[10px]">
                  <p className="font-bold text-gray-700 mb-1">VÉHICULE</p>
                  <p className="text-gray-900">
                    {[selectedVehicle.marque, selectedVehicle.modele].filter(Boolean).join(' ')} • {selectedVehicle.immatriculation}
                  </p>
                </div>
              )}

              <div className="border-t border-gray-200 pt-3 text-[10px]">
                {!isMicroBC && (
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Total HT</span>
                    <span className="text-gray-900">{formatPrice(pricing.totalHT)}</span>
                  </div>
                )}
                {!isMicroBC && pricing.tva10 > 0 && (
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">TVA 10% - Transport de personnes</span>
                    <span className="text-gray-900">{formatPrice(pricing.tva10)}</span>
                  </div>
                )}
                {!isMicroBC && pricing.tva20 > 0 && (
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">TVA 20% - Suppléments</span>
                    <span className="text-gray-900">{formatPrice(pricing.tva20)}</span>
                  </div>
                )}
                {isMicroBC && (
                  <div className="flex justify-between mb-1">
                    <span className="text-amber-600 font-medium">{legalProfile.vatMention ?? "TVA non applicable, art. 293 B du CGI"}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm">
                  <span className="text-gray-900">{isMicroBC ? "TOTAL" : "TOTAL TTC"}</span>
                  <span className="text-amber-600">{formatPrice(isMicroBC ? pricing.totalHT : pricing.totalTTC)}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3 mt-3 text-[10px] text-gray-500 max-h-[120px] overflow-y-auto w-full whitespace-pre-wrap">
                <p className="font-bold text-gray-700 mb-1">CONDITIONS GÉNÉRALES</p>
                {generateCGVSummary(enterprise)}
              </div>

              <div className="border-t border-gray-200 pt-3 text-[8px] text-gray-400 text-center">
                <p>Document généré via NoX VTC</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="px-4 py-4 border-t border-onyx-border/30 bg-[#0d0d0d]">
        <button
          onClick={handleGenerate}
          disabled={isSubmitting}
          className={cn(
            "w-full py-3.5 rounded-full font-bold text-sm transition-all",
            isSubmitting
              ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              : "bg-gold text-black hover:bg-gold/90 active:scale-[0.98]"
          )}
        >
          {isSubmitting ? "Bon de réservation généré ✓" : "Générer le bon de réservation"}
        </button>
      </div>

      <QuickAddClientModal
        open={showQuickAddClient}
        onClose={() => setShowQuickAddClient(false)}
        clients={clients ?? []}
        onClientCreated={handleClientCreated}
      />

      <LimitAlertModal
        open={showStopsLimitAlert}
        onClose={() => setShowStopsLimitAlert(false)}
        resourceLabel="arrêts intermédiaires"
        customTitle="🔒 Fonctionnalité Pro & Premium"
        customMessage="🔒 Les arrêts intermédiaires sont disponibles à partir de l'offre Pro & Premium."
        onManageOffer={() => {
          setShowStopsLimitAlert(false)
          navigateToSubscription()
        }}
        onUpgradePro={() => {
          setShowStopsLimitAlert(false)
          setSubDrawerPlan("DUO")
          setShowSubDrawer(true)
        }}
        onUpgradePremium={() => {
          setShowStopsLimitAlert(false)
          setSubDrawerPlan("TEAM")
          setShowSubDrawer(true)
        }}
      />

      <SubscriptionDrawer
        open={showSubDrawer}
        targetPlan={subDrawerPlan}
        onClose={() => setShowSubDrawer(false)}
      />

      <DateTimePickerSheet
        open={showDateTimePicker}
        initialDate={tripDate}
        initialTime={modeHoraire === 'depart' ? tripTime : heureArriveesouhaitee}
        onClose={() => setShowDateTimePicker(false)}
        onConfirm={handlePickerConfirm}
      />

      <TokenCostModal
        open={showBCTokenModal}
        onClose={() => setShowBCTokenModal(false)}
        documentType="bc"
        documentNumber={brNumber}
        tokensRemaining={tokens}
      />
    </motion.div>
  )
}

export default CreateBCFlow

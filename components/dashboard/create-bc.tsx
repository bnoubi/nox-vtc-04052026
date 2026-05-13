"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"

import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, ChevronLeft, ChevronRight, ChevronDown, FileText, Link2, MessageSquare, Phone, Copy, Check,
  MapPin, Navigation, Car, Euro, Building2, User, Users, Search, Sparkles, Clock, Calendar,
  RotateCcw, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { useNox } from "./nox-context"
import {
  type Client, type Driver, type Vehicle, type TarifForfait, type TarifSupplement,
  type BCDocument, type EnterpriseProfile, type BCStatus,
} from "./data"
import { toast } from "sonner"

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

function generateBRNumber(): string {
  const now = new Date()
  return `BR-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0")}`
}

function formatDateFr(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

function formatTimeFr(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h")
}

function formatTimeFrFromString(time: string): string {
  return time?.replace(":", "h") ?? ""
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
}

export function CreateBCFlow({ open, onClose, prefillClient, prefillBC }: CreateBCFlowProps) {
  const { drivers, clients, vehicles, tariffSettings, enterprise, addBC, bcs, saveDraftBC, updateBC } = useNox()
  const [step, setStep] = useState<FlowStep>("menu")
  const [tab, setTab] = useState<FormTab>("formulaire")

  // BUG 1 — état de soumission pour éviter les doublons
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Link sharing
  const [linkRecipient, setLinkRecipient] = useState("")
  const [linkCopied, setLinkCopied] = useState(false)

  // BUG 2 — brNumber et creationDate en state pour permettre le reset
  const [brNumber, setBRNumber] = useState(() => generateBRNumber())
  const [creationDate, setCreationDate] = useState(() => new Date())

  // Selections — pré-remplissage depuis prefillBC si fourni (FEATURE 2 duplication)
  const [selectedDriverId, setSelectedDriverId] = useState<string>(() => {
    if (prefillBC?.driverName) {
      return drivers?.find(d => d.name === prefillBC.driverName)?.id ?? drivers?.[0]?.id ?? ""
    }
    return drivers?.[0]?.id ?? ""
  })
  const [selectedClientId, setSelectedClientId] = useState<string>(prefillBC?.clientId ?? "")
  const [clientSearch, setClientSearch] = useState("")
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => {
    if (prefillBC?.vehicleId) return prefillBC.vehicleId
    return vehicles?.find(v => v.inService)?.id ?? vehicles?.[0]?.id ?? ""
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

  // Client manuel (prefillClient ou pré-rempli depuis BC)
  const [manualClient, setManualClient] = useState<BCPrefillClient | null>(prefillClient || null)

  // Trajet
  const [departure, setDeparture] = useState(prefillBC?.trajet?.depart ?? "")
  const [arrival, setArrival] = useState(prefillBC?.trajet?.arrivee ?? "")
  const [tripDate, setTripDate] = useState(prefillBC?.trajet?.date ?? "")
  const [tripTime, setTripTime] = useState(prefillBC?.trajet?.time ?? "")
  const [passengers, setPassengers] = useState(prefillBC?.trajet?.passengers ?? 1)
  const [luggage, setLuggage] = useState(prefillBC?.trajet?.luggage ?? 0)
  const [instructions, setInstructions] = useState(prefillBC?.notes ?? "")

  // BUG 5 — calcul automatique distance
  const [durationDisplay, setDurationDisplay] = useState("")
  const [isAutoCalculating, setIsAutoCalculating] = useState(false)

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
          const durationSec = parseInt((route.duration ?? "0s").replace("s", ""), 10)
          if (km > 0) {
            setDistanceKm(km)
            setEditableBasePrice(null)
          }
          if (durationSec > 0) {
            setDurationDisplay(formatDuration(durationSec))
          }
        }
      } catch {
        // Gestion défensive — distance reste vide, pas de valeur trompeuse
      } finally {
        if (!cancelled) setIsAutoCalculating(false)
      }
    })()

    return () => { cancelled = true }
  }, [departure, arrival, tripDate, tripTime])

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
    setBRNumber(generateBRNumber())
    setCreationDate(new Date())
    setTab("formulaire")
    setStep("menu")
    setIsSubmitting(false)
    setLinkRecipient("")
    setSelectedDriverId(drivers?.[0]?.id ?? "")
    setSelectedClientId("")
    setClientSearch("")
    setSelectedVehicleId(vehicles?.find(v => v.inService)?.id ?? vehicles?.[0]?.id ?? "")
    setPassagerNom("")
    setPassagerTelephone("")
    setPassengerSearch("")
    setManualClient(null)
    setDeparture("")
    setArrival("")
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
    setDraftId(null)
    setCgvInclure(cgvConfigured)
    setClientFocused(false)
    setShowClientModal(false)
    setModalSearch("")
    setModalSelectedCompany(null)
  }, [drivers, vehicles, availableSupplements, cgvConfigured])

  const handleClose = () => { setStep("menu"); onClose() }

  const copyLink = () => {
    navigator.clipboard.writeText(`https://nox.vtc/book/${brNumber.toLowerCase()}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
    toast.success("Lien copié")
  }

  // ── BUG 1 — Génération avec protection anti-doublon ──────────────────────
  const handleGenerate = () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    const clientName = (selectedClient
      ? (selectedClient.type === "particulier"
          ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}`.trim()
          : selectedClient.raisonSociale ?? "")
      : (manualClient ? `${manualClient.prenom} ${manualClient.nom}`.trim() : "")) || "Client Inconnu"

    const clientPhone = selectedClient
      ? selectedClient.phone
      : (manualClient ? manualClient.tel : undefined)

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
      amount: pricing.totalTTC,
      amountHT: pricing.totalHT,
      tva: pricing.tva,
      baseHT: pricing.baseHT,
      supplementsHT: pricing.supplementsTotal,
      tva10Amount: pricing.tva10,
      tva20Amount: pricing.tva20,
      discountValue,
      discountType,
      originalHT: pricing.originalHT,
      originalTTC: pricing.originalTTC,
      supplementsList: supplements.filter(s => s.selected).map(s => s.label),
      date: new Date().toLocaleDateString("fr-FR"),
      status: "en_attente",
      type: "bc",
      trajet: {
        depart: departure || "Non renseigné",
        arrivee: arrival || "Non renseigné",
        distance: distanceKm ?? undefined,
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
    }

    // Si un brouillon existait, on l'annule avant de créer le BC définitif
    if (draftId) {
      updateBC(draftId, { status: "annule_client" })
    }

    addBC(newBC)
    setTab("apercu")
    toast.success("Bon de réservation généré et enregistré")
  }

  const toggleSupplement = (id: string) => {
    setSupplements(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s))
  }

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
                  onClick={() => setIgnoreDraft(true)}
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
            <button onClick={() => setStep("link")} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#242424] border border-onyx-border/30 hover:border-gold/30 transition-all active:scale-[0.98]">
              <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center"><Link2 className="h-5 w-5 text-gold" /></div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-sm text-foreground">Bon de réservation partagé</p>
                <p className="text-[11px] text-muted-foreground">Le client complète ses informations</p>
              </div>
            </button>
          </div>
        </motion.div>
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
              <div className="flex-1 text-sm text-gold font-mono truncate">nox.vtc/book/{brNumber.toLowerCase()}</div>
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
          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gold text-gold font-semibold text-sm hover:bg-gold/5 transition-colors">
              <Phone className="h-4 w-4" /> Par SMS
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors">
              <MessageSquare className="h-4 w-4" /> Par WhatsApp
            </button>
          </div>
        </div>
      </motion.div>
    )
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
            {prefillBC ? "Dupliquer le Bon de Réservation" : "Nouveau Bon de Réservation"}
          </h1>
          <p className="text-[10px] text-muted-foreground">{brNumber} • Établi le {formatDateFr(creationDate)} à {formatTimeFr(creationDate)}</p>
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
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Chauffeur assigné</label>
              <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }}>
                {(drivers ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
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

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Rechercher un client</label>
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
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
                  <p className="px-4 py-3 text-[11px] text-muted-foreground italic">
                    {(clients ?? []).length === 0
                      ? "Aucun client enregistré — vous pouvez saisir manuellement"
                      : "Aucun résultat"}
                  </p>
                ) : (
                  filteredClients.slice(0, 8).map(c => (
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
                    <input type="tel" value={passagerTelephone} onChange={e => setPassagerTelephone(e.target.value)}
                      placeholder="Téléphone du passager"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }} />
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* SECTION: Trajet */}
          <Section title="Trajet" icon={Navigation}>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Adresse de départ</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 focus-within:border-gold/50">
                <MapPin className="h-4 w-4 text-green-400 flex-shrink-0" strokeWidth={1.5} />
                <PlacesAutocomplete value={departure} onChange={setDeparture} placeholder="Rechercher une adresse..."
                  addressMode="full"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  style={{ fontSize: "16px" }} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Adresse d&apos;arrivée</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 focus-within:border-gold/50">
                <MapPin className="h-4 w-4 text-red-400 flex-shrink-0" strokeWidth={1.5} />
                <PlacesAutocomplete value={arrival} onChange={setArrival} placeholder="Rechercher une adresse..."
                  addressMode="full"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  style={{ fontSize: "16px" }} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Date du trajet</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 focus-within:border-gold/50">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                <input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground focus:outline-none" style={{ fontSize: "16px" }} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Heure de prise en charge</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 focus-within:border-gold/50">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                <input type="time" value={tripTime} onChange={e => setTripTime(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground focus:outline-none" style={{ fontSize: "16px" }} />
              </div>
            </div>

            {/* Distance & Durée — calculées après saisie adresses + date + heure */}
            {(!tripDate || !tripTime) && (departure.length >= 5 || arrival.length >= 5) && (
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
          <Section title="Véhicule" icon={Car}>
            <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }}>
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

          {/* SECTION: Tarification */}
          <Section title="Tarification" icon={Euro}>
            <div className="flex bg-secondary/30 border border-onyx-border/30 rounded-xl p-1 mt-3">
              <button
                className={cn("flex-1 text-xs py-2 rounded-lg font-medium transition-all text-center", pricingMode === "calcul" ? "bg-onyx-card shadow text-gold border border-gold/20" : "text-muted-foreground hover:text-foreground")}
                onClick={() => { setPricingMode("calcul"); setBaseTvaRate(10) }}
              >Calcul au km</button>
              <button
                className={cn("flex-1 text-xs py-2 rounded-lg font-medium transition-all text-center", pricingMode === "forfait" ? "bg-onyx-card shadow text-gold border border-gold/20" : "text-muted-foreground hover:text-foreground")}
                onClick={() => { setPricingMode("forfait"); setBaseTvaRate(20) }}
              >Forfait fixe</button>
            </div>

            {pricingMode === "forfait" && (
              <div className="mt-3 flex gap-2">
                <button
                  className={cn("flex-1 text-[10px] py-1.5 rounded border transition-colors", baseTvaRate === 10 ? "border-gold text-gold bg-gold/10" : "border-onyx-border/50 text-muted-foreground hover:bg-secondary/50")}
                  onClick={() => setBaseTvaRate(10)}
                >Transfert (TVA 10%)</button>
                <button
                  className={cn("flex-1 text-[10px] py-1.5 rounded border transition-colors", baseTvaRate === 20 ? "border-gold text-gold bg-gold/10" : "border-onyx-border/50 text-muted-foreground hover:bg-secondary/50")}
                  onClick={() => setBaseTvaRate(20)}
                >Mise à dispo (TVA 20%)</button>
              </div>
            )}

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

            {/* Pricing Summary */}
            <div className="p-4 rounded-xl bg-[#242424] border border-gold/20 space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground">Base HT</span>
                <span className="text-foreground">{formatPrice(pricing.baseHT)}</span>
              </div>
              {pricing.supplementsTotal > 0 && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-muted-foreground">Suppléments HT</span>
                  <span className="text-foreground">+{formatPrice(pricing.supplementsTotal)}</span>
                </div>
              )}
              {pricing.discountAmount > 0 && (
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-red-400">Remise commerciale</span>
                  <span className="text-red-400">-{formatPrice(pricing.discountAmount)}</span>
                </div>
              )}
              <div className="border-t border-onyx-border/30 pt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Total HT</span>
                <span className="text-foreground font-medium">{formatPrice(pricing.totalHT)}</span>
              </div>
              {pricing.tva10 > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA (10%)</span>
                  <span className="text-foreground font-medium">{formatPrice(pricing.tva10)}</span>
                </div>
              )}
              {pricing.tva20 > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA (20%)</span>
                  <span className="text-foreground font-medium">{formatPrice(pricing.tva20)}</span>
                </div>
              )}
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
              <div className="pt-2 border-t border-onyx-border/30">
                <p className="text-[9px] text-muted-foreground leading-relaxed">Détail : {pricing.fullDetail}</p>
              </div>
            </div>
          </Section>

          {/* SECTION: Conditions applicables */}
          <div className="border border-onyx-border/30 rounded-xl bg-[#1a1a1a] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-onyx-border/20">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gold" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-foreground">Conditions applicables</span>
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
              <p className={cn(
                "text-[11px] leading-relaxed whitespace-pre-wrap",
                cgvConfigured ? "text-foreground/80" : "text-muted-foreground italic"
              )}>
                {cgvConfigured ? cgvPreview : "Aucune condition générale de vente n'a été configurée. Rendez-vous dans Réglages → Mes conditions de vente."}
              </p>
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
                <div>
                  <p className="text-lg font-bold text-gray-900">{enterprise?.denomination ?? ""}</p>
                  <p className="text-[10px] text-gray-500">{enterprise?.adresse ?? ""}</p>
                  <p className="text-[10px] text-gray-500">SIREN : {enterprise?.siren ?? ""}</p>
                  <p className="text-[10px] text-gray-500">TVA : {enterprise?.tvaIntra ?? ""}</p>
                  <p className="text-[10px] text-amber-600 font-medium">EVTC : {enterprise?.evtcNumber ?? ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">BON DE RÉSERVATION</p>
                  <p className="text-[10px] text-gray-500">{brNumber}</p>
                  <p className="text-[10px] text-gray-500">Établi le {formatDateFr(creationDate)}</p>
                  <p className="text-[10px] text-gray-500">à {formatTimeFr(creationDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <p className="font-bold text-gray-700 mb-1">CHAUFFEUR</p>
                  <p className="text-gray-900">{selectedDriver?.name ?? "Non assigné"}</p>
                  <p className="text-amber-600">Carte VTC : {selectedDriver?.carteProNumber ?? "—"}</p>
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
                  <span className="text-gray-900">{tripDate ? new Date(tripDate).toLocaleDateString("fr-FR") : "—"} à {formatTimeFrFromString(tripTime) || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Distance :</span>
                  <span className="text-gray-900">{distanceKm} km{durationDisplay ? ` · ${durationDisplay}` : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Passagers / Bagages :</span>
                  <span className="text-gray-900">{passengers} / {luggage}</span>
                </div>
              </div>

              <div className="text-[10px]">
                <p className="font-bold text-gray-700 mb-1">VÉHICULE</p>
                <p className="text-gray-900">
                  {selectedVehicle
                    ? `${[selectedVehicle.marque, selectedVehicle.modele].filter(Boolean).join(' ')} • ${selectedVehicle.immatriculation}`
                    : "—"}
                </p>
              </div>

              <div className="border-t border-gray-200 pt-3 text-[10px]">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Total HT</span>
                  <span className="text-gray-900">{formatPrice(pricing.totalHT)}</span>
                </div>
                {pricing.tva10 > 0 && (
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">TVA (10%)</span>
                    <span className="text-gray-900">{formatPrice(pricing.tva10)}</span>
                  </div>
                )}
                {pricing.tva20 > 0 && (
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">TVA (20%)</span>
                    <span className="text-gray-900">{formatPrice(pricing.tva20)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm">
                  <span className="text-gray-900">TOTAL TTC</span>
                  <span className="text-amber-600">{formatPrice(pricing.totalTTC)}</span>
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
        {/* BUG 1 — Bouton désactivé après premier clic */}
        <button
          onClick={handleGenerate}
          disabled={isSubmitting}
          className={cn(
            "w-full py-3.5 rounded-full font-bold text-sm transition-all",
            isSubmitting
              ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
              : "bg-gold text-black hover:bg-gold/90 active:scale-[0.98]"
          )}
        >
          {isSubmitting ? "Bon de réservation généré ✓" : "Générer le bon de réservation"}
        </button>
      </div>
    </motion.div>
  )
}

export default CreateBCFlow

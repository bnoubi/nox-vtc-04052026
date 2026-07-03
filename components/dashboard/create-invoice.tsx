"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Receipt,
  PlusCircle,
  X,
  ChevronLeft,
  ArrowRight,
  Search,
  Check,
  FileText,
  StickyNote,
  FilePlus2,
  Car,
  MapPin,
  Plus,
  Users,
  Loader2,
  Calendar,
} from "lucide-react"
import { useNox } from "./nox-context"
import { type BCDocument, type InvoiceDocument, type Client, type Driver, type Vehicle } from "./data"
import { CreateBCFlow } from "./create-bc"
import { QuickAddClientModal } from "./quick-add-client-modal"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { DateTimePickerSheet } from "./date-time-picker-sheet"
import { TokenCostModal } from "./token-cost-modal"

// ── Types ─────────────────────────────────────────────────────

type InvoiceStep = "choose" | "fromBC" | "newBC" | "libre"

interface BCItem {
  id: string
  number: string
  client: string
  amount: number
  date: string
  trajet?: { depart: string; arrivee: string }
}

interface CreateInvoiceProps {
  open: boolean
  onClose: () => void
}

// Note: Mock data removed, now using bcs from useNox()

// ── Success Toast ─────────────────────────────────────────────

// ── Bottom Sheet: Choose method ───────────────────────────────

function ChooseInvoiceSheet({
  onFromBC,
  onNewBC,
  onLibre,
  onClose,
}: {
  onFromBC: () => void
  onNewBC: () => void
  onLibre: () => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
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
          <h2 className="text-base font-bold text-foreground">Facture libre</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Choisissez le type de facturation
          </p>
        </div>

        <div className="px-5 pb-6 space-y-2.5">
          {/* Option 1: Facturer un trajet existant */}
          <button
            onClick={onFromBC}
            className="flex items-center gap-3.5 w-full p-4 rounded-2xl bg-onyx-card border border-gold/20 hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98] transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0 group-hover:bg-gold/20 transition-colors">
              <Receipt className="h-5 w-5 text-gold" strokeWidth={1.5} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors">Facturer un trajet existant</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Convertir un Bon de Réservation terminé
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-gold/50 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
          </button>

          {/* Option 2: Facturer un nouveau trajet */}
          <button
            onClick={onNewBC}
            className="flex items-center gap-3.5 w-full p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/30 hover:bg-gold/5 active:scale-[0.98] transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-gold/8 border border-gold/20 flex items-center justify-center shrink-0 group-hover:bg-gold/15 transition-colors">
              <FilePlus2 className="h-5 w-5 text-gold/80 group-hover:text-gold transition-colors" strokeWidth={1.5} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors">Facturer un nouveau trajet</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Créer un Bon de Réservation puis facturer
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-gold/50 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
          </button>

          {/* Option 3: Facture libre */}
          <button
            onClick={onLibre}
            className="flex items-center gap-3.5 w-full p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/30 hover:bg-gold/5 active:scale-[0.98] transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-secondary/60 border border-onyx-border/40 flex items-center justify-center shrink-0 group-hover:bg-gold/10 group-hover:border-gold/20 transition-colors">
              <PlusCircle className="h-5 w-5 text-muted-foreground group-hover:text-gold transition-colors" strokeWidth={1.5} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors">Facture libre</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Trajet réalisé ou prestation libre
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-gold/50 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── From BC: List unbilled BCs ────────────────────────────────

function FromBCScreen({
  onBack,
  onClose,
  onSuccess,
}: {
  onBack: () => void
  onClose: () => void
  onSuccess: () => void
}) {
  const { bcs, invoices, addInvoice } = useNox()
  const [search, setSearch] = useState("")
  const [converting, setConverting] = useState<string | null>(null)

  // Only show BCs that are signed and NOT yet in any invoice
  const unbilledBCs = bcs.filter(bc =>
    (bc.status === "confirme" || bc.status === "termine") && !invoices.some(inv => inv.bcRef === bc.number)
  )

  const filtered = unbilledBCs.filter(
    (bc: BCDocument) =>
      bc.client.toLowerCase().includes(search.toLowerCase()) ||
      bc.number.toLowerCase().includes(search.toLowerCase()),
  )

  function handleConvert(bc: BCDocument) {
    setConverting(bc.id)

    const invoiceDate = new Date()
    const echeance = new Date(invoiceDate)
    echeance.setDate(echeance.getDate() + 30)

    const newInvoice: InvoiceDocument = {
      id: "",
      number: "",

      // Identification
      bcId:              bc.id,
      bcRef:             bc.number,
      date:              invoiceDate.toISOString().split("T")[0],
      echeance:          echeance.toISOString().split("T")[0],
      type:              "facture",
      status:            "brouillon",

      // Client
      clientId:          bc.clientId,
      client:            bc.client,
      clientPhone:       bc.clientPhone,
      passagerNom:       bc.passagerNom,
      passagerTelephone: bc.passagerTelephone,

      // Trajet — copie JSONB entier
      trajet:            bc.trajet,

      // Chauffeur
      driverId:          bc.driverId,
      driverName:        bc.driverName,
      driverCarteVTC:    bc.driverCarteVTC,

      // Véhicule
      vehicleId:         bc.vehicleId,
      vehicleName:       bc.vehicleName,
      vehiclePlate:      bc.vehiclePlate,

      // Montants — copie stricte, aucun recalcul
      amount:            bc.amount,
      amountHT:          bc.amountHT,
      tva:               bc.tva,
      tvaRate:           bc.tvaRate,
      baseHT:            bc.baseHT,
      supplementsHT:     bc.supplementsHT,
      tva10Amount:       bc.tva10Amount,
      tva20Amount:       bc.tva20Amount,
      tva55Amount:       bc.tva55Amount,
      tvaOtherAmount:    bc.tvaOtherAmount,
      discountValue:     bc.discountValue,
      discountType:      bc.discountType,
      originalHT:        bc.originalHT,
      originalTTC:       bc.originalTTC,

      // Suppléments détaillés
      supplementsList:   bc.supplementsList,

      // Divers
      notes:             bc.notes,
      cgvText:           bc.cgvText,
    }

    setTimeout(async () => {
      const success = await addInvoice(newInvoice, false)
      setConverting(null)
      if (success) {
        onSuccess()
      }
    }, 400)
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
          <h1 className="text-base font-bold text-foreground">Facturer un trajet</h1>
          <p className="text-[10px] text-muted-foreground">
            Bons de Réservation non facturés
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
        >
          <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Rechercher un BC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/40 transition-colors"
          />
        </div>
      </div>

      {/* BC List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-20">
        {filtered.map((bc) => (
            <div
              key={bc.id}
              className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50"
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[11px] font-mono text-muted-foreground">{bc.number}</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{bc.client}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{bc.date}</span>
              </div>

              {/* Trajet */}
              {bc.trajet && (
                <div className="flex items-center gap-2 mb-3 text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[120px]">{bc.trajet.depart}</span>
                  <ArrowRight className="h-3 w-3 text-gold shrink-0" strokeWidth={1.5} />
                  <span className="truncate max-w-[120px]">{bc.trajet.arrivee}</span>
                </div>
              )}

              {/* Amount (copie directe depuis BC) */}
              <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-background border border-onyx-border/30">
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  {bc.amountHT != null && bc.amountHT > 0 && (
                    <div>HT : {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.amountHT)} &euro;</div>
                  )}
                  {bc.tva != null && bc.tva > 0 && (
                    <div>TVA : {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.tva)} &euro;</div>
                  )}
                </div>
                <span className="text-lg font-bold text-gold tabular-nums">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.amount)} &euro;
                </span>
              </div>

              {/* Convert button */}
              <button
                onClick={() => handleConvert(bc)}
                disabled={converting === bc.id}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]",
                  converting === bc.id
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                    : "bg-gold text-primary-foreground hover:bg-gold-light gold-glow-sm",
                )}
              >
                {converting === bc.id ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    Génération...
                  </>
                ) : (
                  <>
                    <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Convertir en Facture
                  </>
                )}
              </button>
            </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Aucun BR en attente</p>
            <p className="text-[11px] text-muted-foreground">
              Tous les Bons de Réservation ont été facturés
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Helpers ───────────────────────────────────────────────────

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

function formatDuration(seconds: number): string {
  if (seconds <= 0) return ""
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

function formatDateFr(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr + "T12:00:00")
  const w = d.toLocaleDateString("fr-FR", { weekday: "short" })
  const weekday = w.charAt(0).toUpperCase() + w.slice(1)
  const month = d.toLocaleDateString("fr-FR", { month: "long" })
  return `${weekday} ${d.getDate()} ${month}`
}

// ── Facture Libre: Free-form invoice ──────────────────────────

type InvoiceMode = "trajet" | "libre"

function FactureLibreForm({
  onBack,
  onClose,
  onSuccess,
}: {
  onBack: () => void
  onClose: () => void
  onSuccess: () => void
}) {
  const { clients, invoices, enterprise, drivers, vehicles, addInvoice, tariffSettings, legalProfile, plan, tokens } = useNox()
  const supabase = createClient()
  const clientRef = useRef<HTMLDivElement>(null)
  const [isMicroInvoice, setIsMicroInvoice] = useState<boolean>(enterprise?.vatMode === "franchise")
  const autoTvaRate = 10

  useEffect(() => {
    setIsMicroInvoice(enterprise?.vatMode === "franchise")
  }, [enterprise?.vatMode])

  // ── Mode toggle ────────────────────────────────────────────
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>("trajet")

  // ── Client search (pattern BC) ─────────────────────────────
  const [clientSearch, setClientSearch] = useState("")
  const [clientFocused, setClientFocused] = useState(false)
  const [clientId, setClientId] = useState("")
  const [showQuickAddClient, setShowQuickAddClient] = useState(false)
  const [showClientModal, setShowClientModal] = useState(false)
  const [modalSearch, setModalSearch] = useState("")

  // ── Other common fields ────────────────────────────────────
  const [objet, setObjet] = useState("")

  // ── Trajet mode fields ─────────────────────────────────────
  const [trajetDepart, setTrajetDepart] = useState("")
  const [trajetArrivee, setTrajetArrivee] = useState("")
  const [trajetDate, setTrajetDate] = useState("")
  const [trajetTime, setTrajetTime] = useState("")
  const [trajetDistance, setTrajetDistance] = useState("")
  const [trajetPassagers, setTrajetPassagers] = useState(1)
  const [trajetBagages, setTrajetBagages] = useState(0)
  const [selectedDriverId, setSelectedDriverId] = useState("")
  const [selectedVehicleId, setSelectedVehicleId] = useState("")
  const [trajetPrixHT, setTrajetPrixHT] = useState("")
  const [trajetDuree, setTrajetDuree] = useState("")
  const [isAutoCalculating, setIsAutoCalculating] = useState(false)

  // ── Common fields ──────────────────────────────────────────
  const [serviceDate, setServiceDate] = useState("")
  const [serviceDateError, setServiceDateError] = useState("")
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({})

  // ── Date pickers ──────────────────────────────────────────
  const [showDateTimePicker, setShowDateTimePicker] = useState(false)
  const [showServiceDatePicker, setShowServiceDatePicker] = useState(false)

  // ── Token modal ────────────────────────────────────────────
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState("")

  // ── Libre mode fields ──────────────────────────────────────
  const [items, setItems] = useState([{ id: `item-${Date.now()}`, designation: "", amountHT: "", tvaRate: autoTvaRate }])
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent")

  // ── Computed ───────────────────────────────────────────────
  const filteredClients = useMemo(() => {
    const s = clientSearch.trim().toLowerCase()
    if (!s) return clients ?? []
    return (clients ?? []).filter((c: Client) => {
      const name = c.type === "particulier"
        ? `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase()
        : (c.raisonSociale ?? "").toLowerCase()
      return name.includes(s) || (c.phone ?? "").includes(s)
    })
  }, [clientSearch, clients])

  const modalFilteredClients = useMemo(() => {
    const s = modalSearch.trim().toLowerCase()
    if (!s) return clients ?? []
    return (clients ?? []).filter((c: Client) => {
      const name = c.type === "particulier"
        ? `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase()
        : (c.raisonSociale ?? "").toLowerCase()
      return name.includes(s) || (c.phone ?? "").includes(s)
    })
  }, [modalSearch, clients])

  const selectedClient = (clients ?? []).find((c: Client) => c.id === clientId)
  const clientDisplayName = selectedClient
    ? (selectedClient.type === "particulier"
        ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}`.trim()
        : (selectedClient.raisonSociale ?? ""))
    : ""

  const activeDrivers = drivers.filter((d: Driver) => d.id)
  const activeVehicles = vehicles.filter((v: Vehicle) => v.inService)

  // ── Item helpers ───────────────────────────────────────────
  const addItem = () => setItems([...items, { id: `item-${Date.now()}`, designation: "", amountHT: "", tvaRate: autoTvaRate }])
  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id))
  const updateItem = (id: string, field: string, value: any) =>
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i))

  // ── Libre calculations ─────────────────────────────────────
  const subtotalHT = items.reduce((sum, item) => sum + (parseFloat(item.amountHT as string) || 0), 0)
  let discountAmount = 0
  if (discountValue > 0)
    discountAmount = discountType === "percent" ? subtotalHT * (discountValue / 100) : discountValue
  const discountRatio = subtotalHT > 0 ? discountAmount / subtotalHT : 0

  let tva10Base = 0, tva20Base = 0, tva55Base = 0
  items.forEach(item => {
    const ht = (parseFloat(item.amountHT as string) || 0) * (1 - discountRatio)
    if (item.tvaRate === 10) tva10Base += ht
    else if (item.tvaRate === 20) tva20Base += ht
    else if (item.tvaRate === 5.5) tva55Base += ht
  })
  const totalHT = tva10Base + tva20Base + tva55Base
  const tva10 = tva10Base * 0.10
  const tva20 = tva20Base * 0.20
  const tva55 = tva55Base * 0.055
  const tvaTotal = isMicroInvoice ? 0 : (tva10 + tva20 + tva55)
  const totalTTC = totalHT + tvaTotal
  const originalTTC = items.reduce((sum, item) => {
    const rate = isMicroInvoice ? 0 : item.tvaRate
    return sum + ((parseFloat(item.amountHT as string) || 0) * (1 + rate / 100))
  }, 0)

  // ── Trajet calculations ────────────────────────────────────
  const trajetHT = parseFloat(trajetPrixHT) || 0
  const trajetTva = isMicroInvoice ? 0 : trajetHT * (autoTvaRate / 100)
  const trajetTTC = trajetHT + trajetTva

  function handleServiceDateChange(v: string) {
    setServiceDate(v)
    if (v) {
      const chosen = new Date(v)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      if (chosen > today) {
        setServiceDateError("La date ne peut pas être dans le futur")
      } else {
        setServiceDateError("")
      }
    } else {
      setServiceDateError("")
    }
  }

  // ── Calcul automatique distance + tarif ───────────────────
  useEffect(() => {
    if (!trajetDepart || !trajetArrivee || trajetDepart.length < 5 || trajetArrivee.length < 5) return

    let cancelled = false
    setIsAutoCalculating(true)
    setTrajetDistance("")
    setTrajetDuree("")

    ;(async () => {
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
            origin: { address: trajetDepart },
            destination: { address: trajetArrivee },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
          }),
        })

        if (!res.ok) throw new Error()
        const data = await res.json()

        if (!cancelled && data.routes?.[0]) {
          const route = data.routes[0]
          const km = Math.round((route.distanceMeters ?? 0) / 100) / 10
          const rawSec = parseInt((route.duration ?? "0s").replace("s", ""), 10)
          if (km > 0) {
            setTrajetDistance(String(km))
            const tarif = detectTarif(trajetTime, trajetDate)
            const { base } = tariffSettings
            const rawBase = base.priseEnCharge + (km * base.prixKm * tarif.coef)
            const price = Math.max(rawBase, base.courseMinimum)
            setTrajetPrixHT(String(Math.round(price * 100) / 100))
          }
          if (rawSec > 0) {
            setTrajetDuree(formatDuration(rawSec))
          }
        }
      } catch {
        // Fallback gracieux — les champs restent vides
      } finally {
        if (!cancelled) setIsAutoCalculating(false)
      }
    })()

    return () => { cancelled = true }
  }, [trajetDepart, trajetArrivee]) // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  const fmtDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`

  // ── Submit ─────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (plan === "SOLO" && tokens <= 0) {
      toast.error("Jetons insuffisants. Rechargez votre compte.")
      return
    }

    const clientName = clientDisplayName || "Inconnu"

    if (invoiceMode === "trajet") {
      const errors: Record<string, boolean> = {}
      if (!clientId) errors.client = true
      if (!trajetDepart) errors.depart = true
      if (!trajetArrivee) errors.arrivee = true
      if (!trajetPrixHT || trajetHT <= 0) errors.prixHT = true
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors)
        toast.error("Veuillez remplir tous les champs obligatoires")
        return
      }
    }

    if (invoiceMode === "libre") {
      const errors: Record<string, boolean> = {}
      if (!clientId) errors.client = true
      const itemErrors = items.map(i => !i.designation || !i.amountHT)
      if (itemErrors.some(Boolean)) errors.items = true
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors)
        toast.error("Veuillez remplir tous les champs obligatoires")
        return
      }
    }

    setFormErrors({})

    if (invoiceMode === "libre" && serviceDateError) { toast.error(serviceDateError); return }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      toast.error("Session expirée, veuillez vous reconnecter")
      return
    }

    const { data: invoiceNumberData, error: rpcError } = await supabase.rpc("generate_fac_numero", { p_user_id: user.id })
    if (rpcError || !invoiceNumberData) {
      toast.error("Impossible de générer le numéro de facture, veuillez réessayer")
      return
    }
    const invoiceNumber = invoiceNumberData as string

    const today = new Date()
    const echeance = new Date(today)
    echeance.setDate(echeance.getDate() + 30)

    let newInvoice: InvoiceDocument

    if (invoiceMode === "trajet") {
      const driver = activeDrivers.find((d: Driver) => d.id === selectedDriverId)
      const vehicle = activeVehicles.find((v: Vehicle) => v.id === selectedVehicleId)
      newInvoice = {
        id: `fac-trajet-${Date.now()}`,
        number: invoiceNumber,
        client: clientName,
        clientId: clientId || undefined,
        amount: Math.round(trajetTTC * 100) / 100,
        amountHT: Math.round(trajetHT * 100) / 100,
        tva: Math.round(trajetTva * 100) / 100,
        tvaMode: isMicroInvoice ? "franchise" : "10%",
        tvaRate: isMicroInvoice ? 0 : autoTvaRate,
        tva10Amount: (!isMicroInvoice && autoTvaRate === 10) ? Math.round(trajetTva * 100) / 100 : undefined,
        date: fmtDate(today),
        echeance: fmtDate(echeance),
        status: "brouillon",
        type: "facture",
        bcRef: objet || "Trajet réalisé",
        driverId: driver?.id,
        driverName: driver?.name,
        trajet: {
          depart: trajetDepart,
          arrivee: trajetArrivee,
          date: trajetDate || undefined,
          time: trajetTime || undefined,
          distance: trajetDistance ? parseFloat(trajetDistance) : undefined,
          passengers: trajetPassagers,
          luggage: trajetBagages,
        },
        vehicleId: vehicle?.id,
        vehicleName: vehicle ? `${vehicle.marque ?? ""} ${vehicle.modele}`.trim() : undefined,
        vehiclePlate: vehicle?.immatriculation,
        items: [{
          id: `item-trajet-${Date.now()}`,
          designation: "Transport de personnes",
          amountHT: Math.round(trajetHT * 100) / 100,
          tvaRate: isMicroInvoice ? 0 : autoTvaRate,
        }],
      }
    } else {
      const formattedItems = items.map(i => ({
        id: i.id,
        designation: i.designation,
        amountHT: parseFloat(i.amountHT as string) || 0,
        tvaRate: isMicroInvoice ? 0 : i.tvaRate,
      }))
      newInvoice = {
        id: `fac-libre-${Date.now()}`,
        number: invoiceNumber,
        client: clientName,
        clientId: clientId || undefined,
        amount: Math.round(totalTTC * 100) / 100,
        amountHT: Math.round(totalHT * 100) / 100,
        tva: Math.round(tvaTotal * 100) / 100,
        date: fmtDate(today),
        echeance: fmtDate(echeance),
        status: "brouillon",
        type: "facture",
        bcRef: objet || "Facture Libre",
        items: formattedItems,
        discountValue: discountValue > 0 ? discountValue : undefined,
        discountType: discountValue > 0 ? discountType : undefined,
        originalHT: subtotalHT,
        originalTTC,
        tva10Amount: (!isMicroInvoice && tva10 > 0) ? tva10 : undefined,
        tva20Amount: (!isMicroInvoice && tva20 > 0) ? tva20 : undefined,
        tva55Amount: (!isMicroInvoice && tva55 > 0) ? tva55 : undefined,
        serviceDate: serviceDate || undefined,
      }
    }

    const success = await addInvoice(newInvoice, true)
    if (success) {
      if (plan === "SOLO") {
        setLastInvoiceNumber(invoiceNumber)
        setShowTokenModal(true)
      } else {
        onSuccess()
      }
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"

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
        <button onClick={onBack} className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors">
          <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Facture libre</h1>
          <p className="text-[10px] text-muted-foreground">Trajet réalisé ou prestation libre</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors">
          <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-5 space-y-6 pb-32">

        {/* Client — commun aux deux modes ─────────────────── */}
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowQuickAddClient(true)}
            className="flex items-center gap-1.5 text-[11px] text-gold hover:text-gold-light transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Nouveau client
          </button>

          <div ref={clientRef} className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Client <span className="text-red-500">*</span>
            </label>
            <div className={cn("flex gap-2 rounded-xl", formErrors.client && "ring-1 ring-red-500")}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setClientId(""); if (formErrors.client) setFormErrors(prev => ({ ...prev, client: false })) }}
                  onFocus={() => setClientFocused(true)}
                  onBlur={() => setTimeout(() => setClientFocused(false), 200)}
                  placeholder="Nom, société, téléphone..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                  style={{ fontSize: "16px" }}
                />
              </div>
              <button
                type="button"
                onClick={() => { setShowClientModal(true); setModalSearch("") }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-[11px] text-muted-foreground hover:border-gold/30 hover:text-gold transition-colors whitespace-nowrap"
              >
                <Users className="h-3.5 w-3.5" />
                Voir tous
              </button>
            </div>
          </div>

          {(clientFocused || clientSearch.trim()) && !clientId && (
            <div className="max-h-[200px] overflow-y-auto rounded-xl bg-[#242424] border border-onyx-border/30 divide-y divide-onyx-border/20">
              {filteredClients.length === 0 ? (
                <p className="px-4 py-3 text-[11px] text-muted-foreground italic">
                  {(clients ?? []).length === 0 ? "Aucun client enregistré" : "Aucun résultat"}
                </p>
              ) : filteredClients.slice(0, 8).map((c: Client) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setClientId(c.id); setClientSearch(""); setClientFocused(false) }}
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
                    <p className="text-[10px] text-muted-foreground truncate">{c.phone ?? ""}</p>
                  </div>
                  <Check className="h-3.5 w-3.5 text-gold opacity-0" strokeWidth={2} />
                </button>
              ))}
            </div>
          )}

          {selectedClient && (
            <div className="p-3 rounded-xl bg-[#242424] border border-gold/20 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{clientDisplayName}</p>
                <button
                  type="button"
                  onClick={() => { setClientId(""); setClientSearch("") }}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Modifier
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">{selectedClient.phone ?? ""}</p>
            </div>
          )}
        </section>

        {/* Mode Toggle */}
        <div className="flex gap-2 p-1 rounded-2xl bg-onyx-card border border-onyx-border/50">
          {([
            { id: "trajet" as InvoiceMode, icon: <Car className="h-3.5 w-3.5" />, label: "Trajet réalisé" },
            { id: "libre" as InvoiceMode, icon: <Receipt className="h-3.5 w-3.5" />, label: "Prestation libre" },
          ] as const).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setInvoiceMode(m.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all",
                invoiceMode === m.id
                  ? "bg-gold text-black shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* ── TRAJET MODE ──────────────────────────────────────── */}
        {invoiceMode === "trajet" && (
          <>
            {/* Adresses */}
            <section className="space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
                Trajet
              </p>

              {/* Départ */}
              <div className={cn("relative", formErrors.depart && "ring-1 ring-red-500 rounded-xl")}>
                <PlacesAutocomplete
                  value={trajetDepart}
                  onChange={v => { setTrajetDepart(v); if (v && formErrors.depart) setFormErrors(prev => ({ ...prev, depart: false })); if (!v) { setTrajetArrivee(""); setTrajetDistance(""); setTrajetPrixHT(""); setTrajetDuree("") } }}
                  placeholder="Adresse de départ"
                  addressMode="full"
                  className={cn(inputCls, "pr-10")}
                />
                {trajetDepart && (
                  <button
                    type="button"
                    onClick={() => { setTrajetDepart(""); setTrajetDistance(""); setTrajetPrixHT(""); setTrajetDuree("") }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-onyx-border/50 flex items-center justify-center hover:bg-onyx-border transition-colors"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Arrivée */}
              <div className={cn("relative", formErrors.arrivee && "ring-1 ring-red-500 rounded-xl")}>
                <PlacesAutocomplete
                  value={trajetArrivee}
                  onChange={v => { setTrajetArrivee(v); if (v && formErrors.arrivee) setFormErrors(prev => ({ ...prev, arrivee: false })); if (!v) { setTrajetDistance(""); setTrajetPrixHT(""); setTrajetDuree("") } }}
                  placeholder="Adresse d'arrivée"
                  addressMode="full"
                  className={cn(inputCls, "pr-10")}
                />
                {trajetArrivee && (
                  <button
                    type="button"
                    onClick={() => { setTrajetArrivee(""); setTrajetDistance(""); setTrajetPrixHT(""); setTrajetDuree("") }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-onyx-border/50 flex items-center justify-center hover:bg-onyx-border transition-colors"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Distance + Durée estimées */}
              <div className="flex gap-2">
                <div className="flex-1 rounded-xl bg-[#1c1c1c] border border-onyx-border/20 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Distance estimée</p>
                  {isAutoCalculating ? (
                    <span className="flex items-center gap-1.5 text-sm text-gold/60">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />…
                    </span>
                  ) : trajetDistance ? (
                    <p className="text-sm font-medium text-foreground">{trajetDistance} km</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/40">—</p>
                  )}
                </div>
                <div className="flex-1 rounded-xl bg-[#1c1c1c] border border-onyx-border/20 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Durée estimée</p>
                  {isAutoCalculating ? (
                    <span className="flex items-center gap-1.5 text-sm text-gold/60">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />…
                    </span>
                  ) : trajetDuree ? (
                    <p className="text-sm font-medium text-foreground">{trajetDuree}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/40">—</p>
                  )}
                </div>
              </div>

              {/* Date + Heure */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Date et heure
                </label>
                <button
                  type="button"
                  onClick={() => setShowDateTimePicker(true)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 hover:border-gold/50 transition-colors text-left"
                >
                  <Calendar className="h-4 w-4 text-gold/70 flex-shrink-0" strokeWidth={1.5} />
                  <span className={cn("flex-1 text-sm", trajetDate ? "text-foreground" : "text-muted-foreground/50")}>
                    {trajetDate ? (() => {
                      const today = new Date(); today.setHours(0, 0, 0, 0)
                      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
                      const d = new Date(trajetDate + "T00:00:00")
                      const t = trajetTime ? " · " + trajetTime : ""
                      if (d.getTime() === today.getTime()) return "Aujourd'hui" + t
                      if (d.getTime() === yesterday.getTime()) return "Hier" + t
                      return new Date(trajetDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + t
                    })() : "Choisir la date et l'heure"}
                  </span>
                  {trajetDate && <span className="text-[11px] text-gold font-medium">Modifier</span>}
                </button>
              </div>

              {/* Passagers / Bagages — steppers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Passagers</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setTrajetPassagers(p => Math.max(1, p - 1))}
                      className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5 text-lg font-medium">−</button>
                    <span className="flex-1 text-center text-sm font-semibold text-foreground">{trajetPassagers}</span>
                    <button type="button" onClick={() => setTrajetPassagers(p => Math.min(9, p + 1))}
                      className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5 text-lg font-medium">+</button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bagages</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setTrajetBagages(b => Math.max(0, b - 1))}
                      className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5 text-lg font-medium">−</button>
                    <span className="flex-1 text-center text-sm font-semibold text-foreground">{trajetBagages}</span>
                    <button type="button" onClick={() => setTrajetBagages(b => Math.min(9, b + 1))}
                      className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5 text-lg font-medium">+</button>
                  </div>
                </div>
              </div>
            </section>

            {/* Chauffeur / Véhicule */}
            {(activeDrivers.length > 0 || activeVehicles.length > 0) && (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Chauffeur & Véhicule <span className="font-normal normal-case">(optionnel)</span>
                </p>
                {activeDrivers.length > 0 && (
                  <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors">
                    <option value="">— Chauffeur —</option>
                    {activeDrivers.map((d: Driver) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
                {activeVehicles.length > 0 && (
                  <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors">
                    <option value="">— Véhicule —</option>
                    {activeVehicles.map((v: Vehicle) => (
                      <option key={v.id} value={v.id}>{v.marque} {v.modele} • {v.immatriculation}</option>
                    ))}
                  </select>
                )}
              </section>
            )}

            {/* Tarif */}
            <section className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
                Tarif
              </p>
              <div className="relative">
                <input type="number" placeholder="0.00" min="0" step="0.01" value={trajetPrixHT}
                  onChange={e => { setTrajetPrixHT(e.target.value); if (e.target.value && formErrors.prixHT) setFormErrors(prev => ({ ...prev, prixHT: false })) }}
                  className={cn("w-full px-4 py-3 pr-16 rounded-xl bg-onyx-card border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40", formErrors.prixHT ? "border-red-500/60" : "border-onyx-border/50")} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">EUR HT</span>
              </div>
              {trajetHT > 0 && (
                <div className="p-4 rounded-xl bg-[#242424] border border-gold/20 space-y-2">
                  {!isMicroInvoice && (
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-muted-foreground">Total HT</span>
                      <span className="text-foreground">{fmt(trajetHT)}</span>
                    </div>
                  )}
                  {!isMicroInvoice && trajetTva > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TVA (10%)</span>
                      <span className="text-foreground font-medium">{fmt(trajetTva)} €</span>
                    </div>
                  )}
                  {isMicroInvoice && (
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-600 font-medium text-[11px]">
                        {legalProfile.vatMention ?? "TVA non applicable, art. 293 B du CGI"}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-onyx-border/30 pt-2 flex justify-between items-end">
                    <span className="text-foreground font-bold">
                      {isMicroInvoice ? "Total" : "Total TTC"}
                    </span>
                    <span className="text-gold font-bold text-lg">
                      {fmt(isMicroInvoice ? trajetHT : trajetTTC)} €
                    </span>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── LIBRE MODE ───────────────────────────────────────── */}
        {invoiceMode === "libre" && (
          <>
            {/* Date de prestation */}
            <section className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Date de prestation{" "}
                <span className="text-muted-foreground/50 normal-case font-normal">(optionnel)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowServiceDatePicker(true)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 hover:border-gold/50 transition-colors text-left"
              >
                <Calendar className="h-4 w-4 text-gold/70 flex-shrink-0" strokeWidth={1.5} />
                <span className={cn("flex-1 text-sm", serviceDate ? "text-foreground" : "text-muted-foreground/50")}>
                  {serviceDate ? (() => {
                    const today = new Date(); today.setHours(0, 0, 0, 0)
                    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
                    const d = new Date(serviceDate + "T00:00:00")
                    if (d.getTime() === today.getTime()) return "Aujourd'hui"
                    if (d.getTime() === yesterday.getTime()) return "Hier"
                    return new Date(serviceDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
                  })() : "Choisir une date"}
                </span>
                {serviceDate && (
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setServiceDate(""); setServiceDateError("") }}
                    className="w-5 h-5 rounded-full bg-onyx-border/50 flex items-center justify-center flex-shrink-0">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </button>
              {serviceDateError && (
                <p className="text-[10px] text-red-400 leading-tight">{serviceDateError}</p>
              )}
            </section>

            {/* Lignes */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Détail des Prestations
                </p>
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className={cn("p-3 bg-[#242424] border rounded-xl relative group", formErrors.items && (!item.designation || !item.amountHT) ? "border-red-500/60" : "border-onyx-border/30")}>
                    <input type="text" placeholder="Désignation (ex: Supplément attente, etc.)"
                      value={item.designation}
                      onChange={e => { updateItem(item.id, "designation", e.target.value); if (formErrors.items) setFormErrors(prev => ({ ...prev, items: false })) }}
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none mb-3" />
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input type="number" placeholder="0.00" min="0" step="0.01"
                          value={item.amountHT}
                          onChange={e => updateItem(item.id, "amountHT", e.target.value)}
                          className="w-full px-3 py-2 pr-10 rounded-lg bg-black text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border focus:border-gold border border-onyx-border/50" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">EUR HT</span>
                      </div>
                      {!isMicroInvoice && (
                        <select value={item.tvaRate}
                          onChange={e => updateItem(item.id, "tvaRate", Number(e.target.value))}
                          className="px-3 py-2 rounded-lg bg-black text-sm text-foreground border border-onyx-border/50 focus:outline-none focus:border-gold">
                          <option value={20}>20% (Standard)</option>
                          <option value={10}>10% (Transport)</option>
                          <option value={5.5}>5.5% (Autre)</option>
                        </select>
                      )}
                    </div>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(item.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem}
                className="mt-3 w-full py-2 rounded-xl text-xs font-semibold text-muted-foreground border border-dashed border-onyx-border hover:text-foreground hover:border-onyx-border/80 transition-all flex items-center justify-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Ajouter une ligne
              </button>
            </section>

            {/* Remise */}
            <section className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Remise commerciale</label>
              <div className="flex gap-2">
                <input type="number" inputMode="decimal" value={discountValue || ""} placeholder="0"
                  onChange={e => setDiscountValue(Number(e.target.value) || 0)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
                <div className="flex">
                  <button type="button" onClick={() => setDiscountType("percent")}
                    className={cn("px-3 py-2 rounded-l-xl text-xs font-semibold", discountType === "percent" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground border border-onyx-border/30")}>%</button>
                  <button type="button" onClick={() => setDiscountType("amount")}
                    className={cn("px-3 py-2 rounded-r-xl text-xs font-semibold", discountType === "amount" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground border border-onyx-border/30")}>€</button>
                </div>
              </div>
            </section>

            {/* Aperçu total */}
            {subtotalHT > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="p-4 rounded-2xl bg-onyx-card border border-gold/20 space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2.5">Total Aperçu</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Base HT</span>
                  <span className="text-foreground">{fmt(subtotalHT)} &euro;</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-red-400">Remise</span>
                    <span className="text-red-400">-{fmt(discountAmount)} &euro;</span>
                  </div>
                )}
                <div className="h-px bg-onyx-border/30 my-1" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total HT</span>
                  <span className="text-foreground font-medium">{fmt(totalHT)} &euro;</span>
                </div>
                {!isMicroInvoice && tva10 > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">TVA (10%)</span>
                    <span className="text-foreground">{fmt(tva10)} &euro;</span>
                  </div>
                )}
                {!isMicroInvoice && tva20 > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">TVA (20%)</span>
                    <span className="text-foreground">{fmt(tva20)} &euro;</span>
                  </div>
                )}
                {!isMicroInvoice && tva55 > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">TVA (5,5%)</span>
                    <span className="text-foreground">{fmt(tva55)} &euro;</span>
                  </div>
                )}
                <div className="h-px bg-onyx-border/30 my-1" />
                {isMicroInvoice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-600 font-medium text-[11px]">
                      {legalProfile.vatMention ?? "TVA non applicable, art. 293 B du CGI"}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">
                    {isMicroInvoice ? "Total" : "Total TTC"}
                  </span>
                  {discountAmount > 0 ? (
                    <div className="text-right">
                      <span className="text-muted-foreground line-through text-xs mr-2">
                        {fmt(isMicroInvoice ? subtotalHT : originalTTC)} &euro;
                      </span>
                      <span className="text-lg font-bold text-gold">
                        {fmt(isMicroInvoice ? totalHT : totalTTC)} &euro;
                      </span>
                    </div>
                  ) : (
                    <span className="text-lg font-bold text-gold">
                      {fmt(isMicroInvoice ? totalHT : totalTTC)} &euro;
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* ── ZONE COMMUNE ─────────────────────────────────────── */}
        <section className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" strokeWidth={1.5} />
            Référence et notes
          </p>

          {/* Checkbox TVA franchise — visible pour tous */}
          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <Checkbox
              id="micro-invoice"
              checked={isMicroInvoice}
              onCheckedChange={(v) => setIsMicroInvoice(v === true)}
              className="border-white/40 data-[state=checked]:bg-gold data-[state=checked]:border-gold data-[state=checked]:text-black"
            />
            <span className="text-[12px] text-foreground/80 select-none">TVA non applicable (art. 293B CGI)</span>
          </label>

          <textarea
            rows={3}
            value={objet}
            onChange={e => setObjet(e.target.value)}
            placeholder={invoiceMode === "trajet" ? "Référence, instructions particulières..." : "Référence, description de la prestation..."}
            className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 resize-none"
          />
        </section>
      </form>

      {/* Fixed bottom CTA */}
      <div className="px-4 py-4 border-t border-onyx-border/30 bg-background">
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-4 rounded-2xl bg-gold text-primary-foreground font-bold hover:bg-gold-light active:scale-[0.98] transition-all gold-glow flex flex-col items-center justify-center gap-0.5"
        >
          <span className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4" strokeWidth={1.5} />
            Générer la Facture
          </span>
          <span className="text-xs font-medium text-primary-foreground/80">
            {invoiceMode === "trajet" ? "Trajet réalisé • Conforme Factur-X" : `${items.length} ligne(s) • Conforme Factur-X`}
          </span>
        </button>
      </div>

      {/* Modal — Voir tous les clients */}
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
              <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-onyx-border/30 flex-shrink-0">
                <button onClick={() => setShowClientModal(false)}
                  className="w-8 h-8 rounded-xl bg-onyx-card/60 border border-onyx-border/20 flex items-center justify-center">
                  <X className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Sélectionner un client</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(clients ?? []).length} client{(clients ?? []).length !== 1 ? "s" : ""} enregistré{(clients ?? []).length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="px-5 pt-3 pb-2 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type="text" value={modalSearch} onChange={e => setModalSearch(e.target.value)}
                    placeholder="Nom, société, téléphone..." autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                    style={{ fontSize: "16px" }} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-onyx-border/20">
                {modalFilteredClients.length === 0 ? (
                  <p className="px-5 py-4 text-[11px] text-muted-foreground italic">Aucun résultat</p>
                ) : modalFilteredClients.map((c: Client) => (
                  <button key={c.id} type="button"
                    onClick={() => { setClientId(c.id); setClientSearch(""); setShowClientModal(false) }}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 text-left"
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
                      <p className="text-[10px] text-muted-foreground truncate">{c.phone ?? ""}</p>
                    </div>
                    {clientId === c.id && <Check className="h-3.5 w-3.5 text-gold shrink-0" strokeWidth={2} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuickAddClientModal
        open={showQuickAddClient}
        onClose={() => setShowQuickAddClient(false)}
        clients={clients ?? []}
        onClientCreated={(newClientId) => {
          setClientId(newClientId)
          setClientSearch("")
          setShowQuickAddClient(false)
        }}
      />

      <DateTimePickerSheet
        open={showDateTimePicker}
        initialDate={trajetDate}
        initialTime={trajetTime}
        pastOnly
        onClose={() => setShowDateTimePicker(false)}
        onConfirm={(date: string, time: string) => {
          if (date) {
            const chosen = new Date(date + "T00:00:00")
            const today = new Date(); today.setHours(23, 59, 59, 999)
            if (chosen > today) {
              toast.error("Pour un trajet futur, utilisez le Bon de Réservation")
              setShowDateTimePicker(false)
              return
            }
          }
          setTrajetDate(date)
          setTrajetTime(time)
          setShowDateTimePicker(false)
        }}
      />

      <DateTimePickerSheet
        open={showServiceDatePicker}
        initialDate={serviceDate}
        initialTime=""
        pastOnly
        onClose={() => setShowServiceDatePicker(false)}
        onConfirm={(date: string) => {
          if (date) {
            const chosen = new Date(date + "T00:00:00")
            const today = new Date(); today.setHours(23, 59, 59, 999)
            if (chosen > today) {
              setServiceDateError("La date ne peut pas être dans le futur")
              setShowServiceDatePicker(false)
              return
            }
            setServiceDate(date)
            setServiceDateError("")
          }
          setShowServiceDatePicker(false)
        }}
      />

      <TokenCostModal
        open={showTokenModal}
        onClose={() => { setShowTokenModal(false); onSuccess() }}
        documentType="facture"
        documentNumber={lastInvoiceNumber}
        tokensRemaining={tokens}
      />

    </motion.div>
  )
}

// ── Export: Create Invoice Flow ───────────────────────────────

export function CreateInvoiceFlow({ open, onClose }: CreateInvoiceProps) {
  const [step, setStep] = useState<InvoiceStep>("choose")

  function handleClose() {
    setStep("choose")
    onClose()
  }

  function handleSuccess() {
    handleClose()
    toast.success("Facture générée avec succès")
  }

  return (
    <>
      <AnimatePresence>
        {open && step === "choose" && (
          <ChooseInvoiceSheet
            onFromBC={() => setStep("fromBC")}
            onNewBC={() => setStep("newBC")}
            onLibre={() => setStep("libre")}
            onClose={handleClose}
          />
        )}
        {open && step === "fromBC" && (
          <FromBCScreen
            onBack={() => setStep("choose")}
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        )}
        {open && step === "libre" && (
          <FactureLibreForm
            onBack={() => setStep("choose")}
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        )}
      </AnimatePresence>

      <CreateBCFlow
        open={open && step === "newBC"}
        onClose={() => {
          setStep("choose")
          handleClose()
        }}
      />

    </>
  )
}

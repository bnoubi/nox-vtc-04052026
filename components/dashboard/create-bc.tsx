"use client"

import { useState, useMemo } from "react"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, ChevronLeft, ChevronDown, FileText, Link2, MessageSquare, Phone, Copy, Check,
  MapPin, Navigation, Car, Users, Euro, Eye, Building2, User, Search, Sparkles, Clock, Calendar, Percent, Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"
import { 
  type Client, type Driver, type Vehicle, type TarifForfait, type TarifSupplement, type BCDocument, type EnterpriseProfile
} from "./data"
import { toast } from "sonner"

// ============================================================================
// TYPES & HELPERS
// ============================================================================
type FlowStep = "menu" | "link" | "form"
type FormTab = "formulaire" | "apercu"
type PricingMode = "forfait" | "calcul"
type DiscountType = "percent" | "euro"

export interface BCPrefillClient {
  civilite: string
  nom: string
  prenom: string
  tel: string
}

// Local supplement state (tracks which are selected)
interface SupplementSelection { id: string; label: string; price: number; selected: boolean }

// Tariff detection: C (Weekend) > B (Night 21:00-06:59) > A (Day 07:00-20:59)
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
    const config = enterprise.cgvConfig;
    if (!config) return "Aucune condition générale n'a été spécifiée.";
    
    return `Conditions Générales de Vente :\n- Annulation : sans frais jusqu'à ${config.cancellationDelay} avant le départ. Passé ce délai, des frais de ${config.cancellationFee}% seront appliqués.\n- Attente : temps d'attente inclus de ${config.waitTime} minutes. Au-delà, facturation de ${config.waitFee}€/min.\n- No-Show (non-présentation) : pénalité de ${config.noShowFee}% appliquée.\n- Paiement : exigé au format ${config.paymentDelay} via ${config.paymentMethods.join(", ")}.`;
  } else if (enterprise.cgvMode === "freetext") {
    return enterprise.cgvText || "Aucune condition générale spécifiée.";
  } else {
    return "Les conditions générales relatives à cette prestation vous ont été remises en annexe ou sont consultables sur demande.";
  }
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
            <div className="px-4 pb-4 space-y-3">{children}</div>
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
  open: boolean; 
  onClose: () => void;
  prefillClient?: BCPrefillClient | null;
}

export function CreateBCFlow({ open, onClose, prefillClient }: CreateBCFlowProps) {
  const { drivers, clients, vehicles, tariffSettings, enterprise, addBC } = useNox()
  const [step, setStep] = useState<FlowStep>("menu")
  const [tab, setTab] = useState<FormTab>("formulaire")
  
  // Link sharing
  const [linkRecipient, setLinkRecipient] = useState("")
  const [linkCopied, setLinkCopied] = useState(false)
  
  // Selections
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers?.[0]?.id ?? "")
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [clientSearch, setClientSearch] = useState("")
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles?.[0]?.id ?? "")
  
  // Manual client fields if not selected from list (prefilled)
  const [manualClient, setManualClient] = useState<BCPrefillClient | null>(prefillClient || null)
  
  // Trip
  const [departure, setDeparture] = useState("")
  const [arrival, setArrival] = useState("")
  const [tripDate, setTripDate] = useState("")
  const [tripTime, setTripTime] = useState("") // Native time input
  const [passengers, setPassengers] = useState(1)
  const [luggage, setLuggage] = useState(0)
  const [instructions, setInstructions] = useState("")
  
  // Pricing - Filter supplements to only show enabled ones from tariff settings
  const [pricingMode, setPricingMode] = useState<PricingMode>("calcul")
  const [baseTvaRate, setBaseTvaRate] = useState<number>(10)
  const [selectedForfaitId, setSelectedForfaitId] = useState<string>("")
  const [distanceKm, setDistanceKm] = useState(25)
  const [editableBasePrice, setEditableBasePrice] = useState<number | null>(null)
  
  // Only show supplements that are enabled in tariff settings
  const availableSupplements = useMemo(() => 
    (tariffSettings.supplements ?? []).filter(s => s.enabled).map(s => ({ ...s, selected: false })),
  [tariffSettings.supplements])
  const [supplements, setSupplements] = useState<SupplementSelection[]>(availableSupplements)
  
  const [discountType, setDiscountType] = useState<DiscountType>("percent")
  const [discountValue, setDiscountValue] = useState(0)
  
  // Document
  const brNumber = useMemo(() => generateBRNumber(), [])
  const creationDate = useMemo(() => new Date(), [])
  
  // Computed with optional chaining
  const selectedDriver = drivers?.find(d => d.id === selectedDriverId) ?? null
  const selectedClient = clients?.find(c => c.id === selectedClientId) ?? null
  const selectedVehicle = vehicles?.find(v => v.id === selectedVehicleId) ?? null
  const selectedForfait = tariffSettings.forfaits?.find(f => f.id === selectedForfaitId) ?? null
  
  const tarif = useMemo(() => detectTarif(tripTime, tripDate), [tripTime, tripDate])
  
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients ?? []
    const search = clientSearch.toLowerCase()
    return (clients ?? []).filter(c => 
      (c.type === "particulier" ? `${c.prenom ?? ""} ${c.nom ?? ""}` : c.raisonSociale ?? "").toLowerCase().includes(search) ||
      (c.phone ?? "").includes(search) || (c.email ?? "").toLowerCase().includes(search)
    )
  }, [clientSearch, clients])
  
  // Pricing calculation using real tariff values
  const pricing = useMemo(() => {
    const { base, supplements: supplementsPriceList, forfaits } = tariffSettings
    const priseEnCharge = base.priseEnCharge
    const prixKm = base.prixKm
    const courseMin = base.courseMinimum
    
    let baseHT = 0
    let calculDetail = ""
    
    if (pricingMode === "forfait" && selectedForfait) {
      baseHT = editableBasePrice ?? selectedForfait.price
      calculDetail = `Forfait ${selectedForfait.name}`
    } else {
      const trajetHT = distanceKm * prixKm
      const rawBase = priseEnCharge + (trajetHT * tarif.coef)
      baseHT = editableBasePrice ?? Math.max(rawBase, courseMin)
      calculDetail = `Prise en charge (${formatPrice(priseEnCharge)}) + Trajet (${distanceKm} km × ${formatPrice(prixKm)}) × Coeff ${tarif.name} (${tarif.coef})`
    }
    
    const supplementsTotal = supplements.filter(s => s.selected).reduce((sum, s) => sum + s.price, 0)
    
    const subtotalHT = baseHT + supplementsTotal
    
    // Distribute discount proportionally
    let discountAmount = 0
    if (discountValue > 0) {
      discountAmount = discountType === "percent" ? subtotalHT * (discountValue / 100) : discountValue
    }
    const discountRatio = subtotalHT > 0 ? (discountAmount / subtotalHT) : 0
    
    const discountedBaseHT = baseHT * (1 - discountRatio)
    const discountedSupplementsHT = supplementsTotal * (1 - discountRatio)
    
    const tva10Amount = (baseTvaRate === 10 ? discountedBaseHT : 0) + 0 // Assume food at 5.5% is not here yet
    const tva20Amount = discountedSupplementsHT + (baseTvaRate === 20 ? discountedBaseHT : 0)
    
    const totalHT = discountedBaseHT + discountedSupplementsHT
    
    const tva10 = tva10Amount * 0.10
    const tva20 = tva20Amount * 0.20
    const tva = tva10 + tva20
    const totalTTC = totalHT + tva
    
    const originalTTC = (baseHT * (1 + baseTvaRate / 100)) + (supplementsTotal * 1.20)
    
    // Build full detail string
    let fullDetail = calculDetail
    if (supplementsTotal > 0) fullDetail += ` + Suppléments (${formatPrice(supplementsTotal)})`
    if (discountAmount > 0) fullDetail += ` - Remise (${formatPrice(discountAmount)})`
    
    return { 
      baseHT, 
      supplementsTotal, 
      subtotalHT, 
      discountAmount, 
      discountedBaseHT,
      discountedSupplementsHT,
      totalHT, 
      tva10,
      tva20,
      tva, 
      totalTTC, 
      originalHT: subtotalHT, 
      originalTTC,
      fullDetail 
    }
  }, [pricingMode, selectedForfait, distanceKm, tarif, supplements, discountType, discountValue, editableBasePrice, baseTvaRate])
  
  const handleClose = () => { setStep("menu"); onClose() }
  
  const copyLink = () => {
    navigator.clipboard.writeText(`https://nox.vtc/book/${brNumber.toLowerCase()}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
    toast.success("Lien copié")
  }
  
  const handleGenerate = () => {
    // Determine client name
    const clientName = (selectedClient 
      ? (selectedClient.type === "particulier" ? `${selectedClient.prenom} ${selectedClient.nom}` : selectedClient.raisonSociale)
      : (manualClient ? `${manualClient.prenom} ${manualClient.nom}` : "Client Inconnu")) || "Client Inconnu"

    const clientPhone = selectedClient 
      ? selectedClient.phone 
      : (manualClient ? manualClient.tel : undefined)

    const cgvText = generateCGVSummary(enterprise)

    const newBC: BCDocument = {
      id: `bc-${Date.now()}`,
      number: brNumber,
      client: clientName ?? "Client Inconnu",
      clientPhone,
      amount: pricing.totalTTC,
      amountHT: pricing.totalHT,
      tva: pricing.tva,
      // Record new split fields
      baseHT: pricing.baseHT,
      supplementsHT: pricing.supplementsTotal,
      tva10Amount: pricing.tva10,
      tva20Amount: pricing.tva20,
      discountValue: discountValue,
      discountType: discountType,
      originalHT: pricing.originalHT,
      originalTTC: pricing.originalTTC,
      supplementsList: supplements.filter(s => s.selected).map(s => s.label),
      date: new Date().toLocaleDateString("fr-FR"),
      status: "en_attente",
      type: "bc",
      trajet: {
        depart: departure || "Non renseigné",
        arrivee: arrival || "Non renseigné",
        distance: distanceKm,
        date: tripDate,
        time: tripTime,
        passengers,
        luggage
      },
      driverName: selectedDriver ? selectedDriver.name : undefined,
      driverCarteVTC: selectedDriver ? selectedDriver.carteProNumber : undefined,
      vehicleName: selectedVehicle ? selectedVehicle.model : undefined,
      vehiclePlate: selectedVehicle ? selectedVehicle.plate : undefined,
      notes: instructions || undefined,
      cgvText
    }

    addBC(newBC)
    setTab("apercu")
    toast.success("Bon de réservation généré et enregistré")
  }
  
  const toggleSupplement = (id: string) => {
    setSupplements(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s))
  }
  
  if (!open) return null
  
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
          <h1 className="text-base font-bold text-foreground">Nouveau Bon de Réservation</h1>
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
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Chauffeur assigné</label>
              <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }}>
                {(drivers ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </Section>
          
          {/* SECTION: Client */}
          <Section title="Client" icon={Building2}>
            {/* Prefilled Client Badge if available */}
            {manualClient && !selectedClientId && (
              <div className="p-3 rounded-xl bg-gold/10 border border-gold/30 space-y-1 mb-3 relative group">
                <p className="text-[10px] text-gold font-bold uppercase tracking-tighter">Client pré-sélectionné</p>
                <p className="text-sm font-semibold text-foreground">{manualClient.civilite} {manualClient.prenom} {manualClient.nom}</p>
                <p className="text-[11px] text-muted-foreground">{manualClient.tel}</p>
                <button 
                  onClick={() => setManualClient(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-gold/10 text-gold opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Rechercher un client ou en changer..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
            </div>
            {clientSearch && filteredClients.length > 0 && !selectedClientId && (
              <div className="max-h-40 overflow-y-auto rounded-xl bg-[#242424] border border-onyx-border/30 divide-y divide-onyx-border/20">
                {filteredClients.slice(0, 5).map(c => (
                  <button key={c.id} onClick={() => { setSelectedClientId(c.id); setClientSearch("") }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left">
                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold">
                      {c.type === "particulier" ? `${c.prenom?.[0] ?? ""}${c.nom?.[0] ?? ""}` : (c.raisonSociale?.[0] ?? "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.type === "particulier" ? `${c.prenom ?? ""} ${c.nom ?? ""}` : (c.raisonSociale ?? "")}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.phone ?? ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedClient && (
              <div className="p-3 rounded-xl bg-[#242424] border border-gold/20 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedClient.type === "particulier" ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}` : (selectedClient.raisonSociale ?? "")}
                  </p>
                  <button onClick={() => setSelectedClientId("")} className="text-[10px] text-muted-foreground hover:text-foreground">Modifier</button>
                </div>
                <p className="text-[11px] text-muted-foreground">{selectedClient.phone ?? ""} • {selectedClient.email ?? ""}</p>
                {selectedClient.type === "professionnel" && selectedClient.siren && (
                  <p className="text-[11px] text-gold">SIREN : {selectedClient.siren}</p>
                )}
              </div>
            )}
          </Section>
          
          {/* SECTION: Trajet */}
          <Section title="Trajet" icon={Navigation}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center"><MapPin className="h-3.5 w-3.5 text-green-400" /></div>
              <PlacesAutocomplete value={departure} onChange={setDeparture} placeholder="Adresse de départ"
                className="flex-1 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center"><MapPin className="h-3.5 w-3.5 text-red-400" /></div>
              <PlacesAutocomplete value={arrival} onChange={setArrival} placeholder="Adresse d'arrivée"
                className="flex-1 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Date</label>
                <input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Heure</label>
                <input type="time" value={tripTime} onChange={e => setTripTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
              </div>
            </div>
            {/* Tarif badge */}
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold", 
                tarif.id === "c" ? "bg-purple-500/20 text-purple-400" : tarif.id === "b" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400")}>
                Tarif {tarif.id.toUpperCase()} — {tarif.name} (×{tarif.coef})
              </span>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Distance estimée (km)</label>
              <input type="number" inputMode="numeric" value={distanceKm} onChange={e => setDistanceKm(Number(e.target.value) || 0)} min={1}
                className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
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
              {(vehicles ?? []).filter(v => v.inService).map(v => (
                <option key={v.id} value={v.id}>{v.model} — {v.plate}</option>
              ))}
            </select>
            {selectedVehicle && (
              <div className="p-3 rounded-xl bg-[#242424] space-y-1">
                <p className="text-sm font-semibold text-foreground">{selectedVehicle.model}</p>
                <p className="text-[11px] text-muted-foreground">{selectedVehicle.plate} • {selectedVehicle.category} • {selectedVehicle.motorType}</p>
              </div>
            )}
          </Section>
          
          {/* SECTION: Tarification */}
          <Section title="Tarification" icon={Euro}>
            <div className="flex bg-secondary/30 border border-onyx-border/30 rounded-xl p-1 mt-3">
              <button
                className={cn("flex-1 text-xs py-2 rounded-lg font-medium transition-all text-center", pricingMode === "calcul" ? "bg-onyx-card shadow text-gold border border-gold/20" : "text-muted-foreground hover:text-foreground")}
                onClick={() => { setPricingMode("calcul"); setBaseTvaRate(10) }}
              >
                Calcul au km
              </button>
              <button
                className={cn("flex-1 text-xs py-2 rounded-lg font-medium transition-all text-center", pricingMode === "forfait" ? "bg-onyx-card shadow text-gold border border-gold/20" : "text-muted-foreground hover:text-foreground")}
                onClick={() => { setPricingMode("forfait"); setBaseTvaRate(20) }}
              >
                Forfait fixe
              </button>
            </div>
            
            {pricingMode === "forfait" && (
              <div className="mt-3 flex gap-2">
                <button
                  className={cn("flex-1 text-[10px] py-1.5 rounded border transition-colors", baseTvaRate === 10 ? "border-gold text-gold bg-gold/10" : "border-onyx-border/50 text-muted-foreground hover:bg-secondary/50")}
                  onClick={() => setBaseTvaRate(10)}
                >
                  Transfert (TVA 10%)
                </button>
                <button
                  className={cn("flex-1 text-[10px] py-1.5 rounded border transition-colors", baseTvaRate === 20 ? "border-gold text-gold bg-gold/10" : "border-onyx-border/50 text-muted-foreground hover:bg-secondary/50")}
                  onClick={() => setBaseTvaRate(20)}
                >
                  Mise à dispo (TVA 20%)
                </button>
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
            
            {/* Supplements - Only show enabled ones */}
            {supplements.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Suppléments disponibles</label>
                <div className="flex flex-wrap gap-2">
                  {supplements.map(s => (
                    <button key={s.id} onClick={() => toggleSupplement(s.id)}
                      className={cn("px-3 py-1.5 rounded-full text-[11px] font-medium transition-all",
                        s.selected ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground border border-onyx-border/30 hover:border-gold/30")}>
                      {s.label} (+{formatPrice(s.price)})
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Discount */}
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
                  <button onClick={() => setDiscountType("euro")}
                    className={cn("px-3 py-2 rounded-r-xl text-xs font-semibold", discountType === "euro" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground border border-onyx-border/30")}>€</button>
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
              {/* Calculation detail */}
              <div className="pt-2 border-t border-onyx-border/30">
                <p className="text-[9px] text-muted-foreground leading-relaxed">
                  Détail : {pricing.fullDetail}
                </p>
              </div>
            </div>
          </Section>
        </div>
      )}
      
      {/* PDF Preview */}
      {tab === "apercu" && (
        <div className="flex-1 overflow-y-auto p-4 bg-[#1a1a1a]">
          <div className="max-w-[400px] mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="p-5 space-y-4">
              {/* Header - Entreprise only (no NoX branding) */}
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
              
              {/* Driver & Client */}
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
              
              {/* Trip */}
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
                  <span className="text-gray-900">{distanceKm} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Passagers / Bagages :</span>
                  <span className="text-gray-900">{passengers} / {luggage}</span>
                </div>
              </div>
              
              {/* Vehicle */}
              <div className="text-[10px]">
                <p className="font-bold text-gray-700 mb-1">VÉHICULE</p>
                <p className="text-gray-900">{selectedVehicle?.model ?? "—"} • {selectedVehicle?.plate ?? ""}</p>
              </div>
              
              {/* Pricing */}
              <div className="border-t border-gray-200 pt-3 text-[10px]">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Total HT</span>
                  <span className="text-gray-900">{formatPrice(pricing.totalHT)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">TVA (10%)</span>
                  <span className="text-gray-900">{formatPrice(pricing.tva)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm">
                  <span className="text-gray-900">TOTAL TTC</span>
                  <span className="text-amber-600">{formatPrice(pricing.totalTTC)}</span>
                </div>
              </div>
              {/* CGV Preview */}
              <div className="border-t border-gray-200 pt-3 mt-3 text-[10px] text-gray-500 max-h-[120px] overflow-y-auto w-full whitespace-pre-wrap">
                <p className="font-bold text-gray-700 mb-1">CONDITIONS GÉNÉRALES</p>
                {generateCGVSummary(enterprise)}
              </div>
              
              {/* Footer */}
              <div className="border-t border-gray-200 pt-3 text-[8px] text-gray-400 text-center">
                <p>Document généré via NoX VTC</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Action Bar */}
      <div className="px-4 py-4 border-t border-onyx-border/30 bg-[#0d0d0d]">
        <button onClick={handleGenerate}
          className="w-full py-3.5 rounded-full bg-gold text-black font-bold text-sm hover:bg-gold/90 transition-colors active:scale-[0.98]">
          Générer le bon de réservation
        </button>
      </div>
    </motion.div>
  )
}

export default CreateBCFlow

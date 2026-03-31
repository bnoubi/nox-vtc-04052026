"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, ChevronLeft, ChevronDown, FileText, Link2, MessageSquare, Phone, Copy, Check,
  MapPin, Navigation, Car, Users, Euro, Eye, Send, Download, Building2, User, Search,
  Sparkles, Clock, Calendar, Percent, Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { allClients, allDrivers, allVehicles, defaultForfaits, defaultEnterprise, type Client, type Driver, type Vehicle, type TarifForfait } from "./data"
import { toast } from "sonner"

// ============================================================================
// TYPES & HELPERS
// ============================================================================
type FlowStep = "menu" | "link" | "form"
type FormTab = "formulaire" | "apercu"
type PricingMode = "forfait" | "calcul"
type DiscountType = "percent" | "euro"

interface Supplement { id: string; label: string; price: number; active: boolean }

const defaultSupplements: Supplement[] = [
  { id: "bagage", label: "Bagage volumineux", price: 10, active: false },
  { id: "animal", label: "Animal de compagnie", price: 15, active: false },
  { id: "enfant", label: "Siège enfant", price: 10, active: false },
  { id: "accueil", label: "Accueil pancarte", price: 15, active: false },
]

// Generate 15-minute time slots (00:00, 00:15, 00:30, ...)
const timeSlots: string[] = []
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    timeSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
  }
}

// Tariff detection: C (Weekend) > B (Night) > A (Day)
// Tarif C: Samedi & Dimanche (00:00-23:59)
// Tarif B: Nuit (21:00-06:59) 
// Tarif A: Jour (07:00-20:59)
function detectTarif(time: string, date: string): { id: string; name: string; coef: number } {
  if (date) {
    const dayOfWeek = new Date(date).getDay()
    // Samedi (6) ou Dimanche (0) = Week-end = Tarif C
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { id: "c", name: "Week-end", coef: 1.5 }
    }
  }
  
  if (!time) return { id: "a", name: "Journée", coef: 1.0 }
  
  const [h] = time.split(":").map(Number)
  // Nuit: 21:00-06:59
  if (h >= 21 || h < 7) return { id: "b", name: "Nuit", coef: 1.25 }
  // Jour: 07:00-20:59
  return { id: "a", name: "Journée", coef: 1.0 }
}

function formatPrice(v: number): string {
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function generateBRNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const n = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0")
  return `BR-${y}-${m}-${n}`
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

// ============================================================================
// COLLAPSIBLE SECTION COMPONENT
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
interface CreateBCFlowProps { open: boolean; onClose: () => void }

export function CreateBCFlow({ open, onClose }: CreateBCFlowProps) {
  const [step, setStep] = useState<FlowStep>("menu")
  const [tab, setTab] = useState<FormTab>("formulaire")
  
  // Link sharing state
  const [linkRecipient, setLinkRecipient] = useState("")
  const [linkCopied, setLinkCopied] = useState(false)
  
  // Form state - Chauffeur & Véhicule from real data
  const [selectedDriverId, setSelectedDriverId] = useState<string>(allDrivers?.[0]?.id ?? "")
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [clientSearch, setClientSearch] = useState("")
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(allVehicles?.[0]?.id ?? "")
  
  // Trip details
  const [departure, setDeparture] = useState("")
  const [arrival, setArrival] = useState("")
  const [tripDate, setTripDate] = useState("")
  const [tripTime, setTripTime] = useState("")
  const [passengers, setPassengers] = useState(1)
  const [luggage, setLuggage] = useState(0)
  const [instructions, setInstructions] = useState("")
  
  // Pricing - using real forfaits from data
  const [pricingMode, setPricingMode] = useState<PricingMode>("calcul")
  const [selectedForfaitId, setSelectedForfaitId] = useState<string>("")
  const [distanceKm, setDistanceKm] = useState(25)
  const [pricePerKm, setPricePerKm] = useState(2.50)
  const [editableBasePrice, setEditableBasePrice] = useState<number | null>(null)
  const [supplements, setSupplements] = useState<Supplement[]>(defaultSupplements)
  const [discountType, setDiscountType] = useState<DiscountType>("percent")
  const [discountValue, setDiscountValue] = useState(0)
  
  // Document metadata
  const brNumber = useMemo(() => generateBRNumber(), [])
  const creationDate = useMemo(() => new Date(), [])
  
  // Computed values with optional chaining
  const selectedDriver = allDrivers?.find(d => d.id === selectedDriverId) ?? null
  const selectedClient = allClients?.find(c => c.id === selectedClientId) ?? null
  const selectedVehicle = allVehicles?.find(v => v.id === selectedVehicleId) ?? null
  const selectedForfait = defaultForfaits?.find(f => f.id === selectedForfaitId) ?? null
  
  const tarif = useMemo(() => detectTarif(tripTime, tripDate), [tripTime, tripDate])
  
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients ?? []
    const search = clientSearch.toLowerCase()
    return (allClients ?? []).filter(c => 
      (c.type === "particulier" ? `${c.prenom ?? ""} ${c.nom ?? ""}` : c.raisonSociale ?? "").toLowerCase().includes(search) ||
      (c.phone ?? "").includes(search) || (c.email ?? "").toLowerCase().includes(search)
    )
  }, [clientSearch])
  
  // Pricing calculations with editable prices
  const pricing = useMemo(() => {
    let baseHT = 0
    if (pricingMode === "forfait" && selectedForfait) {
      baseHT = editableBasePrice ?? selectedForfait.price
    } else {
      const calculatedBase = distanceKm * pricePerKm * tarif.coef
      baseHT = editableBasePrice ?? calculatedBase
    }
    
    const supplementsTotal = supplements.filter(s => s.active).reduce((sum, s) => sum + s.price, 0)
    const subtotalHT = baseHT + supplementsTotal
    
    let discountAmount = 0
    if (discountValue > 0) {
      discountAmount = discountType === "percent" ? subtotalHT * (discountValue / 100) : discountValue
    }
    
    const totalHT = Math.max(0, subtotalHT - discountAmount)
    const tva = totalHT * 0.10
    const totalTTC = totalHT + tva
    
    return { baseHT, supplementsTotal, subtotalHT, discountAmount, totalHT, tva, totalTTC, originalHT: subtotalHT }
  }, [pricingMode, selectedForfait, distanceKm, pricePerKm, tarif.coef, supplements, discountType, discountValue, editableBasePrice])
  
  const handleClose = () => { setStep("menu"); onClose() }
  
  const copyLink = () => {
    navigator.clipboard.writeText(`https://nox.vtc/book/${brNumber.toLowerCase()}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
    toast.success("Lien copié")
  }
  
  const handleGenerate = () => {
    setTab("apercu")
    toast.success("Bon de réservation généré")
  }
  
  // Reset editable price when forfait or mode changes
  const handleForfaitChange = (forfaitId: string) => {
    setSelectedForfaitId(forfaitId)
    setEditableBasePrice(null)
  }
  
  const handlePricingModeChange = (mode: PricingMode) => {
    setPricingMode(mode)
    setEditableBasePrice(null)
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
          {/* SECTION: Émetteur & Chauffeur */}
          <Section title="Émetteur & Chauffeur" icon={User}>
            {/* Company info (read-only) */}
            <div className="p-3 rounded-xl bg-[#242424] border border-gold/20 space-y-1 mb-3">
              <p className="text-xs text-gold font-semibold">Émetteur du document</p>
              <p className="text-sm font-semibold text-foreground">{defaultEnterprise?.denomination ?? "Entreprise"}</p>
              <p className="text-[11px] text-muted-foreground">SIREN : {defaultEnterprise?.siren ?? ""}</p>
              <p className="text-[11px] text-muted-foreground">{defaultEnterprise?.adresse ?? ""}</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Chauffeur assigné</label>
              <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }}>
                {(allDrivers ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            {selectedDriver && (
              <div className="p-3 rounded-xl bg-[#242424] space-y-1">
                <p className="text-sm font-semibold text-foreground">{selectedDriver.name}</p>
                <p className="text-[11px] text-gold">Carte VTC : {selectedDriver.carteProNumber ?? "Non renseigné"}</p>
                <p className="text-[11px] text-muted-foreground">{selectedDriver.phone ?? ""}</p>
              </div>
            )}
          </Section>
          
          {/* SECTION: Client */}
          <Section title="Client" icon={Building2}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Rechercher un client..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
            </div>
            {clientSearch && filteredClients.length > 0 && !selectedClientId && (
              <div className="max-h-40 overflow-y-auto rounded-xl bg-[#242424] border border-onyx-border/30 divide-y divide-onyx-border/20">
                {filteredClients.slice(0, 5).map(c => (
                  <button key={c.id} onClick={() => { setSelectedClientId(c.id); setClientSearch("") }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left">
                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold">
                      {c.type === "particulier" ? (c.prenom?.[0] ?? "") + (c.nom?.[0] ?? "") : (c.raisonSociale?.[0] ?? "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{c.type === "particulier" ? `${c.prenom ?? ""} ${c.nom ?? ""}` : c.raisonSociale ?? ""}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.phone}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedClient && (
              <div className="p-3 rounded-xl bg-[#242424] border border-gold/20 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedClient.type === "particulier" ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}` : selectedClient.raisonSociale ?? ""}
                  </p>
                  <button onClick={() => setSelectedClientId("")} className="text-[10px] text-rose-400">Changer</button>
                </div>
                <p className="text-[11px] text-muted-foreground">{selectedClient.phone}</p>
                <p className="text-[11px] text-muted-foreground">{selectedClient.email}</p>
              </div>
            )}
          </Section>
          
          {/* SECTION: Trajet */}
          <Section title="Trajet" icon={MapPin}>
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-green-500" />
                <input type="text" value={departure} onChange={e => setDeparture(e.target.value)} placeholder="Adresse de départ..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-rose-500" />
                <input type="text" value={arrival} onChange={e => setArrival(e.target.value)} placeholder="Adresse d'arrivée..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Date</label>
                  <input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Heure (15 min)</label>
                  <select value={tripTime} onChange={e => setTripTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }}>
                    <option value="">Sélectionner</option>
                    {timeSlots.map(t => <option key={t} value={t}>{t.replace(":", "h")}</option>)}
                  </select>
                </div>
              </div>
              
              {/* Tariff indicator */}
              {(tripTime || tripDate) && (
                <div className={cn("px-3 py-2 rounded-lg text-xs font-semibold text-center", 
                  tarif.id === "c" ? "bg-purple-500/20 text-purple-400" : 
                  tarif.id === "b" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400")}>
                  Tarif {tarif.id.toUpperCase()} — {tarif.name} (x{tarif.coef.toFixed(2)})
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Passagers</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPassengers(Math.max(1, passengers - 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5">-</button>
                    <span className="flex-1 text-center text-sm font-semibold text-foreground">{passengers}</span>
                    <button onClick={() => setPassengers(Math.min(8, passengers + 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5">+</button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Bagages</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLuggage(Math.max(0, luggage - 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5">-</button>
                    <span className="flex-1 text-center text-sm font-semibold text-foreground">{luggage}</span>
                    <button onClick={() => setLuggage(Math.min(10, luggage + 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 flex items-center justify-center text-foreground hover:bg-white/5">+</button>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Instructions</label>
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Ex: Accueil avec pancarte..."
                  className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50 resize-none" rows={2} style={{ fontSize: "16px" }} />
              </div>
            </div>
          </Section>
          
          {/* SECTION: Véhicule */}
          <Section title="Véhicule" icon={Car}>
            <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }}>
              {(allVehicles ?? []).filter(v => v.inService).map(v => <option key={v.id} value={v.id}>{v.model} • {v.plate}</option>)}
            </select>
            {selectedVehicle && (
              <div className="p-3 rounded-xl bg-[#242424] space-y-1">
                <p className="text-sm font-semibold text-foreground">{selectedVehicle.model}</p>
                <p className="text-[11px] text-muted-foreground">{selectedVehicle.plate} • {selectedVehicle.category}</p>
                <p className="text-[11px] text-green-400">Capacité : {selectedVehicle.category === "van" ? "7" : "4"} passagers</p>
              </div>
            )}
          </Section>
          
          {/* SECTION: Tarification */}
          <Section title="Tarification" icon={Euro}>
            {/* Mode selector */}
            <div className="flex gap-2">
              <button onClick={() => handlePricingModeChange("calcul")} className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-colors", pricingMode === "calcul" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground")}>
                Calcul au km
              </button>
              <button onClick={() => handlePricingModeChange("forfait")} className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-colors", pricingMode === "forfait" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground")}>
                Forfait fixe
              </button>
            </div>
            
            {pricingMode === "forfait" ? (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Appliquer un forfait</label>
                <select value={selectedForfaitId} onChange={e => handleForfaitChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }}>
                  <option value="">Sélectionner un forfait</option>
                  {(defaultForfaits ?? []).map(f => <option key={f.id} value={f.id}>{f.name} — {formatPrice(f.price)}</option>)}
                </select>
                {selectedForfait && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Prix HT (modifiable)</label>
                    <div className="relative">
                      <input type="number" value={editableBasePrice ?? selectedForfait.price} onChange={e => setEditableBasePrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50 pr-8" style={{ fontSize: "16px" }} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Distance (km)</label>
                    <input type="number" value={distanceKm} onChange={e => { setDistanceKm(parseFloat(e.target.value) || 0); setEditableBasePrice(null) }}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Prix/km</label>
                    <input type="number" step="0.10" value={pricePerKm} onChange={e => { setPricePerKm(parseFloat(e.target.value) || 0); setEditableBasePrice(null) }}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Prix HT calculé (modifiable)</label>
                  <div className="relative">
                    <input type="number" value={editableBasePrice ?? Math.round(distanceKm * pricePerKm * tarif.coef * 100) / 100} 
                      onChange={e => setEditableBasePrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50 pr-8" style={{ fontSize: "16px" }} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Supplements */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Suppléments</label>
              <div className="grid grid-cols-2 gap-2">
                {supplements.map(s => (
                  <button key={s.id} onClick={() => setSupplements(prev => prev.map(x => x.id === s.id ? { ...x, active: !x.active } : x))}
                    className={cn("px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left", s.active ? "bg-gold/20 text-gold border border-gold/30" : "bg-[#242424] text-muted-foreground border border-onyx-border/30")}>
                    {s.label} <span className="text-[10px]">(+{s.price}€)</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Discount */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Remise commerciale</label>
              <div className="flex gap-2">
                <div className="flex rounded-lg overflow-hidden border border-onyx-border/30">
                  <button onClick={() => setDiscountType("percent")} className={cn("px-3 py-2 text-xs font-semibold", discountType === "percent" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground")}>%</button>
                  <button onClick={() => setDiscountType("euro")} className={cn("px-3 py-2 text-xs font-semibold", discountType === "euro" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground")}>€</button>
                </div>
                <input type="number" value={discountValue} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} placeholder="0"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
              </div>
            </div>
            
            {/* Summary */}
            <div className="p-4 rounded-xl bg-[#242424] border border-gold/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base HT</span>
                <span className="text-foreground">{formatPrice(pricing.baseHT)}</span>
              </div>
              {pricing.supplementsTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Suppléments</span>
                  <span className="text-foreground">+{formatPrice(pricing.supplementsTotal)}</span>
                </div>
              )}
              {discountValue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remise</span>
                  <span className="text-rose-400">-{formatPrice(pricing.discountAmount)}</span>
                </div>
              )}
              <div className="border-t border-onyx-border/30 pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total HT</span>
                  {discountValue > 0 ? (
                    <span><span className="line-through text-muted-foreground mr-2">{formatPrice(pricing.originalHT)}</span><span className="text-foreground">{formatPrice(pricing.totalHT)}</span></span>
                  ) : (
                    <span className="text-foreground">{formatPrice(pricing.totalHT)}</span>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA 10%</span>
                  <span className="text-foreground">{formatPrice(pricing.tva)}</span>
                </div>
                <div className="flex justify-between text-base font-bold mt-2">
                  <span className="text-gold">Total TTC</span>
                  <span className="text-gold">{formatPrice(pricing.totalTTC)}</span>
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}
      
      {/* PDF Preview */}
      {tab === "apercu" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
          <div className="bg-white rounded-xl p-6 text-black max-w-md mx-auto shadow-xl">
            {/* Header - Company name only */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <p className="text-lg font-bold text-gray-900">{defaultEnterprise?.denomination ?? "Entreprise"}</p>
              <p className="text-xs text-gray-500">{defaultEnterprise?.adresse ?? ""}</p>
              <p className="text-xs text-gray-500">SIREN : {defaultEnterprise?.siren ?? ""}</p>
            </div>
            
            {/* Document info */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-bold text-gray-900">BON DE RÉSERVATION</p>
              <p className="text-xs text-gray-600">{brNumber}</p>
              <p className="text-xs text-gray-600">Établi le {formatDateFr(creationDate)} à {formatTimeFr(creationDate)}</p>
            </div>
            
            {/* Driver & Client */}
            <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
              <div>
                <p className="font-semibold text-gray-700 mb-1">CHAUFFEUR</p>
                <p className="text-gray-900">{selectedDriver?.name ?? "Non assigné"}</p>
                <p className="text-amber-600 text-[10px]">Carte VTC : {selectedDriver?.carteProNumber ?? "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-1">CLIENT</p>
                <p className="text-gray-900">{selectedClient ? (selectedClient.type === "particulier" ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}` : selectedClient.raisonSociale) : "Non sélectionné"}</p>
                <p className="text-gray-500">{selectedClient?.phone ?? ""}</p>
              </div>
            </div>
            
            {/* Trip */}
            <div className="mb-4 text-xs">
              <p className="font-semibold text-gray-700 mb-1">TRAJET</p>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1" />
                <p className="text-gray-900">{departure || "Départ non renseigné"}</p>
              </div>
              <div className="flex items-start gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-rose-500 mt-1" />
                <p className="text-gray-900">{arrival || "Arrivée non renseignée"}</p>
              </div>
              <p className="text-gray-600 mt-2">
                {tripDate ? new Date(tripDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date non définie"}
                {tripTime ? ` à ${formatTimeFrFromString(tripTime)}` : ""}
              </p>
              <p className="text-amber-600">{passengers} passager{passengers > 1 ? "s" : ""} • {luggage} bagage{luggage > 1 ? "s" : ""}</p>
            </div>
            
            {/* Vehicle */}
            <div className="mb-4 text-xs">
              <p className="font-semibold text-gray-700 mb-1">VÉHICULE</p>
              <p className="text-gray-900">{selectedVehicle?.model ?? "Non sélectionné"} • {selectedVehicle?.plate ?? ""}</p>
              <p className="text-green-600">Véhicule assuré</p>
            </div>
            
            {/* Pricing */}
            <div className="border-t border-gray-200 pt-3 mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">Total HT</span>
                <span className="text-gray-900">{formatPrice(pricing.totalHT)}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">TVA 10%</span>
                <span className="text-gray-900">{formatPrice(pricing.tva)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-900">TOTAL TTC</span>
                <span className="text-amber-600">{formatPrice(pricing.totalTTC)}</span>
              </div>
            </div>
            
            {/* Footer */}
            <div className="border-t border-gray-200 pt-3 text-center">
              <p className="text-[9px] text-gray-400">Document généré via NoX VTC</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Action buttons */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 border-t border-onyx-border/30 bg-[#0d0d0d] z-10">
        <button onClick={handleGenerate} className="w-full py-3.5 rounded-full bg-gold text-black font-bold text-sm hover:bg-gold/90 transition-colors flex items-center justify-center gap-2">
          <Eye className="h-4 w-4" /> Générer le Bon de Réservation
        </button>
        <div className="flex gap-3 mt-3">
          <button className="flex-1 py-2.5 rounded-xl border border-onyx-border/30 text-muted-foreground text-xs font-medium hover:bg-white/5 flex items-center justify-center gap-1.5">
            <Send className="h-3.5 w-3.5" /> Envoyer
          </button>
          <button className="flex-1 py-2.5 rounded-xl border border-onyx-border/30 text-muted-foreground text-xs font-medium hover:bg-white/5 flex items-center justify-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default CreateBCFlow

"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, ChevronLeft, ChevronDown, FileText, Link2, MessageSquare, Phone, Copy, Check,
  MapPin, Navigation, Car, Users, Euro, Eye, Send, Download, Building2, User, Search,
  Sparkles, Clock, Calendar, Percent, Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { allClients, allDrivers, allVehicles, type Client, type Driver, type Vehicle } from "./data"
import { toast } from "sonner"

// ============================================================================
// TYPES & HELPERS
// ============================================================================
type FlowStep = "menu" | "link" | "form"
type FormTab = "formulaire" | "apercu"
type PricingMode = "forfait" | "calcul"
type DiscountType = "percent" | "euro"

interface Supplement { id: string; label: string; price: number; active: boolean }
interface Forfait { id: string; name: string; price: number }

const defaultSupplements: Supplement[] = [
  { id: "bagage", label: "Bagage volumineux", price: 10, active: false },
  { id: "animal", label: "Animal de compagnie", price: 15, active: false },
  { id: "enfant", label: "Siège enfant", price: 10, active: false },
  { id: "accueil", label: "Accueil pancarte", price: 15, active: false },
]

const defaultForfaits: Forfait[] = [
  { id: "cdg", name: "Paris ↔ CDG", price: 75 },
  { id: "orly", name: "Paris ↔ Orly", price: 55 },
  { id: "disney", name: "Paris ↔ Disneyland", price: 85 },
]

// Tariff detection based on time (A: 07:00-20:59, B: 21:00-06:59, C: Sunday)
function detectTarif(time: string, date: string): { id: string; name: string; coef: number } {
  const dayOfWeek = date ? new Date(date).getDay() : 1
  if (dayOfWeek === 0) return { id: "c", name: "Dimanche", coef: 1.5 }
  
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
  
  // Form state
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
  
  // Pricing
  const [pricingMode, setPricingMode] = useState<PricingMode>("forfait")
  const [selectedForfaitId, setSelectedForfaitId] = useState<string>("")
  const [distanceKm, setDistanceKm] = useState(25)
  const [pricePerKm, setPricePerKm] = useState(2.50)
  const [supplements, setSupplements] = useState<Supplement[]>(defaultSupplements)
  const [discountType, setDiscountType] = useState<DiscountType>("percent")
  const [discountValue, setDiscountValue] = useState(0)
  
  // Document metadata
  const brNumber = useMemo(() => generateBRNumber(), [])
  const creationDate = useMemo(() => new Date(), [])
  
  // Computed values
  const selectedDriver = allDrivers?.find(d => d.id === selectedDriverId) ?? null
  const selectedClient = allClients?.find(c => c.id === selectedClientId) ?? null
  const selectedVehicle = allVehicles?.find(v => v.id === selectedVehicleId) ?? null
  const selectedForfait = defaultForfaits.find(f => f.id === selectedForfaitId) ?? null
  
  const tarif = useMemo(() => detectTarif(tripTime, tripDate), [tripTime, tripDate])
  
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return allClients ?? []
    const search = clientSearch.toLowerCase()
    return (allClients ?? []).filter(c => 
      (c.type === "particulier" ? `${c.prenom ?? ""} ${c.nom ?? ""}` : c.raisonSociale ?? "").toLowerCase().includes(search) ||
      (c.phone ?? "").includes(search) || (c.email ?? "").toLowerCase().includes(search)
    )
  }, [clientSearch])
  
  // Pricing calculations
  const pricing = useMemo(() => {
    let baseHT = 0
    if (pricingMode === "forfait" && selectedForfait) {
      baseHT = selectedForfait.price
    } else {
      baseHT = distanceKm * pricePerKm * tarif.coef
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
  }, [pricingMode, selectedForfait, distanceKm, pricePerKm, tarif.coef, supplements, discountType, discountValue])
  
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
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* SECTION: Émetteur & Chauffeur */}
          <Section title="Émetteur & Chauffeur" icon={User}>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Chauffeur assigné</label>
              <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50">
                {(allDrivers ?? []).map(d => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
              </select>
            </div>
            {selectedDriver && (
              <div className="p-3 rounded-xl bg-[#242424] space-y-1">
                <p className="text-sm font-semibold text-foreground">{selectedDriver.firstName} {selectedDriver.lastName}</p>
                <p className="text-[11px] text-muted-foreground">Carte VTC : {selectedDriver.cardNumber ?? "Non renseigné"}</p>
                <p className="text-[11px] text-muted-foreground">{selectedDriver.phone}</p>
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
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mt-1"><MapPin className="h-4 w-4 text-green-400" /></div>
                <input type="text" value={departure} onChange={e => setDeparture(e.target.value)} placeholder="Adresse de départ..."
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center mt-1"><Navigation className="h-4 w-4 text-rose-400" /></div>
                <input type="text" value={arrival} onChange={e => setArrival(e.target.value)} placeholder="Adresse d'arrivée..."
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Date</label>
                  <input type="date" value={tripDate} onChange={e => setTripDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Heure</label>
                  <input type="time" value={tripTime} onChange={e => setTripTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" />
                </div>
              </div>
              {tripTime && (
                <div className={cn("px-3 py-2 rounded-lg text-xs font-medium text-center", tarif.id === "a" ? "bg-green-500/10 text-green-400" : tarif.id === "b" ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400")}>
                  Tarif {tarif.name.toUpperCase()} appliqué (×{tarif.coef})
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Passagers</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPassengers(Math.max(1, passengers - 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 text-foreground hover:bg-white/5">-</button>
                    <span className="flex-1 text-center text-sm font-semibold text-foreground">{passengers}</span>
                    <button onClick={() => setPassengers(Math.min(8, passengers + 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 text-foreground hover:bg-white/5">+</button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Bagages</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLuggage(Math.max(0, luggage - 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 text-foreground hover:bg-white/5">-</button>
                    <span className="flex-1 text-center text-sm font-semibold text-foreground">{luggage}</span>
                    <button onClick={() => setLuggage(Math.min(10, luggage + 1))} className="w-10 h-10 rounded-lg bg-[#242424] border border-onyx-border/30 text-foreground hover:bg-white/5">+</button>
                  </div>
                </div>
              </div>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Instructions particulières..." rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
            </div>
          </Section>
          
          {/* SECTION: Véhicule */}
          <Section title="Véhicule" icon={Car}>
            <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50">
              {(allVehicles ?? []).map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} • {v.plate}</option>)}
            </select>
            {selectedVehicle && (
              <div className="p-3 rounded-xl bg-[#242424] grid grid-cols-2 gap-2">
                <div><p className="text-[10px] text-muted-foreground">Immatriculation</p><p className="text-sm text-foreground font-mono">{selectedVehicle.plate}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Capacité</p><p className="text-sm text-foreground">{selectedVehicle.capacity ?? 4} passagers</p></div>
              </div>
            )}
          </Section>
          
          {/* SECTION: Tarification */}
          <Section title="Tarification" icon={Euro}>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setPricingMode("forfait")} className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all", pricingMode === "forfait" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground")}>Forfait</button>
              <button onClick={() => setPricingMode("calcul")} className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all", pricingMode === "calcul" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground")}>Calcul km</button>
            </div>
            
            {pricingMode === "forfait" ? (
              <div className="space-y-2">
                {defaultForfaits.map(f => (
                  <button key={f.id} onClick={() => setSelectedForfaitId(f.id)}
                    className={cn("w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all", selectedForfaitId === f.id ? "bg-gold/10 border-gold/50" : "bg-[#242424] border-onyx-border/30")}>
                    <span className="text-sm text-foreground">{f.name}</span>
                    <span className="text-sm font-semibold text-gold">{formatPrice(f.price)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Distance (km)</label>
                    <input type="number" value={distanceKm} onChange={e => setDistanceKm(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground text-right focus:outline-none focus:border-gold/50" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Prix/km</label>
                    <input type="number" step="0.10" value={pricePerKm} onChange={e => setPricePerKm(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground text-right focus:outline-none focus:border-gold/50" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">Base: {distanceKm} km × {formatPrice(pricePerKm)} × {tarif.coef} = <span className="text-gold font-semibold">{formatPrice(pricing.baseHT)}</span></p>
              </div>
            )}
            
            {/* Supplements */}
            <div className="pt-3 border-t border-onyx-border/20">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Suppléments</p>
              <div className="grid grid-cols-2 gap-2">
                {supplements.map(s => (
                  <button key={s.id} onClick={() => setSupplements(supplements.map(sup => sup.id === s.id ? { ...sup, active: !sup.active } : sup))}
                    className={cn("flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all", s.active ? "bg-gold/10 border border-gold/30 text-gold" : "bg-[#242424] border border-onyx-border/30 text-muted-foreground")}>
                    <span>{s.label}</span><span className="font-semibold">+{s.price}€</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Discount */}
            <div className="pt-3 border-t border-onyx-border/20">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Remise commerciale</p>
              <div className="flex gap-2">
                <div className="flex rounded-lg overflow-hidden border border-onyx-border/30">
                  <button onClick={() => setDiscountType("percent")} className={cn("px-3 py-2 text-xs", discountType === "percent" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground")}><Percent className="h-3 w-3" /></button>
                  <button onClick={() => setDiscountType("euro")} className={cn("px-3 py-2 text-xs", discountType === "euro" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground")}>€</button>
                </div>
                <input type="number" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} placeholder="0"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#242424] border border-onyx-border/30 text-sm text-foreground text-right focus:outline-none focus:border-gold/50" />
              </div>
            </div>
            
            {/* Summary */}
            <div className="mt-4 p-4 rounded-xl bg-[#242424] border border-onyx-border/30 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sous-total HT</span><span className="text-foreground">{formatPrice(pricing.subtotalHT)}</span></div>
              {pricing.discountAmount > 0 && (
                <div className="flex justify-between text-sm"><span className="text-rose-400">Remise</span><span className="text-rose-400">-{formatPrice(pricing.discountAmount)}</span></div>
              )}
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total HT</span>
                <span className="text-foreground">
                  {pricing.discountAmount > 0 && <span className="line-through text-muted-foreground mr-2">{formatPrice(pricing.originalHT)}</span>}
                  {formatPrice(pricing.totalHT)}
                </span>
              </div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">TVA 10%</span><span className="text-foreground">{formatPrice(pricing.tva)}</span></div>
              <div className="pt-2 border-t border-onyx-border/20 flex justify-between"><span className="font-semibold text-foreground">Total TTC</span><span className="text-lg font-bold text-gold">{formatPrice(pricing.totalTTC)}</span></div>
            </div>
          </Section>
        </div>
      )}
      
      {/* PDF Preview */}
      {tab === "apercu" && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-md mx-auto bg-white rounded-xl p-6 text-black shadow-lg">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
              <div>
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600 mb-2">
                  {selectedDriver?.firstName?.[0] ?? "N"}{selectedDriver?.lastName?.[0] ?? "X"}
                </div>
                <p className="text-sm font-semibold">{selectedDriver?.firstName ?? "NoX"} {selectedDriver?.lastName ?? "VTC"}</p>
                <p className="text-[10px] text-gray-500">Carte VTC : {selectedDriver?.cardNumber ?? "Non renseigné"}</p>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-bold text-gray-800">BON DE RÉSERVATION</h2>
                <p className="text-xs text-gray-500">{brNumber}</p>
                <p className="text-[10px] text-gray-400">Établi le {formatDateFr(creationDate)} à {formatTimeFr(creationDate)}</p>
              </div>
            </div>
            
            {/* Parties */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase mb-1">Émetteur</p>
                <p className="text-sm font-semibold">{selectedDriver?.firstName ?? ""} {selectedDriver?.lastName ?? ""}</p>
                <p className="text-[10px] text-gray-500">{selectedDriver?.phone ?? ""}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase mb-1">Client</p>
                <p className="text-sm font-semibold">
                  {selectedClient ? (selectedClient.type === "particulier" ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}` : selectedClient.raisonSociale ?? "") : "Non sélectionné"}
                </p>
                <p className="text-[10px] text-gray-500">{selectedClient?.phone ?? ""}</p>
              </div>
            </div>
            
            {/* Trip */}
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-[10px] text-gray-400 uppercase mb-2">Trajet</p>
              <div className="flex items-center gap-2 text-sm mb-1"><MapPin className="h-3 w-3 text-green-500" /><span>{departure || "Départ non défini"}</span></div>
              <div className="flex items-center gap-2 text-sm"><Navigation className="h-3 w-3 text-rose-500" /><span>{arrival || "Arrivée non définie"}</span></div>
              <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{tripDate || "Date"}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{tripTime || "Heure"}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{passengers} pax</span>
              </div>
            </div>
            
            {/* Vehicle */}
            <div className="mb-6 p-3 bg-gray-50 rounded-lg flex items-center gap-3">
              <Car className="h-5 w-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{selectedVehicle?.brand ?? ""} {selectedVehicle?.model ?? ""}</p>
                <p className="text-[10px] text-gray-500 font-mono">{selectedVehicle?.plate ?? ""} • Capacité : {selectedVehicle?.capacity ?? 4} passagers</p>
              </div>
            </div>
            
            {/* Pricing */}
            <div className="mb-6 p-3 border border-gray-200 rounded-lg">
              <div className="flex justify-between text-sm mb-1"><span>Total HT</span><span>{formatPrice(pricing.totalHT)}</span></div>
              <div className="flex justify-between text-sm mb-1"><span>TVA 10%</span><span>{formatPrice(pricing.tva)}</span></div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200"><span>Total TTC</span><span className="text-amber-600">{formatPrice(pricing.totalTTC)}</span></div>
            </div>
            
            {/* Footer */}
            <div className="pt-4 border-t border-gray-200 text-center">
              <p className="text-[8px] text-gray-400">Document généré via NoX VTC</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="px-4 py-4 border-t border-onyx-border/30 bg-[#0d0d0d]">
        <button onClick={handleGenerate} className="w-full py-3.5 rounded-full bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors flex items-center justify-center gap-2">
          <Eye className="h-4 w-4" /> Générer le bon de réservation
        </button>
        <div className="flex gap-3 mt-3">
          <button className="flex-1 py-2.5 rounded-xl border border-onyx-border/30 text-muted-foreground text-xs font-medium hover:bg-white/5 flex items-center justify-center gap-1.5">
            <Send className="h-3.5 w-3.5" /> Email
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

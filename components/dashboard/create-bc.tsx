"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ChevronLeft,
  ChevronDown,
  FileText,
  Link2,
  MessageSquare,
  Phone,
  Copy,
  Check,
  MapPin,
  Navigation,
  Plus,
  Trash2,
  Car,
  Users,
  Euro,
  Eye,
  Save,
  Send,
  Download,
  Share2,
  Building2,
  User,
  Search,
  Shield,
  Sparkles,
  Info,
  Route,
  Clock,
  Calendar,
  Percent,
  Tag,
  CreditCard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { allClients, allDrivers, allVehicles, type Client, type Driver, type Vehicle } from "./data"
import { toast } from "sonner"

// ============================================================================
// TYPES
// ============================================================================

type FlowStep = "menu" | "link" | "form"
type FormTab = "formulaire" | "apercu"

interface Supplement {
  id: string
  label: string
  price: number
  enabled: boolean
}

interface Stop {
  id: string
  address: string
}

interface Forfait {
  id: string
  name: string
  price: number
}

// ============================================================================
// SIMULATED PROFILE DATA (from Reglages > Profil Entreprise)
// ============================================================================

const emetteurProfile = {
  logo: null as string | null,
  initials: "NV",
  denomination: "NoX VTC SAS",
  siren: "912 345 678",
  tvaIntra: "FR12 912345678",
  adresse: "42 Avenue des Champs-Élysées, 75008 Paris",
  email: "contact@nox-vtc.fr",
  phone: "+33 1 23 45 67 89",
}

// Grille tarifaire (from Reglages > Mes Grilles Tarifaires)
const tarifGrille = {
  priseEnCharge: 5,
  tarifKm: 2.5,
  tarifAttente: 0.5,
  courseMinimum: 15,
  tranches: [
    { id: "a", name: "Tarif A — Journée", startTime: "07:00", endTime: "20:59", coefficient: 1.00 },
    { id: "b", name: "Tarif B — Nuit", startTime: "21:00", endTime: "06:59", coefficient: 1.25 },
    { id: "c", name: "Tarif C — Dimanche & Fériés", startTime: "00:00", endTime: "23:59", coefficient: 1.50 },
  ],
}

// Forfaits fixes (from Reglages)
const forfaits: Forfait[] = [
  { id: "none", name: "Calcul au kilomètre", price: 0 },
  { id: "cdg", name: "Paris → CDG", price: 75 },
  { id: "orly", name: "Paris → Orly", price: 55 },
  { id: "defense", name: "Paris → La Défense", price: 45 },
  { id: "versailles", name: "Paris → Versailles", price: 65 },
]

// Supplements configurables
const defaultSupplements: Supplement[] = [
  { id: "bagage", label: "Bagage volumineux", price: 5, enabled: false },
  { id: "animal", label: "Animal de compagnie", price: 10, enabled: false },
  { id: "siege", label: "Siège enfant", price: 8, enabled: false },
  { id: "pancarte", label: "Accueil pancarte", price: 15, enabled: false },
]

// CGV dynamiques (from Reglages > Mes CGV)
const cgvContent = `• Paiement exigé avant l'exécution de la course (CB, Apple Pay, Espèces)
• Délai de règlement : Comptant
• Annulation gratuite jusqu'à 2 heures avant la prise en charge
• En cas d'annulation tardive : facturation de 50% du montant TTC
• Temps d'attente gratuit : 10 minutes à la prise en charge
• Au-delà : facturation de 0,50 €/min supplémentaire
• No-show (client absent) : facturation de 50% du montant TTC`

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateBRNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0")
  return `BR-${year}-${month}-${seq}`
}

function formatDateFR(date: Date): string {
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatTimeFR(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`
}

function formatPrice(value: number): string {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

/**
 * Detects applicable tariff based on pickup time.
 * Handles midnight crossing (21:00 -> 06:59).
 */
function detectTarif(time: string, dayOfWeek: number): { id: string; name: string; coefficient: number } {
  // Priority: Tarif C (Dimanche/Férié) > Tarif B (Nuit) > Tarif A (Jour)
  if (dayOfWeek === 0) {
    return { id: "c", name: "Tarif C — Dimanche", coefficient: 1.50 }
  }
  
  if (!time) return { id: "a", name: "Tarif A — Journée", coefficient: 1.00 }
  
  const [hours, minutes] = time.split(":").map(Number)
  const timeInMinutes = hours * 60 + minutes
  
  // Tarif B: 21:00 (1260min) to 06:59 (419min) - spans midnight
  const nightStart = 21 * 60 // 1260
  const nightEnd = 6 * 60 + 59 // 419
  
  if (timeInMinutes >= nightStart || timeInMinutes <= nightEnd) {
    return { id: "b", name: "Tarif B — Nuit", coefficient: 1.25 }
  }
  
  return { id: "a", name: "Tarif A — Journée", coefficient: 1.00 }
}

function getVehicleCapacity(category: string): number {
  switch (category) {
    case "van": return 7
    case "suv": return 5
    case "berline": return 4
    case "citadine": return 3
    default: return 4
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface CreateBCProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateBC({ isOpen, onClose }: CreateBCProps) {
  // Flow state
  const [step, setStep] = useState<FlowStep>("menu")
  const [activeTab, setActiveTab] = useState<FormTab>("formulaire")
  
  // Link sharing state
  const [linkCopied, setLinkCopied] = useState(false)
  const [selectedClientForLink, setSelectedClientForLink] = useState<string>("")
  const [customContact, setCustomContact] = useState("")
  
  // Form state - Document metadata
  const [brNumber] = useState(generateBRNumber)
  const [creationDate] = useState(new Date())
  const [validite, setValidite] = useState("7j")
  const [statut, setStatut] = useState<"attente" | "confirme" | "annule">("attente")
  
  // Form state - Driver selection
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [driverSearchOpen, setDriverSearchOpen] = useState(false)
  const [driverSearchQuery, setDriverSearchQuery] = useState("")
  
  // Form state - Client selection
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [clientSearchOpen, setClientSearchOpen] = useState(false)
  const [clientSearchQuery, setClientSearchQuery] = useState("")
  
  // Form state - Trip details
  const [departure, setDeparture] = useState("")
  const [arrival, setArrival] = useState("")
  const [stops, setStops] = useState<Stop[]>([])
  const [tripDate, setTripDate] = useState("")
  const [tripTime, setTripTime] = useState("")
  const [instructions, setInstructions] = useState("")
  
  // Simulated map calculations (auto-filled, read-only)
  const [distance, setDistance] = useState(0)
  const [duration, setDuration] = useState(0)
  
  // Form state - Vehicle selection
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("")
  const [vehicleSearchOpen, setVehicleSearchOpen] = useState(false)
  
  // Form state - Pricing
  const [selectedForfaitId, setSelectedForfaitId] = useState<string>("none")
  const [manualPrice, setManualPrice] = useState<number | null>(null)
  const [supplements, setSupplements] = useState<Supplement[]>(defaultSupplements)
  const [remiseEnabled, setRemiseEnabled] = useState(false)
  const [remiseType, setRemiseType] = useState<"%" | "€">("%")
  const [remiseValue, setRemiseValue] = useState(0)
  
  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    emetteur: true,
    destinataire: true,
    trajet: true,
    vehicule: true,
    tarification: true,
    cgv: true,
  })
  
  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================
  
  const selectedDriver = useMemo(() => 
    allDrivers.find(d => d.id === selectedDriverId), 
    [selectedDriverId]
  )
  
  const selectedClient = useMemo(() => 
    allClients.find(c => c.id === selectedClientId), 
    [selectedClientId]
  )
  
  const selectedVehicle = useMemo(() => 
    allVehicles.find(v => v.id === selectedVehicleId), 
    [selectedVehicleId]
  )
  
  const filteredDrivers = useMemo(() => 
    allDrivers.filter(d => 
      d.name.toLowerCase().includes(driverSearchQuery.toLowerCase())
    ),
    [driverSearchQuery]
  )
  
  const filteredClients = useMemo(() => 
    allClients.filter(c => {
      const searchTerm = clientSearchQuery.toLowerCase()
      if (c.type === "particulier") {
        return `${c.prenom} ${c.nom}`.toLowerCase().includes(searchTerm)
      }
      return c.raisonSociale?.toLowerCase().includes(searchTerm)
    }),
    [clientSearchQuery]
  )
  
  const vehiclesInService = useMemo(() => 
    allVehicles.filter(v => v.inService),
    []
  )
  
  // Tarif detection based on time and day
  const detectedTarif = useMemo(() => {
    if (!tripDate || !tripTime) return detectTarif("", 1)
    const date = new Date(tripDate)
    return detectTarif(tripTime, date.getDay())
  }, [tripDate, tripTime])
  
  // Calculate price
  const calculatedPrice = useMemo(() => {
    const forfait = forfaits.find(f => f.id === selectedForfaitId)
    
    if (forfait && forfait.id !== "none") {
      return forfait.price
    }
    
    // Calcul au km
    let base = tarifGrille.priseEnCharge + (distance * tarifGrille.tarifKm)
    base = Math.max(base, tarifGrille.courseMinimum)
    base *= detectedTarif.coefficient
    
    return Math.round(base * 100) / 100
  }, [selectedForfaitId, distance, detectedTarif])
  
  const finalPriceHT = useMemo(() => {
    const basePrice = manualPrice !== null ? manualPrice : calculatedPrice
    const supplementsTotal = supplements.filter(s => s.enabled).reduce((sum, s) => sum + s.price, 0)
    let total = basePrice + supplementsTotal
    
    if (remiseEnabled && remiseValue > 0) {
      if (remiseType === "%") {
        total -= total * (remiseValue / 100)
      } else {
        total -= remiseValue
      }
    }
    
    return Math.max(0, Math.round(total * 100) / 100)
  }, [manualPrice, calculatedPrice, supplements, remiseEnabled, remiseType, remiseValue])
  
  const tva = useMemo(() => Math.round(finalPriceHT * 0.10 * 100) / 100, [finalPriceHT])
  const finalPriceTTC = useMemo(() => Math.round((finalPriceHT + tva) * 100) / 100, [finalPriceHT, tva])
  
  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleClose = () => {
    setStep("menu")
    setActiveTab("formulaire")
    onClose()
  }
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://nox.vtc/book/${selectedClientForLink || "nouveau"}`)
    setLinkCopied(true)
    toast.success("Lien copié dans le presse-papier")
    setTimeout(() => setLinkCopied(false), 2000)
  }
  
  const handleSendSMS = () => {
    toast.success("SMS envoyé avec succès")
    handleClose()
  }
  
  const handleSendWhatsApp = () => {
    toast.success("Message WhatsApp envoyé")
    handleClose()
  }
  
  const handleSaveDraft = () => {
    toast.success("Brouillon sauvegardé")
  }
  
  const handleGenerate = () => {
    setActiveTab("apercu")
    toast.success("Bon de réservation généré avec succès")
  }
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }
  
  const toggleSupplement = (id: string) => {
    setSupplements(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }
  
  const addStop = () => {
    setStops(prev => [...prev, { id: crypto.randomUUID(), address: "" }])
  }
  
  const removeStop = (id: string) => {
    setStops(prev => prev.filter(s => s.id !== id))
  }
  
  const updateStop = (id: string, address: string) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, address } : s))
  }
  
  // Simulate map calculation when addresses change
  const simulateMapCalculation = () => {
    if (departure && arrival) {
      // Simulated values
      setDistance(Math.floor(Math.random() * 30) + 10)
      setDuration(Math.floor(Math.random() * 45) + 15)
    }
  }
  
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  const SectionHeader = ({ title, icon: Icon, section }: { title: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; section: keyof typeof expandedSections }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between px-4 py-3 bg-[#1A1A1A] border-b border-onyx-border/30"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gold" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedSections[section] && "rotate-180")} strokeWidth={1.5} />
    </button>
  )
  
  const ReadOnlyField = ({ label, value, tag }: { label: string; value: string; tag?: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-onyx-border/20 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {tag && (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gold/10 text-gold border border-gold/20">{tag}</span>
        )}
        <span className="text-[12px] text-foreground font-medium">{value}</span>
      </div>
    </div>
  )
  
  // ============================================================================
  // STEP 1: MENU (Bottom Sheet opaque)
  // ============================================================================
  
  if (!isOpen) return null
  
  if (step === "menu") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-[#0d0d0d] flex items-end justify-center"
        onClick={handleClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-[#0d0d0d] rounded-t-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
          </div>
          
          {/* Header */}
          <div className="px-5 pt-2 pb-4">
            <h2 className="text-base font-bold text-foreground">Nouveau Bon de Réservation</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Choisissez votre méthode de création</p>
          </div>
          
          {/* Options */}
          <div className="px-5 pb-4 space-y-3">
            {/* Option 1: Saisie manuelle */}
            <button
              onClick={() => setStep("form")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 hover:border-gold/30 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-gold" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Créer un bon de réservation</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Saisie du bon par le chauffeur</p>
              </div>
            </button>
            
            {/* Option 2: Envoyer lien */}
            <button
              onClick={() => setStep("link")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 hover:border-gold/30 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                <Link2 className="h-5 w-5 text-gold" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Envoyer un bon de réservation</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Lien de saisie pour le passager</p>
              </div>
            </button>
          </div>
          
          {/* Info tip */}
          <div className="mx-5 mb-5 px-3 py-2.5 rounded-xl bg-gold/5 border border-gold/15 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-gold shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-[10px] text-gold/80 leading-relaxed">
              Gain de temps : automatisez la saisie des données clients en envoyant un lien personnalisé.
            </p>
          </div>
          
          {/* Close button */}
          <div className="px-5 pb-6">
            <button
              onClick={handleClose}
              className="w-full py-3 rounded-xl border border-onyx-border/30 text-sm font-medium text-muted-foreground hover:bg-white/5 active:scale-[0.98] transition-all"
            >
              Annuler
            </button>
          </div>
        </motion.div>
      </motion.div>
    )
  }
  
  // ============================================================================
  // STEP 2: LINK SHARING (Full screen opaque)
  // ============================================================================
  
  if (step === "link") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-[#0d0d0d] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d]">
          <button onClick={() => setStep("menu")} className="p-2 -ml-2 rounded-lg hover:bg-white/5 active:scale-95 transition-all">
            <ChevronLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-foreground">Partage du lien</h1>
            <p className="text-[10px] text-muted-foreground">Envoyez un lien de réservation au client</p>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {/* Destinataire section */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Destinataire</p>
            
            {/* Client selector */}
            <div className="relative">
              <select
                value={selectedClientForLink}
                onChange={(e) => setSelectedClientForLink(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground appearance-none focus:outline-none focus:border-gold/50"
                style={{ fontSize: "16px" }}
              >
                <option value="">Sélectionner un client existant...</option>
                {allClients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.type === "particulier" ? `${c.civilite} ${c.prenom} ${c.nom}` : c.raisonSociale}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" strokeWidth={1.5} />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-onyx-border/30" />
              <span className="text-[10px] text-muted-foreground uppercase">ou</span>
              <div className="flex-1 h-px bg-onyx-border/30" />
            </div>
            
            {/* Custom contact */}
            <input
              type="text"
              value={customContact}
              onChange={(e) => setCustomContact(e.target.value)}
              placeholder="Saisir email ou téléphone..."
              className="w-full px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
              style={{ fontSize: "16px" }}
            />
          </div>
          
          {/* Link preview */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lien de réservation</p>
            
            <div className="flex items-center gap-2 p-4 rounded-xl bg-[#1A1A1A] border border-gold/20">
              <Link2 className="h-4 w-4 text-gold shrink-0" strokeWidth={1.5} />
              <span className="flex-1 text-sm text-foreground font-mono truncate">
                nox.vtc/book/{selectedClientForLink || "nouveau"}
              </span>
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg bg-gold/10 hover:bg-gold/20 active:scale-95 transition-all"
              >
                {linkCopied ? (
                  <Check className="h-4 w-4 text-green-400" strokeWidth={1.5} />
                ) : (
                  <Copy className="h-4 w-4 text-gold" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 py-4 border-t border-onyx-border/30 bg-[#0d0d0d] space-y-3">
          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSendSMS}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-gold text-gold font-semibold text-sm hover:bg-gold/5 active:scale-[0.98] transition-all"
            >
              <Phone className="h-4 w-4" strokeWidth={1.5} />
              Par SMS
            </button>
            <button
              onClick={handleSendWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gold text-black font-semibold text-sm hover:bg-gold/90 active:scale-[0.98] transition-all"
            >
              <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
              Par WhatsApp
            </button>
          </div>
          
          {/* Info text */}
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Le client recevra un lien sécurisé pour remplir ses informations de trajet.
          </p>
        </div>
      </motion.div>
    )
  }
  
  // ============================================================================
  // STEP 3: FORM (Saisie Manuelle NoX Intelligent)
  // ============================================================================
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-[#0d0d0d] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d]">
        <button onClick={() => setStep("menu")} className="p-2 -ml-2 rounded-lg hover:bg-white/5 active:scale-95 transition-all">
          <ChevronLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Nouveau Bon de Réservation</h1>
          <p className="text-[10px] text-muted-foreground font-mono">{brNumber}</p>
        </div>
        <button onClick={handleClose} className="p-2 rounded-lg hover:bg-white/5 active:scale-95 transition-all">
          <X className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-onyx-border/30 bg-[#0d0d0d]">
        {(["formulaire", "apercu"] as FormTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 text-sm font-medium transition-colors relative",
              activeTab === tab ? "text-gold" : "text-muted-foreground"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              {tab === "formulaire" ? <FileText className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
              {tab === "formulaire" ? "Formulaire" : "Aperçu PDF"}
            </div>
            {activeTab === tab && (
              <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "formulaire" ? (
            <motion.div
              key="formulaire"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="pb-32"
            >
              {/* Document Metadata */}
              <div className="px-4 py-3 bg-[#1A1A1A] border-b border-onyx-border/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                    <span className="text-[11px] text-muted-foreground">{formatDateFR(creationDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                    <span className="text-[11px] text-muted-foreground">{formatTimeFR(creationDate)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                    statut === "attente" && "bg-gold/20 text-gold",
                    statut === "confirme" && "bg-green-500/20 text-green-400",
                    statut === "annule" && "bg-rose-500/20 text-rose-400"
                  )}>
                    {statut === "attente" ? "En attente" : statut === "confirme" ? "Confirmé" : "Annulé"}
                  </span>
                  <select
                    value={validite}
                    onChange={(e) => setValidite(e.target.value)}
                    className="ml-auto px-2 py-1 rounded-lg bg-[#242424] border border-onyx-border/30 text-[10px] text-foreground"
                  >
                    <option value="24h">Valide 24h</option>
                    <option value="48h">Valide 48h</option>
                    <option value="7j">Valide 7 jours</option>
                    <option value="30j">Valide 30 jours</option>
                  </select>
                </div>
              </div>
              
              {/* SECTION 1: ÉMETTEUR & CHAUFFEUR */}
              <SectionHeader title="Émetteur & Chauffeur" icon={Building2} section="emetteur" />
              {expandedSections.emetteur && (
                <div className="px-4 py-4 space-y-4 bg-[#0d0d0d]">
                  {/* Émetteur (read-only from profile) */}
                  <div className="p-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-gold">{emetteurProfile.initials}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{emetteurProfile.denomination}</p>
                        <p className="text-[10px] text-muted-foreground">{emetteurProfile.adresse}</p>
                      </div>
                    </div>
                    <ReadOnlyField label="SIREN" value={emetteurProfile.siren} tag="Factur-X" />
                    <ReadOnlyField label="TVA Intra" value={emetteurProfile.tvaIntra} tag="Factur-X" />
                    <ReadOnlyField label="Email" value={emetteurProfile.email} />
                    <ReadOnlyField label="Téléphone" value={emetteurProfile.phone} />
                  </div>
                  
                  {/* Chauffeur selector */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Chauffeur assigné</p>
                    <div className="relative">
                      <button
                        onClick={() => setDriverSearchOpen(!driverSearchOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 hover:border-gold/30 transition-colors"
                      >
                        {selectedDriver ? (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                              <span className="text-xs font-bold text-gold">{selectedDriver.initials}</span>
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-foreground">{selectedDriver.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">Carte Pro: VTC-{selectedDriver.id.padStart(6, "0")}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sélectionner le chauffeur...</span>
                        )}
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", driverSearchOpen && "rotate-180")} strokeWidth={1.5} />
                      </button>
                      
                      {driverSearchOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A1A] border border-onyx-border/30 rounded-xl overflow-hidden z-10 shadow-xl">
                          <div className="p-2 border-b border-onyx-border/30">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                              <input
                                type="text"
                                value={driverSearchQuery}
                                onChange={(e) => setDriverSearchQuery(e.target.value)}
                                placeholder="Rechercher..."
                                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                                style={{ fontSize: "16px" }}
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {filteredDrivers.map(driver => (
                              <button
                                key={driver.id}
                                onClick={() => {
                                  setSelectedDriverId(driver.id)
                                  setDriverSearchOpen(false)
                                  setDriverSearchQuery("")
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                                  <span className="text-xs font-bold text-gold">{driver.initials}</span>
                                </div>
                                <div className="text-left flex-1">
                                  <p className="text-sm font-medium text-foreground">{driver.name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {driver.online ? "En ligne" : "Hors ligne"}
                                  </p>
                                </div>
                                {selectedDriverId === driver.id && (
                                  <Check className="h-4 w-4 text-gold" strokeWidth={1.5} />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* SECTION 2: DESTINATAIRE */}
              <SectionHeader title="Destinataire" icon={User} section="destinataire" />
              {expandedSections.destinataire && (
                <div className="px-4 py-4 space-y-4 bg-[#0d0d0d]">
                  {/* Client search */}
                  <div className="relative">
                    <button
                      onClick={() => setClientSearchOpen(!clientSearchOpen)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 hover:border-gold/30 transition-colors"
                    >
                      {selectedClient ? (
                        <div className="flex items-center gap-3">
                          {selectedClient.type === "professionnel" ? (
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-blue-400" strokeWidth={1.5} />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                              <span className="text-xs font-bold text-gold">
                                {selectedClient.prenom?.[0]}{selectedClient.nom?.[0]}
                              </span>
                            </div>
                          )}
                          <div className="text-left">
                            <p className="text-sm font-medium text-foreground">
                              {selectedClient.type === "particulier" 
                                ? `${selectedClient.civilite} ${selectedClient.prenom} ${selectedClient.nom}`
                                : selectedClient.raisonSociale}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{selectedClient.email}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                          <span className="text-sm text-muted-foreground">Rechercher un client...</span>
                        </div>
                      )}
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", clientSearchOpen && "rotate-180")} strokeWidth={1.5} />
                    </button>
                    
                    {clientSearchOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A1A] border border-onyx-border/30 rounded-xl overflow-hidden z-10 shadow-xl">
                        <div className="p-2 border-b border-onyx-border/30">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                            <input
                              type="text"
                              value={clientSearchQuery}
                              onChange={(e) => setClientSearchQuery(e.target.value)}
                              placeholder="Rechercher par nom ou raison sociale..."
                              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                              style={{ fontSize: "16px" }}
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredClients.map(client => (
                            <button
                              key={client.id}
                              onClick={() => {
                                setSelectedClientId(client.id)
                                setClientSearchOpen(false)
                                setClientSearchQuery("")
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                            >
                              {client.type === "professionnel" ? (
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                  <Building2 className="h-4 w-4 text-blue-400" strokeWidth={1.5} />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                                  <span className="text-xs font-bold text-gold">{client.prenom?.[0]}{client.nom?.[0]}</span>
                                </div>
                              )}
                              <div className="text-left flex-1">
                                <p className="text-sm font-medium text-foreground">
                                  {client.type === "particulier" ? `${client.civilite} ${client.prenom} ${client.nom}` : client.raisonSociale}
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] text-muted-foreground">{client.email}</p>
                                  {client.tag && (
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[8px] font-bold",
                                      client.tag === "VIP" ? "bg-gold/20 text-gold" : "bg-blue-500/20 text-blue-400"
                                    )}>
                                      {client.tag}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {selectedClientId === client.id && (
                                <Check className="h-4 w-4 text-gold" strokeWidth={1.5} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Auto-filled client info (read-only) */}
                  {selectedClient && (
                    <div className="p-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30">
                      {selectedClient.type === "professionnel" ? (
                        <>
                          <ReadOnlyField label="Raison sociale" value={selectedClient.raisonSociale || ""} />
                          <ReadOnlyField label="SIREN" value={selectedClient.siren || "—"} tag="Factur-X" />
                          {selectedClient.tvaIntra && (
                            <ReadOnlyField label="TVA Intra" value={selectedClient.tvaIntra} tag="Factur-X" />
                          )}
                        </>
                      ) : (
                        <ReadOnlyField label="Nom complet" value={`${selectedClient.civilite} ${selectedClient.prenom} ${selectedClient.nom}`} />
                      )}
                      <ReadOnlyField label="Email" value={selectedClient.email} />
                      <ReadOnlyField label="Téléphone" value={selectedClient.phone} />
                      <ReadOnlyField 
                        label="Adresse" 
                        value={`${selectedClient.billingAddress.rue}, ${selectedClient.billingAddress.codePostal} ${selectedClient.billingAddress.ville}`} 
                      />
                    </div>
                  )}
                </div>
              )}
              
              {/* SECTION 3: TRAJET */}
              <SectionHeader title="Trajet" icon={Route} section="trajet" />
              {expandedSections.trajet && (
                <div className="px-4 py-4 space-y-4 bg-[#0d0d0d]">
                  {/* Departure */}
                  <div className="relative">
                    <div className="absolute left-4 top-3.5 w-3 h-3 rounded-full bg-green-500 border-2 border-green-300" />
                    <input
                      type="text"
                      value={departure}
                      onChange={(e) => { setDeparture(e.target.value); simulateMapCalculation() }}
                      placeholder="Adresse de départ..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                  
                  {/* Stops */}
                  {stops.map((stop, index) => (
                    <div key={stop.id} className="relative flex items-center gap-2">
                      <div className="absolute left-4 top-3.5 w-3 h-3 rounded-full bg-gold border-2 border-gold/50" />
                      <input
                        type="text"
                        value={stop.address}
                        onChange={(e) => updateStop(stop.id, e.target.value)}
                        placeholder={`Étape ${index + 1}...`}
                        className="flex-1 pl-10 pr-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                        style={{ fontSize: "16px" }}
                      />
                      <button
                        onClick={() => removeStop(stop.id)}
                        className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400 active:scale-95 transition-all"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                  
                  {/* Add stop button */}
                  <button
                    onClick={addStop}
                    className="flex items-center gap-2 px-4 py-2 text-gold text-sm font-medium hover:bg-gold/5 rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.5} />
                    Ajouter une étape
                  </button>
                  
                  {/* Arrival */}
                  <div className="relative">
                    <div className="absolute left-4 top-3.5 w-3 h-3 rounded-full bg-rose-500 border-2 border-rose-300" />
                    <input
                      type="text"
                      value={arrival}
                      onChange={(e) => { setArrival(e.target.value); simulateMapCalculation() }}
                      placeholder="Adresse d'arrivée..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                  
                  {/* Map simulation (placeholder) */}
                  <div className="h-40 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="h-8 w-8 text-gold/30 mx-auto mb-2" strokeWidth={1.5} />
                      <p className="text-[11px] text-muted-foreground">Aperçu de l&apos;itinéraire</p>
                    </div>
                  </div>
                  
                  {/* Auto-calculated distance & duration (read-only) */}
                  {distance > 0 && (
                    <div className="flex gap-3">
                      <div className="flex-1 p-3 rounded-xl bg-gold/5 border border-gold/20">
                        <p className="text-[10px] text-gold/70 uppercase mb-1">Distance</p>
                        <p className="text-lg font-bold text-gold">{distance} km</p>
                      </div>
                      <div className="flex-1 p-3 rounded-xl bg-gold/5 border border-gold/20">
                        <p className="text-[10px] text-gold/70 uppercase mb-1">Durée</p>
                        <p className="text-lg font-bold text-gold">{duration} min</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Date & Time */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Date de la course</p>
                      <input
                        type="date"
                        value={tripDate}
                        onChange={(e) => setTripDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50"
                        style={{ fontSize: "16px" }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Heure de prise en charge</p>
                      <input
                        type="time"
                        value={tripTime}
                        onChange={(e) => setTripTime(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50"
                        style={{ fontSize: "16px" }}
                      />
                    </div>
                  </div>
                  
                  {/* Instructions */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Instructions particulières</p>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Ex : Accueil avec pancarte, bagages volumineux..."
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50 resize-none"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>
              )}
              
              {/* SECTION 4: VÉHICULE */}
              <SectionHeader title="Véhicule" icon={Car} section="vehicule" />
              {expandedSections.vehicule && (
                <div className="px-4 py-4 space-y-4 bg-[#0d0d0d]">
                  <div className="relative">
                    <button
                      onClick={() => setVehicleSearchOpen(!vehicleSearchOpen)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 hover:border-gold/30 transition-colors"
                    >
                      {selectedVehicle ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                            <Car className="h-4 w-4 text-gold" strokeWidth={1.5} />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-foreground">{selectedVehicle.model}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{selectedVehicle.plate}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sélectionner un véhicule...</span>
                      )}
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", vehicleSearchOpen && "rotate-180")} strokeWidth={1.5} />
                    </button>
                    
                    {vehicleSearchOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A1A] border border-onyx-border/30 rounded-xl overflow-hidden z-10 shadow-xl">
                        <div className="max-h-48 overflow-y-auto">
                          {vehiclesInService.map(vehicle => (
                            <button
                              key={vehicle.id}
                              onClick={() => {
                                setSelectedVehicleId(vehicle.id)
                                setVehicleSearchOpen(false)
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                                <Car className="h-4 w-4 text-gold" strokeWidth={1.5} />
                              </div>
                              <div className="text-left flex-1">
                                <p className="text-sm font-medium text-foreground">{vehicle.model}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{vehicle.plate}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground capitalize">{vehicle.category}</span>
                              {selectedVehicleId === vehicle.id && (
                                <Check className="h-4 w-4 text-gold" strokeWidth={1.5} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Auto-filled vehicle info */}
                  {selectedVehicle && (
                    <div className="p-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30">
                      <ReadOnlyField label="Immatriculation" value={selectedVehicle.plate} />
                      <ReadOnlyField label="Catégorie" value={selectedVehicle.category.charAt(0).toUpperCase() + selectedVehicle.category.slice(1)} />
                      <ReadOnlyField label="Capacité" value={`${getVehicleCapacity(selectedVehicle.category)} places`} />
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-onyx-border/20">
                        <Shield className="h-3.5 w-3.5 text-green-400" strokeWidth={1.5} />
                        <span className="text-[10px] text-green-400 font-medium">Véhicule assuré</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* SECTION 5: TARIFICATION */}
              <SectionHeader title="Tarification" icon={Euro} section="tarification" />
              {expandedSections.tarification && (
                <div className="px-4 py-4 space-y-4 bg-[#0d0d0d]">
                  {/* Forfait selector */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Mode de tarification</p>
                    <select
                      value={selectedForfaitId}
                      onChange={(e) => setSelectedForfaitId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground appearance-none focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }}
                    >
                      {forfaits.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} {f.price > 0 ? `— ${formatPrice(f.price)}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Tarif indicator */}
                  {tripTime && (
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg",
                      detectedTarif.id === "a" && "bg-green-500/10 border border-green-500/20",
                      detectedTarif.id === "b" && "bg-blue-500/10 border border-blue-500/20",
                      detectedTarif.id === "c" && "bg-gold/10 border border-gold/20"
                    )}>
                      <Clock className={cn(
                        "h-4 w-4",
                        detectedTarif.id === "a" && "text-green-400",
                        detectedTarif.id === "b" && "text-blue-400",
                        detectedTarif.id === "c" && "text-gold"
                      )} strokeWidth={1.5} />
                      <span className={cn(
                        "text-[11px] font-medium",
                        detectedTarif.id === "a" && "text-green-400",
                        detectedTarif.id === "b" && "text-blue-400",
                        detectedTarif.id === "c" && "text-gold"
                      )}>
                        {detectedTarif.name} appliqué (Coeff. x{detectedTarif.coefficient.toFixed(2)})
                      </span>
                    </div>
                  )}
                  
                  {/* Base price (editable) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Prix de base HT</p>
                      {manualPrice !== null && (
                        <button
                          onClick={() => setManualPrice(null)}
                          className="text-[10px] text-gold hover:underline"
                        >
                          Réinitialiser
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={manualPrice !== null ? manualPrice : calculatedPrice}
                        onChange={(e) => setManualPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-3 pr-10 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground font-mono focus:outline-none focus:border-gold/50"
                        style={{ fontSize: "16px" }}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">
                      Calcul auto: Prise en charge {formatPrice(tarifGrille.priseEnCharge)} + {distance} km × {formatPrice(tarifGrille.tarifKm)}/km × {detectedTarif.coefficient}
                    </p>
                  </div>
                  
                  {/* Supplements */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Suppléments</p>
                    <div className="grid grid-cols-2 gap-2">
                      {supplements.map(supp => (
                        <button
                          key={supp.id}
                          onClick={() => toggleSupplement(supp.id)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all",
                            supp.enabled
                              ? "bg-gold/10 border-gold/30"
                              : "bg-[#1A1A1A] border-onyx-border/30 hover:border-gold/20"
                          )}
                        >
                          <span className={cn("text-[11px] font-medium", supp.enabled ? "text-gold" : "text-foreground")}>
                            {supp.label}
                          </span>
                          <span className={cn("text-[10px] font-mono", supp.enabled ? "text-gold" : "text-muted-foreground")}>
                            +{supp.price}€
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Remise */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Remise commerciale</p>
                      <button
                        onClick={() => setRemiseEnabled(!remiseEnabled)}
                        className={cn(
                          "w-10 h-5 rounded-full transition-colors relative",
                          remiseEnabled ? "bg-gold" : "bg-onyx-border/50"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                          remiseEnabled ? "translate-x-5" : "translate-x-0.5"
                        )} />
                      </button>
                    </div>
                    
                    {remiseEnabled && (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={remiseValue}
                          onChange={(e) => setRemiseValue(parseFloat(e.target.value) || 0)}
                          className="flex-1 px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground font-mono focus:outline-none focus:border-gold/50"
                          style={{ fontSize: "16px" }}
                        />
                        <div className="flex rounded-xl overflow-hidden border border-onyx-border/30">
                          <button
                            onClick={() => setRemiseType("%")}
                            className={cn(
                              "px-4 py-3 text-sm font-medium transition-colors",
                              remiseType === "%" ? "bg-gold text-black" : "bg-[#1A1A1A] text-muted-foreground"
                            )}
                          >
                            %
                          </button>
                          <button
                            onClick={() => setRemiseType("€")}
                            className={cn(
                              "px-4 py-3 text-sm font-medium transition-colors",
                              remiseType === "€" ? "bg-gold text-black" : "bg-[#1A1A1A] text-muted-foreground"
                            )}
                          >
                            €
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Price summary */}
                  <div className="p-4 rounded-xl bg-[#1A1A1A] border border-gold/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-muted-foreground">Base</span>
                      <span className={cn("text-sm font-mono", remiseEnabled && remiseValue > 0 && "line-through text-muted-foreground")}>
                        {formatPrice(manualPrice !== null ? manualPrice : calculatedPrice)}
                      </span>
                    </div>
                    {supplements.filter(s => s.enabled).map(s => (
                      <div key={s.id} className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-muted-foreground">{s.label}</span>
                        <span className="text-sm font-mono">+{formatPrice(s.price)}</span>
                      </div>
                    ))}
                    {remiseEnabled && remiseValue > 0 && (
                      <div className="flex items-center justify-between mb-2 text-green-400">
                        <span className="text-[11px]">Remise</span>
                        <span className="text-sm font-mono">
                          -{remiseType === "%" ? `${remiseValue}%` : formatPrice(remiseValue)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-onyx-border/30 pt-2 mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-muted-foreground">Total HT</span>
                        <span className="text-sm font-mono">{formatPrice(finalPriceHT)}</span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-muted-foreground">TVA (10%)</span>
                        <span className="text-sm font-mono">{formatPrice(tva)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-onyx-border/30 mt-2">
                        <span className="text-sm font-semibold text-foreground">TOTAL TTC</span>
                        <span className="text-lg font-bold text-gold font-mono">{formatPrice(finalPriceTTC)}</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-2">TVA applicable : 10% — Transport de personnes (Art. 279-b du CGI)</p>
                  </div>
                </div>
              )}
              
              {/* SECTION 6: CGV */}
              <SectionHeader title="Conditions Générales" icon={FileText} section="cgv" />
              {expandedSections.cgv && (
                <div className="px-4 py-4 bg-[#0d0d0d]">
                  <div className="p-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30">
                    <p className="text-[11px] text-foreground/90 whitespace-pre-line leading-relaxed">{cgvContent}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            // ============================================================================
            // APERÇU PDF
            // ============================================================================
            <motion.div
              key="apercu"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 pb-32"
            >
              <div className="bg-white rounded-xl overflow-hidden shadow-xl">
                {/* PDF Header */}
                <div className="px-6 py-5 border-b border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                        <span className="text-lg font-bold text-gray-600">{emetteurProfile.initials}</span>
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{emetteurProfile.denomination}</p>
                        <p className="text-xs text-gray-500">{emetteurProfile.adresse}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">BON DE RÉSERVATION</p>
                      <p className="text-xs text-gray-500 font-mono">{brNumber}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Établi le {formatDateFR(creationDate)} à {formatTimeFR(creationDate)}
                  </p>
                </div>
                
                {/* PDF Parties */}
                <div className="px-6 py-4 grid grid-cols-2 gap-6 border-b border-gray-200 bg-gray-50">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Émetteur</p>
                    <p className="text-sm font-semibold text-gray-900">{emetteurProfile.denomination}</p>
                    <p className="text-xs text-gray-600">SIREN : {emetteurProfile.siren}</p>
                    <p className="text-xs text-gray-600">{emetteurProfile.email}</p>
                    {selectedDriver && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-600">Chauffeur : {selectedDriver.name}</p>
                        <p className="text-xs text-gray-500 font-mono">Carte Pro : VTC-{selectedDriver.id.padStart(6, "0")}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Destinataire</p>
                    {selectedClient ? (
                      <>
                        <p className="text-sm font-semibold text-gray-900">
                          {selectedClient.type === "particulier" 
                            ? `${selectedClient.civilite} ${selectedClient.prenom} ${selectedClient.nom}`
                            : selectedClient.raisonSociale}
                        </p>
                        {selectedClient.type === "professionnel" && selectedClient.siren && (
                          <p className="text-xs text-gray-600">SIREN : {selectedClient.siren}</p>
                        )}
                        <p className="text-xs text-gray-600">{selectedClient.email}</p>
                        <p className="text-xs text-gray-600">{selectedClient.phone}</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Non renseigné</p>
                    )}
                  </div>
                </div>
                
                {/* PDF Course */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-3">Détails de la course</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-gray-700">{departure || "Départ non renseigné"}</span>
                    </div>
                    {stops.map((stop, i) => (
                      <div key={stop.id} className="flex items-center gap-2 ml-4">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-xs text-gray-700">{stop.address || `Étape ${i + 1}`}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs text-gray-700">{arrival || "Arrivée non renseignée"}</span>
                    </div>
                  </div>
                  <div className="flex gap-6 mt-3 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400">Date</p>
                      <p className="text-xs font-medium text-gray-900">{tripDate ? formatDateFR(new Date(tripDate)) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">Heure</p>
                      <p className="text-xs font-medium text-gray-900">{tripTime || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">Distance</p>
                      <p className="text-xs font-medium text-gray-900">{distance} km</p>
                    </div>
                  </div>
                  {selectedVehicle && (
                    <div className="flex gap-6 mt-3 pt-3 border-t border-gray-100">
                      <div>
                        <p className="text-[10px] text-gray-400">Véhicule</p>
                        <p className="text-xs font-medium text-gray-900">{selectedVehicle.model}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Immatriculation</p>
                        <p className="text-xs font-medium text-gray-900 font-mono">{selectedVehicle.plate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400">Capacité</p>
                        <p className="text-xs font-medium text-gray-900">{getVehicleCapacity(selectedVehicle.category)} places</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* PDF Pricing */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-3">Tarification</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Prestation</span>
                      <span className="text-xs text-gray-900 font-mono">{formatPrice(manualPrice !== null ? manualPrice : calculatedPrice)}</span>
                    </div>
                    {supplements.filter(s => s.enabled).map(s => (
                      <div key={s.id} className="flex justify-between">
                        <span className="text-xs text-gray-600">{s.label}</span>
                        <span className="text-xs text-gray-900 font-mono">+{formatPrice(s.price)}</span>
                      </div>
                    ))}
                    {remiseEnabled && remiseValue > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="text-xs">Remise</span>
                        <span className="text-xs font-mono">-{remiseType === "%" ? `${remiseValue}%` : formatPrice(remiseValue)}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-200 mt-3 pt-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">Total HT</span>
                      <span className="text-xs text-gray-900 font-mono">{formatPrice(finalPriceHT)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-600">TVA (10%)</span>
                      <span className="text-xs text-gray-900 font-mono">{formatPrice(tva)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="text-sm font-bold text-gray-900">TOTAL TTC</span>
                      <span className="text-sm font-bold text-amber-600 font-mono">{formatPrice(finalPriceTTC)}</span>
                    </div>
                  </div>
                </div>
                
                {/* PDF CGV */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Conditions générales</p>
                  <p className="text-[10px] text-gray-600 whitespace-pre-line leading-relaxed">{cgvContent}</p>
                </div>
                
                {/* PDF Footer */}
                <div className="px-6 py-3 flex justify-between items-center bg-gray-100">
                  <div className="flex items-center gap-4 text-[9px] text-gray-400">
                    {selectedDriver && (
                      <span>Carte VTC : VTC-{selectedDriver.id.padStart(6, "0")}</span>
                    )}
                    <span>SIREN : {emetteurProfile.siren}</span>
                  </div>
                  <p className="text-[9px] text-gray-400">Document généré via NoX VTC</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] px-4 py-4 bg-[#0d0d0d] border-t border-onyx-border/30">
        <div className="flex gap-3 mb-3">
          <button
            onClick={handleSaveDraft}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-onyx-border/30 text-foreground font-medium text-sm hover:bg-white/5 active:scale-[0.98] transition-all"
          >
            <Save className="h-4 w-4" strokeWidth={1.5} />
            Enregistrer brouillon
          </button>
          <button
            onClick={handleGenerate}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gold text-black font-semibold text-sm hover:bg-gold/90 active:scale-[0.98] transition-all"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.5} />
            Générer le bon
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => toast.success("Email envoyé")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-muted-foreground text-xs font-medium hover:bg-white/5 active:scale-[0.98] transition-all"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
            Email
          </button>
          <button
            onClick={() => toast.success("Lien copié")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-muted-foreground text-xs font-medium hover:bg-white/5 active:scale-[0.98] transition-all"
          >
            <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            Partager
          </button>
          <button
            onClick={() => toast.success("PDF téléchargé")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-muted-foreground text-xs font-medium hover:bg-white/5 active:scale-[0.98] transition-all"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            PDF
          </button>
        </div>
      </div>
    </motion.div>
  )
}

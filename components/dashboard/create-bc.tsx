"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ChevronLeft,
  ChevronRight,
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
  Briefcase,
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
  Edit3,
  CheckCheck,
  Route,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { allClients, allVehicles, type Client, type Vehicle } from "./data"
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

// ============================================================================
// SIMULATED PROFILE DATA (from settings)
// ============================================================================

const emetteurProfile = {
  logo: null as string | null,
  initials: "JD",
  denomination: "NoX VTC SAS",
  siren: "912 345 678",
  tvaIntra: "FR12 912345678",
  adresse: "42 Avenue des Champs-Élysées, 75008 Paris",
  email: "contact@nox-vtc.fr",
  phone: "+33 1 23 45 67 89",
  carteVTC: "VTC-075-2024-00142",
  rcProPolice: "AXA-PRO-2024-789456",
  rcProValid: true,
}

const tarifGrille = {
  priseEnCharge: 5,
  tarifKm: 2.5,
  tarifAttente: 0.5,
  courseMinimum: 15,
}

const defaultSupplements: Supplement[] = [
  { id: "bagage", label: "Bagage volumineux", price: 5, enabled: false },
  { id: "animal", label: "Animal de compagnie", price: 10, enabled: false },
  { id: "siege", label: "Siège bébé", price: 8, enabled: false },
  { id: "nuit", label: "Majoration nuit", price: 10, enabled: false },
]

const cgvContent = `• Paiement exigé avant l'exécution de la course (CB, Apple Pay, Espèces)
• Délai de règlement : Comptant
• Annulation gratuite jusqu'à 2 heures avant la prise en charge
• En cas d'annulation tardive : facturation de 50% du montant TTC
• Temps d'attente gratuit : 10 minutes à la prise en charge
• Au-delà : facturation de 0,50 €/min supplémentaire
• No-show (client absent) : facturation de 50% du montant TTC`

// ============================================================================
// HELPERS
// ============================================================================

function generateBRNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `BR-${year}-${month}-${seq}`
}

function formatDate(date: Date): string {
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount)
}

function simulateRoute(from: string, to: string, stops: Stop[]): { distance: number; duration: number } {
  if (!from || !to) return { distance: 0, duration: 0 }
  const base = (from.length + to.length) * 0.8
  const stopsExtra = stops.filter(s => s.address).length * 5
  const distance = Math.round((base + stopsExtra) * 10) / 10
  const duration = Math.round(distance * 2.2)
  return { distance, duration }
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SectionCard({
  title,
  subtitle,
  icon,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl bg-onyx-card border border-onyx-border/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon && <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">{icon}</div>}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{title}</span>
              {badge}
            </div>
            {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} strokeWidth={1.5} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-onyx-border/20">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CreateBCFlow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<FlowStep>("menu")
  const [tab, setTab] = useState<FormTab>("formulaire")
  const [copied, setCopied] = useState(false)

  // Form state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientSearch, setClientSearch] = useState("")
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [departure, setDeparture] = useState("")
  const [arrival, setArrival] = useState("")
  const [stops, setStops] = useState<Stop[]>([])
  const [courseDate, setCourseDate] = useState("")
  const [courseTime, setCourseTime] = useState("")
  const [passengers, setPassengers] = useState(1)
  const [luggage, setLuggage] = useState(0)
  const [instructions, setInstructions] = useState("")
  const [supplements, setSupplements] = useState<Supplement[]>(defaultSupplements)
  const [customPrice, setCustomPrice] = useState<number | null>(null)

  // Document metadata
  const [brNumber] = useState(generateBRNumber())
  const [creationDate] = useState(new Date())

  // Link sharing state
  const [linkClientSearch, setLinkClientSearch] = useState("")
  const [linkSelectedClient, setLinkSelectedClient] = useState<Client | null>(null)
  const [linkFreeContact, setLinkFreeContact] = useState("")
  const [linkSent, setLinkSent] = useState<"sms" | "whatsapp" | null>(null)

  // Calculations
  const routeInfo = useMemo(() => simulateRoute(departure, arrival, stops), [departure, arrival, stops])
  
  const calculatedPrice = useMemo(() => {
    if (routeInfo.distance === 0) return tarifGrille.courseMinimum
    const base = tarifGrille.priseEnCharge + (routeInfo.distance * tarifGrille.tarifKm)
    return Math.max(base, tarifGrille.courseMinimum)
  }, [routeInfo.distance])

  const activeSupplements = supplements.filter(s => s.enabled)
  const supplementsTotal = activeSupplements.reduce((sum, s) => sum + s.price, 0)
  const totalHT = (customPrice ?? calculatedPrice) + supplementsTotal
  const tva = totalHT * 0.1
  const totalTTC = totalHT + tva

  // Filtered clients for search
  const filteredClients = useMemo(() => {
    const search = clientSearch.toLowerCase()
    if (!search) return allClients.slice(0, 5)
    return allClients.filter(c => {
      const name = c.type === "particulier" ? `${c.prenom} ${c.nom}` : c.raisonSociale
      return name?.toLowerCase().includes(search) || c.email.toLowerCase().includes(search)
    }).slice(0, 5)
  }, [clientSearch])

  // Available vehicles (in service only)
  const availableVehicles = allVehicles.filter(v => v.inService)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://nox.vtc/book/${brNumber.toLowerCase()}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setStep("menu")
    setTab("formulaire")
    onClose()
  }

  const addStop = () => {
    setStops([...stops, { id: Date.now().toString(), address: "" }])
  }

  const updateStop = (id: string, address: string) => {
    setStops(stops.map(s => s.id === id ? { ...s, address } : s))
  }

  const removeStop = (id: string) => {
    setStops(stops.filter(s => s.id !== id))
  }

  const toggleSupplement = (id: string) => {
    setSupplements(supplements.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  const handleSendLink = (channel: "sms" | "whatsapp") => {
    setLinkSent(channel)
    toast.success(`Lien envoyé par ${channel === "sms" ? "SMS" : "WhatsApp"}`)
    setTimeout(() => handleClose(), 1500)
  }

  const handleSaveDraft = () => {
    toast.success("Brouillon sauvegardé")
  }

  const handleGenerate = () => {
    setTab("apercu")
    toast.success("Bon de réservation généré")
  }

  if (!open) return null

  // ============================================================================
  // STEP 1: MENU (Aiguillage)
  // ============================================================================
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
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-onyx-base rounded-t-3xl overflow-hidden"
        >
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3" />
          
          <div className="px-5 pt-4 pb-2">
            <h2 className="text-base font-bold text-foreground">Nouveau Bon de Réservation</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Choisissez votre méthode de création</p>
          </div>

          <div className="px-5 pb-4 space-y-3">
            {/* Option A: Saisie manuelle */}
            <button
              onClick={() => setStep("form")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-onyx-card border border-gold/20 hover:border-gold/40 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                <Edit3 className="h-5 w-5 text-gold" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <span className="font-semibold text-sm text-foreground">Saisie du bon de réservation</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Vous remplissez les détails de la course</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </button>

            {/* Option B: Lien client */}
            <button
              onClick={() => setStep("link")}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-onyx-card border border-onyx-border/30 hover:border-onyx-border active:scale-[0.98] transition-all text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center">
                <Link2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <span className="font-semibold text-sm text-foreground">Envoyer un lien de réservation</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Le client saisit lui-même les détails de la course</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </button>

            {/* Info tip */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gold/5 border border-gold/15">
              <Sparkles className="h-3.5 w-3.5 text-gold flex-shrink-0" strokeWidth={1.5} />
              <p className="text-[10px] text-gold/80">Gain de temps : automatisez la saisie des données clients</p>
            </div>
          </div>

          <div className="px-5 pb-6">
            <button onClick={handleClose} className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Annuler
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
    const bookingLink = `nox.vtc/book/${brNumber.toLowerCase()}`
    
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
            <p className="text-[10px] text-muted-foreground">Le client remplira lui-même sa réservation</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-white/5">
            <X className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {/* Client selector */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Destinataire</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <input
                type="text"
                value={linkSelectedClient ? (linkSelectedClient.type === "particulier" ? `${linkSelectedClient.prenom} ${linkSelectedClient.nom}` : linkSelectedClient.raisonSociale) : linkFreeContact}
                onChange={(e) => {
                  setLinkSelectedClient(null)
                  setLinkFreeContact(e.target.value)
                }}
                placeholder="Rechercher un client ou saisir email/téléphone..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                style={{ fontSize: "16px" }}
              />
            </div>
            {!linkSelectedClient && linkFreeContact.length > 0 && (
              <div className="rounded-xl bg-onyx-card border border-onyx-border/30 overflow-hidden">
                {allClients.filter(c => {
                  const name = c.type === "particulier" ? `${c.prenom} ${c.nom}` : c.raisonSociale
                  return name?.toLowerCase().includes(linkFreeContact.toLowerCase())
                }).slice(0, 3).map(client => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setLinkSelectedClient(client)
                      setLinkFreeContact("")
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-b border-onyx-border/20 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                      {client.type === "professionnel" ? (
                        <Building2 className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                      ) : (
                        <User className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-foreground">
                        {client.type === "particulier" ? `${client.prenom} ${client.nom}` : client.raisonSociale}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{client.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Link display */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Lien de réservation</label>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#1A1A1A] border border-gold/20">
              <Link2 className="h-4 w-4 text-gold flex-shrink-0" strokeWidth={1.5} />
              <span className="flex-1 text-sm text-gold font-mono truncate">{bookingLink}</span>
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg bg-gold/10 border border-gold/20 hover:bg-gold/20 active:scale-95 transition-all"
              >
                {copied ? (
                  <CheckCheck className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
                ) : (
                  <Copy className="h-4 w-4 text-gold" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-gold/5 border border-gold/15">
            <Info className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-[10px] text-gold/80 leading-relaxed">
              Le client recevra un lien sécurisé pour remplir ses informations de trajet. Vous serez notifié dès la soumission.
            </p>
          </div>

          {/* Success feedback */}
          <AnimatePresence>
            {linkSent && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              >
                <CheckCheck className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
                <p className="text-sm font-medium text-emerald-400">Lien envoyé avec succès</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="px-4 py-4 border-t border-onyx-border/30 bg-onyx-base space-y-3">
          <div className="flex gap-3">
            <button 
              onClick={() => handleSendLink("sms")}
              disabled={!linkSelectedClient && !linkFreeContact}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-gold/30 text-gold text-sm font-semibold hover:bg-gold/5 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              <Phone className="h-4 w-4" strokeWidth={1.5} />
              Par SMS
            </button>
            <button 
              onClick={() => handleSendLink("whatsapp")}
              disabled={!linkSelectedClient && !linkFreeContact}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gold text-onyx-base text-sm font-semibold hover:bg-gold/90 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
              Par WhatsApp
            </button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground">
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
          <p className="text-[10px] text-muted-foreground">{brNumber} • {formatDate(creationDate)}</p>
        </div>
        <button onClick={handleClose} className="p-2 rounded-lg hover:bg-white/5">
          <X className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-onyx-border/30">
        <button
          onClick={() => setTab("formulaire")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors relative",
            tab === "formulaire" ? "text-gold" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Formulaire
          {tab === "formulaire" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
        </button>
        <button
          onClick={() => setTab("apercu")}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors relative flex items-center justify-center gap-2",
            tab === "apercu" ? "text-gold" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Eye className="h-4 w-4" strokeWidth={1.5} />
          Aperçu PDF
          {tab === "apercu" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "formulaire" ? (
          <div className="px-4 py-5 space-y-4">
            {/* SECTION 1: ÉMETTEUR (Auto - Lecture seule) */}
            <SectionCard
              title="Émetteur"
              subtitle="Données issues de votre profil"
              icon={<Building2 className="h-4 w-4" strokeWidth={1.5} />}
              badge={<span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">AUTO</span>}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-gold">{emetteurProfile.initials}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{emetteurProfile.denomination}</p>
                    <p className="text-[11px] text-muted-foreground">SIREN {emetteurProfile.siren}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="px-3 py-2 rounded-lg bg-[#1A1A1A]">
                    <p className="text-muted-foreground">TVA Intra</p>
                    <p className="text-foreground font-mono">{emetteurProfile.tvaIntra}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-[#1A1A1A]">
                    <p className="text-muted-foreground">Carte VTC</p>
                    <p className="text-foreground font-mono text-[10px]">{emetteurProfile.carteVTC}</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{emetteurProfile.adresse}</p>
              </div>
            </SectionCard>

            {/* SECTION 2: DESTINATAIRE (Base Clients) */}
            <SectionCard
              title="Destinataire"
              subtitle="Sélectionnez depuis votre base clients"
              icon={<User className="h-4 w-4" strokeWidth={1.5} />}
            >
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <input
                    type="text"
                    value={selectedClient ? (selectedClient.type === "particulier" ? `${selectedClient.prenom} ${selectedClient.nom}` : selectedClient.raisonSociale || "") : clientSearch}
                    onChange={(e) => {
                      setSelectedClient(null)
                      setClientSearch(e.target.value)
                      setClientDropdownOpen(true)
                    }}
                    onFocus={() => setClientDropdownOpen(true)}
                    placeholder="Rechercher un client..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                    style={{ fontSize: "16px" }}
                  />
                </div>

                {/* Client dropdown */}
                <AnimatePresence>
                  {clientDropdownOpen && !selectedClient && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="rounded-xl bg-[#1A1A1A] border border-onyx-border/30 overflow-hidden max-h-48 overflow-y-auto"
                    >
                      {filteredClients.map(client => (
                        <button
                          key={client.id}
                          onClick={() => {
                            setSelectedClient(client)
                            setClientSearch("")
                            setClientDropdownOpen(false)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-b border-onyx-border/20 last:border-0 text-left"
                        >
                          <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                            {client.type === "professionnel" ? (
                              <Building2 className="h-4 w-4 text-gold" strokeWidth={1.5} />
                            ) : (
                              <span className="text-xs font-bold text-gold">
                                {client.prenom?.[0]}{client.nom?.[0]}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {client.type === "particulier" ? `${client.prenom} ${client.nom}` : client.raisonSociale}
                              </p>
                              {client.type === "professionnel" && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-500/10 text-blue-400">PRO</span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">{client.email}</p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected client card */}
                {selectedClient && (
                  <div className="p-3 rounded-xl bg-gold/5 border border-gold/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                          {selectedClient.type === "professionnel" ? (
                            <Building2 className="h-4 w-4 text-gold" strokeWidth={1.5} />
                          ) : (
                            <span className="text-sm font-bold text-gold">
                              {selectedClient.prenom?.[0]}{selectedClient.nom?.[0]}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {selectedClient.type === "particulier" ? `${selectedClient.prenom} ${selectedClient.nom}` : selectedClient.raisonSociale}
                          </p>
                          {selectedClient.type === "professionnel" && selectedClient.siren && (
                            <p className="text-[10px] text-muted-foreground font-mono">SIREN {selectedClient.siren}</p>
                          )}
                        </div>
                      </div>
                      <button onClick={() => setSelectedClient(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground">
                        <X className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <span className="ml-1 text-foreground">{selectedClient.email}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tél:</span>
                        <span className="ml-1 text-foreground">{selectedClient.phone}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* SECTION 3: TRAJET & CARTE */}
            <SectionCard
              title="Trajet"
              subtitle="Itinéraire et calculs automatiques"
              icon={<Route className="h-4 w-4" strokeWidth={1.5} />}
            >
              <div className="space-y-3">
                {/* Departure */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
                  </div>
                  <input
                    type="text"
                    value={departure}
                    onChange={(e) => setDeparture(e.target.value)}
                    placeholder="Adresse de départ..."
                    className="flex-1 px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                    style={{ fontSize: "16px" }}
                  />
                </div>

                {/* Stops */}
                {stops.map((stop, index) => (
                  <div key={stop.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-amber-400">{index + 1}</span>
                    </div>
                    <input
                      type="text"
                      value={stop.address}
                      onChange={(e) => updateStop(stop.id, e.target.value)}
                      placeholder={`Arrêt ${index + 1}...`}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }}
                    />
                    <button onClick={() => removeStop(stop.id)} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400">
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}

                {/* Add stop button */}
                <button
                  onClick={addStop}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gold/30 text-gold text-[11px] font-medium hover:bg-gold/5 hover:border-gold/50 active:scale-[0.98] transition-all"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Ajouter un arrêt intermédiaire
                </button>

                {/* Arrival */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <Navigation className="h-4 w-4 text-rose-400" strokeWidth={1.5} />
                  </div>
                  <input
                    type="text"
                    value={arrival}
                    onChange={(e) => setArrival(e.target.value)}
                    placeholder="Adresse d'arrivée..."
                    className="flex-1 px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                    style={{ fontSize: "16px" }}
                  />
                </div>

                {/* Map simulation */}
                <div className="h-32 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a2a1a] via-[#1a1a2a] to-[#2a1a1a] opacity-50" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {departure && arrival ? (
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-4 mb-2">
                          <div className="flex items-center gap-1 text-emerald-400">
                            <MapPin className="h-4 w-4" strokeWidth={1.5} />
                            <span className="text-[10px] max-w-[80px] truncate">{departure}</span>
                          </div>
                          <div className="w-8 h-px bg-gold/50" />
                          <div className="flex items-center gap-1 text-rose-400">
                            <Navigation className="h-4 w-4" strokeWidth={1.5} />
                            <span className="text-[10px] max-w-[80px] truncate">{arrival}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Carte interactive (simulation)</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Saisissez un trajet pour afficher la carte</p>
                    )}
                  </div>
                </div>

                {/* Auto-calculated values (NON MODIFIABLES) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-muted-foreground">Distance</p>
                      <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-emerald-500/10 text-emerald-400">AUTO</span>
                    </div>
                    <p className="text-lg font-bold text-gold tabular-nums">{routeInfo.distance} <span className="text-sm font-normal text-muted-foreground">km</span></p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-muted-foreground">Durée</p>
                      <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-emerald-500/10 text-emerald-400">AUTO</span>
                    </div>
                    <p className="text-lg font-bold text-gold tabular-nums">{routeInfo.duration} <span className="text-sm font-normal text-muted-foreground">min</span></p>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Date de course</label>
                    <input
                      type="date"
                      value={courseDate}
                      onChange={(e) => setCourseDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Heure de prise en charge</label>
                    <input
                      type="time"
                      value={courseTime}
                      onChange={(e) => setCourseTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* SECTION 4: VÉHICULE (Garage) */}
            <SectionCard
              title="Véhicule"
              subtitle="Sélectionnez depuis votre garage"
              icon={<Car className="h-4 w-4" strokeWidth={1.5} />}
            >
              <div className="space-y-3">
                {!selectedVehicle ? (
                  <div className="space-y-2">
                    {availableVehicles.map(vehicle => (
                      <button
                        key={vehicle.id}
                        onClick={() => setSelectedVehicle(vehicle)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 hover:border-gold/30 active:scale-[0.98] transition-all text-left"
                      >
                        <div
                          className="w-10 h-10 rounded-lg border border-onyx-border/30 flex items-center justify-center"
                          style={{ backgroundColor: vehicle.color }}
                        >
                          <Car className="h-5 w-5 text-white/80" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{vehicle.model}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{vehicle.plate}</p>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-gold/10 text-gold text-[10px] font-medium capitalize">{vehicle.category}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-gold/5 border border-gold/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg border border-gold/30 flex items-center justify-center"
                          style={{ backgroundColor: selectedVehicle.color }}
                        >
                          <Car className="h-5 w-5 text-white/80" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{selectedVehicle.model}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{selectedVehicle.plate}</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedVehicle(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground">
                        <X className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="px-2 py-1 rounded-lg bg-gold/10 text-gold capitalize">{selectedVehicle.category}</span>
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400">4 places max</span>
                    </div>
                  </div>
                )}

                {/* Passengers & Luggage */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Passagers</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPassengers(Math.max(1, passengers - 1))}
                        className="w-10 h-10 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 flex items-center justify-center hover:bg-white/5 active:scale-95"
                      >
                        <span className="text-lg text-foreground">−</span>
                      </button>
                      <div className="flex-1 h-10 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 flex items-center justify-center">
                        <Users className="h-4 w-4 text-gold mr-2" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground">{passengers}</span>
                      </div>
                      <button
                        onClick={() => setPassengers(Math.min(8, passengers + 1))}
                        className="w-10 h-10 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 flex items-center justify-center hover:bg-white/5 active:scale-95"
                      >
                        <span className="text-lg text-foreground">+</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Bagages</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLuggage(Math.max(0, luggage - 1))}
                        className="w-10 h-10 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 flex items-center justify-center hover:bg-white/5 active:scale-95"
                      >
                        <span className="text-lg text-foreground">−</span>
                      </button>
                      <div className="flex-1 h-10 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 flex items-center justify-center">
                        <Briefcase className="h-4 w-4 text-gold mr-2" strokeWidth={1.5} />
                        <span className="text-sm font-semibold text-foreground">{luggage}</span>
                      </div>
                      <button
                        onClick={() => setLuggage(Math.min(10, luggage + 1))}
                        className="w-10 h-10 rounded-lg bg-[#1A1A1A] border border-onyx-border/30 flex items-center justify-center hover:bg-white/5 active:scale-95"
                      >
                        <span className="text-lg text-foreground">+</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Instructions particulières</label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Ex : Accueil avec pancarte, bagages volumineux..."
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50 resize-none"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
            </SectionCard>

            {/* SECTION 5: TARIFICATION */}
            <SectionCard
              title="Tarification"
              subtitle="Prix basé sur votre grille tarifaire"
              icon={<Euro className="h-4 w-4" strokeWidth={1.5} />}
            >
              <div className="space-y-4">
                {/* Base price */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Prix de base</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tarifGrille.priseEnCharge}€ + {routeInfo.distance} km × {tarifGrille.tarifKm}€
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={customPrice ?? calculatedPrice}
                      onChange={(e) => setCustomPrice(parseFloat(e.target.value) || null)}
                      className="w-20 px-2 py-2 rounded-lg bg-onyx-card border border-onyx-border/30 text-sm text-right text-foreground font-semibold focus:outline-none focus:border-gold/50"
                      style={{ fontSize: "16px" }}
                    />
                    <span className="text-sm text-muted-foreground">€</span>
                  </div>
                </div>

                {/* Supplements (only enabled ones from settings) */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Suppléments disponibles</p>
                  <div className="space-y-2">
                    {supplements.map(supp => (
                      <button
                        key={supp.id}
                        onClick={() => toggleSupplement(supp.id)}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                          supp.enabled
                            ? "bg-gold/5 border-gold/30"
                            : "bg-[#1A1A1A] border-onyx-border/30"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                            supp.enabled ? "bg-gold border-gold" : "border-onyx-border/50"
                          )}>
                            {supp.enabled && <Check className="h-3 w-3 text-onyx-base" strokeWidth={2} />}
                          </div>
                          <span className="text-sm text-foreground">{supp.label}</span>
                        </div>
                        <span className={cn("text-sm font-semibold", supp.enabled ? "text-gold" : "text-muted-foreground")}>+{supp.price}€</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="p-4 rounded-xl bg-gold/5 border border-gold/20 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total HT</span>
                    <span className="text-foreground tabular-nums">{formatCurrency(totalHT)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA (10%)</span>
                    <span className="text-foreground tabular-nums">{formatCurrency(tva)}</span>
                  </div>
                  <div className="border-t border-gold/20 pt-2 mt-2" />
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-foreground">TOTAL TTC</span>
                    <span className="text-xl font-bold text-gold tabular-nums">{formatCurrency(totalTTC)}</span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground text-center">
                  TVA applicable : 10% — Transport de personnes (Art. 279-b du CGI)
                </p>
              </div>
            </SectionCard>

            {/* SECTION 6: CGV (Affichage seul, pas de case à cocher) */}
            <SectionCard
              title="Conditions de vente"
              subtitle="Configurées dans vos réglages"
              icon={<FileText className="h-4 w-4" strokeWidth={1.5} />}
              badge={<span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">AUTO</span>}
            >
              <div className="p-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30">
                <div className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-line">
                  {cgvContent}
                </div>
              </div>
            </SectionCard>
          </div>
        ) : (
          /* APERÇU PDF TAB */
          <div className="p-4">
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-md mx-auto">
              {/* PDF Header - Identité du chauffeur uniquement */}
              <div className="p-5 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200 flex items-center justify-center">
                      <span className="text-xl font-bold text-amber-700">{emetteurProfile.initials}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{emetteurProfile.denomination}</p>
                      <p className="text-[10px] text-gray-500">SIREN {emetteurProfile.siren}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-900">BON DE RÉSERVATION</p>
                    <p className="text-[10px] text-amber-600 font-mono">{brNumber}</p>
                  </div>
                </div>
                {/* HORODATAGE CRUCIAL */}
                <p className="text-[10px] text-gray-500 mt-3">
                  Établi le {formatDate(creationDate)} à {formatTime(creationDate)}
                </p>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-4 p-5 border-b border-gray-200">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Émetteur</p>
                  <p className="text-xs font-semibold text-gray-900">{emetteurProfile.denomination}</p>
                  <p className="text-[10px] text-gray-600">{emetteurProfile.adresse}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-amber-100 text-amber-700">SIREN</span>
                    <span className="text-[9px] text-gray-500 font-mono">{emetteurProfile.siren}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Destinataire</p>
                  {selectedClient ? (
                    <>
                      <p className="text-xs font-semibold text-gray-900">
                        {selectedClient.type === "particulier" ? `${selectedClient.prenom} ${selectedClient.nom}` : selectedClient.raisonSociale}
                      </p>
                      <p className="text-[10px] text-gray-600">{selectedClient.email}</p>
                      {selectedClient.type === "professionnel" && selectedClient.siren && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-amber-100 text-amber-700">SIREN</span>
                          <span className="text-[9px] text-gray-500 font-mono">{selectedClient.siren}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic">Non sélectionné</p>
                  )}
                </div>
              </div>

              {/* Course */}
              <div className="p-5 border-b border-gray-200">
                <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Détails de la course</p>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-emerald-600" strokeWidth={2} />
                  </div>
                  <p className="text-xs text-gray-900 flex-1">{departure || "Adresse de départ"}</p>
                </div>
                {stops.filter(s => s.address).map((stop, i) => (
                  <div key={stop.id} className="flex items-center gap-2 mb-2 ml-2">
                    <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-amber-600">{i + 1}</span>
                    </div>
                    <p className="text-[10px] text-gray-600 flex-1">{stop.address}</p>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center">
                    <Navigation className="h-3 w-3 text-rose-600" strokeWidth={2} />
                  </div>
                  <p className="text-xs text-gray-900 flex-1">{arrival || "Adresse d'arrivée"}</p>
                </div>
                <div className="flex gap-4 mt-3 text-[10px] text-gray-500">
                  <span>{courseDate ? new Date(courseDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Date à définir"}</span>
                  <span>{courseTime ? courseTime.replace(":", "h") : "Heure à définir"}</span>
                  <span>{routeInfo.distance} km</span>
                  <span>{routeInfo.duration} min</span>
                </div>
              </div>

              {/* Vehicle */}
              {selectedVehicle && (
                <div className="p-5 border-b border-gray-200">
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Véhicule</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Car className="h-4 w-4 text-gray-600" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{selectedVehicle.model}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{selectedVehicle.plate}</p>
                    </div>
                    <span className="ml-auto px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[9px] capitalize">{selectedVehicle.category}</span>
                  </div>
                  <div className="flex gap-3 mt-2 text-[10px] text-gray-500">
                    <span>{passengers} passager{passengers > 1 ? "s" : ""}</span>
                    <span>{luggage} bagage{luggage !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              )}

              {/* Pricing */}
              <div className="p-5 border-b border-gray-200">
                <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Tarification</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Course ({routeInfo.distance} km)</span>
                    <span className="text-gray-900 tabular-nums">{formatCurrency(customPrice ?? calculatedPrice)}</span>
                  </div>
                  {activeSupplements.map(supp => (
                    <div key={supp.id} className="flex justify-between">
                      <span className="text-gray-600">{supp.label}</span>
                      <span className="text-gray-900 tabular-nums">{formatCurrency(supp.price)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2 mt-2" />
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total HT</span>
                    <span className="text-gray-900 tabular-nums">{formatCurrency(totalHT)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">TVA (10%)</span>
                    <span className="text-gray-900 tabular-nums">{formatCurrency(tva)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-900">TOTAL TTC</span>
                    <span className="text-amber-600 tabular-nums">{formatCurrency(totalTTC)}</span>
                  </div>
                </div>
              </div>

              {/* Legal mentions */}
              <div className="p-5 border-b border-gray-200">
                <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Mentions légales VTC</p>
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  <div>
                    <span className="text-gray-400">Carte VTC</span>
                    <p className="text-gray-600 font-mono">{emetteurProfile.carteVTC}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">RC Pro</span>
                    <div className="flex items-center gap-1">
                      <p className="text-gray-600 font-mono truncate">{emetteurProfile.rcProPolice}</p>
                      {emetteurProfile.rcProValid && (
                        <Shield className="h-3 w-3 text-emerald-500 flex-shrink-0" strokeWidth={2} />
                      )}
                    </div>
                  </div>
                </div>
                {emetteurProfile.rcProValid && (
                  <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 w-fit">
                    <Shield className="h-3 w-3 text-emerald-600" strokeWidth={2} />
                    <span className="text-[8px] font-semibold text-emerald-700">Véhicule Assuré</span>
                  </div>
                )}
              </div>

              {/* Footer - Mention NoX discrète */}
              <div className="px-5 py-3 bg-gray-50">
                <p className="text-[8px] text-gray-400 text-center">
                  Document généré via NoX VTC
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="px-4 py-4 border-t border-onyx-border/30 bg-onyx-base space-y-3">
        <div className="flex gap-3">
          <button 
            onClick={handleSaveDraft}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border border-onyx-border/50 text-muted-foreground text-sm font-medium hover:bg-white/5 active:scale-[0.98] transition-all"
          >
            <Save className="h-4 w-4" strokeWidth={1.5} />
            Enregistrer brouillon
          </button>
          <button 
            onClick={handleGenerate}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gold text-onyx-base text-sm font-semibold hover:bg-gold/90 active:scale-[0.98] transition-all"
          >
            <FileText className="h-4 w-4" strokeWidth={1.5} />
            Générer le bon
          </button>
        </div>
        <div className="flex justify-center gap-6 text-[11px] text-muted-foreground">
          <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
            Envoyer par email
          </button>
          <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            Copier le lien
          </button>
          <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Télécharger PDF
          </button>
        </div>
      </div>
    </motion.div>
  )
}

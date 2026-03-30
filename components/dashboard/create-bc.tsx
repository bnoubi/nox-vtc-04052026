"use client"

import { useState, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Edit3,
  Share2,
  X,
  FileText,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Search,
  UserRoundPlus,
  MapPin,
  Clock,
  CalendarDays,
  Car,
  User,
  StickyNote,
  CircleDot,
  Check,
  MessageCircle,
  Phone,
  Link2,
  Copy,
  CheckCheck,
  Building2,
  Plus,
  Minus,
  Trash2,
  Eye,
  Info,
  Upload,
  Shield,
  Briefcase,
  CreditCard,
  Send,
  Save,
  Download,
  Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePlan } from "./plan-context"
import { allDrivers, allVehicles, existingClients, allClients } from "./data"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────

export interface BCPrefillClient {
  civilite: string
  nom: string
  prenom: string
  tel: string
}

interface CreateBCProps {
  open: boolean
  onClose: () => void
  prefillClient?: BCPrefillClient | null
}

type BCStep = "choose" | "manual" | "link"
type TabId = "form" | "preview"
type ClientType = "particulier" | "professionnel"
type ValidityOption = "24h" | "48h" | "7j" | "30j"
type StatusOption = "attente" | "confirme" | "annule"
type VehicleCategory = "berline" | "van" | "monospace" | "luxe"

// ── Utilities ─────────────────────────────────────────────────

function generateBRNumber() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 9000) + 1000)
  return `BR-${year}-${month}-${seq}`
}

function formatDate(date: Date) {
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}h${String(date.getMinutes()).padStart(2, "0")}`
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getExpiryDate(validity: ValidityOption, createdAt: Date) {
  switch (validity) {
    case "24h": return addDays(createdAt, 1)
    case "48h": return addDays(createdAt, 2)
    case "7j": return addDays(createdAt, 7)
    case "30j": return addDays(createdAt, 30)
  }
}

// ── Bottom Sheet : Choose method ──────────────────────────────

function ChooseMethodSheet({
  onManual,
  onLink,
  onClose,
}: {
  onManual: () => void
  onLink: () => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
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
          <h2 className="text-base font-bold text-foreground">
            Nouveau Bon de Réservation
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Choisissez votre méthode de création
          </p>
        </div>

        <div className="px-5 pb-4 space-y-2.5">
          <button
            onClick={onManual}
            className="flex items-center gap-3.5 w-full p-4 rounded-2xl bg-onyx-card border border-gold/20 hover:border-gold/40 hover:gold-glow-sm active:scale-[0.98] transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
              <Edit3 className="h-5 w-5 text-gold" strokeWidth={1.5} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                Saisie Manuelle
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Remplir le formulaire complet
              </p>
            </div>
          </button>

          <button
            onClick={onLink}
            className="flex items-center gap-3.5 w-full p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-onyx-border active:scale-[0.98] transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Share2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                Envoyer un lien au client
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Le client saisit lui-même son bon de réservation
              </p>
            </div>
          </button>
        </div>

        {/* Info tip */}
        <div className="mx-5 mb-5 px-3 py-2 rounded-xl bg-gold/5 border border-gold/15">
          <p className="text-[10px] text-gold/80 text-center">
            Gain de temps : automatisez la saisie des données clients
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Share Link Screen ─────────────────────────────────────────

function ShareLinkScreen({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [selectedClientId, setSelectedClientId] = useState("")
  const [freeContact, setFreeContact] = useState("")
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState<"sms" | "whatsapp" | null>(null)
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)

  const clientOptions = existingClients.map((c) => ({
    value: c.id,
    label: `${c.title} ${c.name}`,
    sub: c.phone,
  }))

  const selectedClient = existingClients.find((c) => c.id === selectedClientId)

  const slug = selectedClient
    ? selectedClient.name.toLowerCase().replace(/\s+/g, "-")
    : freeContact
      ? freeContact.replace(/@.*/, "").replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase() || "client"
      : "votre-client"

  const generatedLink = `nox.vtc/book/${slug}`

  function handleCopy() {
    navigator.clipboard?.writeText(`https://${generatedLink}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSend(channel: "sms" | "whatsapp") {
    setSent(channel)
    setTimeout(() => {
      onClose()
    }, 1800)
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
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 active:scale-95 transition-all"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Partage du lien</h1>
          <p className="text-[10px] text-muted-foreground">Envoyer un lien de réservation</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 active:scale-95 transition-all"
        >
          <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {/* Select existing client */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" strokeWidth={1.5} />
            Destinataire
          </p>
          
          <div className="relative">
            <button
              type="button"
              onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl bg-onyx-card border text-sm transition-colors text-left",
                clientDropdownOpen ? "border-gold/40" : "border-onyx-border/50 hover:border-onyx-border"
              )}
            >
              <span className={selectedClient ? "text-foreground" : "text-muted-foreground/50"}>
                {selectedClient ? `${selectedClient.title} ${selectedClient.name}` : "Sélectionner un client existant"}
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", clientDropdownOpen && "rotate-180")} strokeWidth={1.5} />
            </button>

            <AnimatePresence>
              {clientDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 z-20 mt-1 py-1 rounded-xl bg-onyx-card border border-onyx-border/50 shadow-2xl shadow-black/60 max-h-48 overflow-y-auto scrollbar-hide"
                >
                  {clientOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSelectedClientId(option.value)
                        setFreeContact("")
                        setClientDropdownOpen(false)
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-secondary/30 transition-colors",
                        selectedClientId === option.value && "bg-gold/5"
                      )}
                    >
                      <div>
                        <p className={cn("text-sm", selectedClientId === option.value ? "text-gold font-medium" : "text-foreground")}>
                          {option.label}
                        </p>
                        {option.sub && <p className="text-[10px] text-muted-foreground">{option.sub}</p>}
                      </div>
                      {selectedClientId === option.value && <Check className="h-3.5 w-3.5 text-gold shrink-0" strokeWidth={2} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Separator */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-onyx-border/30" />
          <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">ou</span>
          <div className="flex-1 h-px bg-onyx-border/30" />
        </div>

        {/* Free contact input */}
        <section>
          <input
            type="text"
            placeholder="Saisir email ou téléphone"
            value={freeContact}
            onChange={(e) => {
              setFreeContact(e.target.value)
              setSelectedClientId("")
            }}
            className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
            style={{ fontSize: "16px" }}
          />
        </section>

        {/* Link Preview */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            Lien de réservation
          </p>
          <div className="relative rounded-2xl bg-onyx-card border border-gold/20 p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground mb-1">Lien personnalisé</p>
                <p className="text-sm font-mono font-medium text-gold truncate">{generatedLink}</p>
              </div>
              <button
                onClick={handleCopy}
                className={cn(
                  "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-95",
                  copied ? "bg-emerald-500/15 border-emerald-500/30" : "bg-gold/10 border-gold/30 hover:bg-gold/20"
                )}
              >
                {copied ? <CheckCheck className="h-4 w-4 text-emerald-400" strokeWidth={1.5} /> : <Copy className="h-4 w-4 text-gold" strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </section>

        {/* Success feedback */}
        <AnimatePresence>
          {sent && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <CheckCheck className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-400">Lien envoyé avec succès</p>
                <p className="text-[11px] text-emerald-400/70 mt-0.5">
                  {sent === "sms" ? "Le client recevra un SMS sous quelques secondes." : "Le message WhatsApp a été envoyé."}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed bottom: Send buttons */}
      <div className="px-4 py-4 border-t border-onyx-border/30 bg-background space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleSend("sms")}
            disabled={!!sent || (!selectedClientId && !freeContact)}
            className={cn(
              "flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]",
              sent === "sms"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                : "bg-onyx-card border border-gold/30 text-gold hover:bg-gold/10 hover:border-gold/50 disabled:opacity-40"
            )}
          >
            <Phone className="h-4 w-4" strokeWidth={1.5} />
            {sent === "sms" ? "Envoyé" : "Par SMS"}
          </button>
          <button
            onClick={() => handleSend("whatsapp")}
            disabled={!!sent || (!selectedClientId && !freeContact)}
            className={cn(
              "flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]",
              sent === "whatsapp"
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                : "bg-gold text-primary-foreground hover:bg-gold-light gold-glow-sm disabled:opacity-40"
            )}
          >
            <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
            {sent === "whatsapp" ? "Envoyé" : "Par WhatsApp"}
          </button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground/50">
          Le client recevra un lien sécurisé pour remplir ses informations de trajet.
        </p>
      </div>
    </motion.div>
  )
}

// ── Collapsible Section ───────────────────────────────────────

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl bg-onyx-card border border-onyx-border/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-gold">{icon}</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} strokeWidth={1.5} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-onyx-border/20">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Input Field ───────────────────────────────────────────────

function InputField({
  label,
  required,
  tag,
  tagColor = "gold",
  placeholder,
  value,
  onChange,
  type = "text",
  inputMode,
  rows,
  icon,
  suffix,
  info,
  readOnly,
  error,
}: {
  label: string
  required?: boolean
  tag?: string
  tagColor?: "gold" | "muted"
  placeholder?: string
  value: string
  onChange?: (val: string) => void
  type?: string
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email"
  rows?: number
  icon?: React.ReactNode
  suffix?: string
  info?: string
  readOnly?: boolean
  error?: string
}) {
  const inputClasses = cn(
    "w-full px-4 py-3 rounded-xl bg-[#1A1A1A] border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors",
    error ? "border-rose-500/50 focus:border-rose-500" : "border-onyx-border/30 focus:border-gold/50",
    icon && "pl-10",
    suffix && "pr-12",
    readOnly && "opacity-60 cursor-not-allowed"
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
          {required && <span className="text-gold ml-0.5">*</span>}
        </label>
        {tag && (
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
            tagColor === "gold" ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"
          )}>
            {tag}
          </span>
        )}
      </div>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        {rows ? (
          <textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            readOnly={readOnly}
            className={cn(inputClasses, "resize-none")}
            style={{ fontSize: "16px" }}
          />
        ) : (
          <input
            type={type}
            inputMode={inputMode}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            className={inputClasses}
            style={{ fontSize: "16px" }}
          />
        )}
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {info && <p className="text-[10px] text-muted-foreground mt-1">{info}</p>}
      {error && <p className="text-[10px] text-rose-400 mt-1">{error}</p>}
    </div>
  )
}

// ── Pill Toggle ───────────────────────────────────────────────

function PillToggle<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[]
  value: T
  onChange: (val: T) => void
  labels: Record<T, string>
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "px-3 py-2 rounded-xl text-xs font-medium border transition-all active:scale-95",
            value === opt
              ? "bg-gold/15 border-gold/40 text-gold"
              : "bg-secondary/30 border-onyx-border/50 text-muted-foreground hover:border-onyx-border"
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  )
}

// ── Stepper ───────────────────────────────────────────────────

function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  value: number
  onChange: (val: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-10 h-10 rounded-xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center text-foreground hover:border-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        <Minus className="h-4 w-4" strokeWidth={1.5} />
      </button>
      <span className="w-8 text-center text-lg font-bold text-foreground tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-10 h-10 rounded-xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center text-foreground hover:border-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </div>
  )
}

// ── Full-Screen Manual Form ───────────────────────────────────

function ManualBCForm({ onBack, onClose, prefillClient }: { onBack: () => void; onClose: () => void; prefillClient?: BCPrefillClient | null }) {
  const [activeTab, setActiveTab] = useState<TabId>("form")
  const now = useMemo(() => new Date(), [])
  const brNumber = useMemo(() => generateBRNumber(), [])

  // ── Form State ──
  const [validity, setValidity] = useState<ValidityOption>("7j")
  const [status, setStatus] = useState<StatusOption>("attente")

  // Emetteur (Driver)
  const [emetteurLogo, setEmetteurLogo] = useState<string | null>(null)
  const [emetteurNom, setEmetteurNom] = useState("Jean Dupont Transport VTC")
  const [emetteurAdresse, setEmetteurAdresse] = useState("15 rue des Lilas, 75011 Paris")
  const [emetteurSiren, setEmetteurSiren] = useState("912 345 678")
  const [emetteurTva, setEmetteurTva] = useState("")
  const [emetteurEmail, setEmetteurEmail] = useState("jean.dupont@nox-vtc.fr")
  const [emetteurTel, setEmetteurTel] = useState("+33 6 12 34 56 78")

  // Client
  const [clientType, setClientType] = useState<ClientType>("professionnel")
  const [clientRaisonSociale, setClientRaisonSociale] = useState("")
  const [clientSiren, setClientSiren] = useState("")
  const [clientTvaIntra, setClientTvaIntra] = useState("")
  const [clientAdresseFacturation, setClientAdresseFacturation] = useState("")
  const [clientAdresseLivraison, setClientAdresseLivraison] = useState("")
  const [clientAdresseSame, setClientAdresseSame] = useState(true)
  const [clientContact, setClientContact] = useState("")
  const [clientNom, setClientNom] = useState(prefillClient ? `${prefillClient.prenom} ${prefillClient.nom}` : "")
  const [clientEmail, setClientEmail] = useState("")
  const [clientTel, setClientTel] = useState(prefillClient?.tel || "")
  const [clientAdresse, setClientAdresse] = useState("")

  // Course
  const [depart, setDepart] = useState("")
  const [arrivee, setArrivee] = useState("")
  const [stops, setStops] = useState<string[]>([])
  const [courseDate, setCourseDate] = useState("")
  const [courseHeure, setCourseHeure] = useState("")
  const [duree, setDuree] = useState("")
  const [distance, setDistance] = useState("")
  const [vehicule, setVehicule] = useState("Mercedes Classe E")
  const [immatriculation, setImmatriculation] = useState("AA-123-BB")
  const [categorie, setCategorie] = useState<VehicleCategory>("berline")
  const [passagers, setPassagers] = useState(1)
  const [bagages, setBagages] = useState(0)
  const [instructions, setInstructions] = useState("")

  // Tarification
  const [prestationDesc, setPrestationDesc] = useState("")
  const [prestationHT, setPrestationHT] = useState("")
  const [supplements, setSupplements] = useState<{ id: string; desc: string; montant: string }[]>([])
  const [showRemise, setShowRemise] = useState(false)
  const [remiseType, setRemiseType] = useState<"euro" | "percent">("euro")
  const [remiseValue, setRemiseValue] = useState("")
  const [showAcompte, setShowAcompte] = useState(false)
  const [acompteType, setAcompteType] = useState<"euro" | "percent">("euro")
  const [acompteValue, setAcompteValue] = useState("")

  // CGV
  const [cgvAccepted, setCgvAccepted] = useState(false)

  // Mentions légales
  const [carteVTC, setCarteVTC] = useState("VTC-075-2024-00456")
  const [policeRC, setPoliceRC] = useState("AXA-RC-2024-789456")

  // ── Calculations ──
  const montantHT = parseFloat(prestationHT) || 0
  const supplementsTotal = supplements.reduce((sum, s) => sum + (parseFloat(s.montant) || 0), 0)
  const subtotalHT = montantHT + supplementsTotal
  
  const remiseAmount = useMemo(() => {
    if (!showRemise || !remiseValue) return 0
    const val = parseFloat(remiseValue) || 0
    return remiseType === "euro" ? val : (subtotalHT * val) / 100
  }, [showRemise, remiseValue, remiseType, subtotalHT])

  const totalHT = subtotalHT - remiseAmount
  const tva = totalHT * 0.1
  const totalTTC = totalHT + tva

  const acompteAmount = useMemo(() => {
    if (!showAcompte || !acompteValue) return 0
    const val = parseFloat(acompteValue) || 0
    return acompteType === "euro" ? val : (totalTTC * val) / 100
  }, [showAcompte, acompteValue, acompteType, totalTTC])

  const soldeRestant = totalTTC - acompteAmount

  const expiryDate = getExpiryDate(validity, now)

  // ── Handlers ──
  function addSupplement(preset?: string) {
    setSupplements([...supplements, { id: crypto.randomUUID(), desc: preset || "", montant: "" }])
  }

  function removeSupplement(id: string) {
    setSupplements(supplements.filter((s) => s.id !== id))
  }

  function updateSupplement(id: string, field: "desc" | "montant", value: string) {
    setSupplements(supplements.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  function addStop() {
    setStops([...stops, ""])
  }

  function removeStop(index: number) {
    setStops(stops.filter((_, i) => i !== index))
  }

  function updateStop(index: number, value: string) {
    setStops(stops.map((s, i) => (i === index ? value : s)))
  }

  function handleSaveDraft() {
    toast.success("Brouillon sauvegardé")
  }

  function handleGenerate() {
    if (!cgvAccepted) {
      toast.error("Veuillez accepter les CGV")
      return
    }
    toast.success("Bon de réservation généré ✓")
    setActiveTab("preview")
  }

  // ── Render Form Tab ──
  const renderFormTab = () => (
    <div className="space-y-4 pb-40">
      {/* SECTION 1: Métadonnées */}
      <CollapsibleSection title="Informations du document" icon={<FileText className="h-4 w-4" strokeWidth={1.5} />}>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-background border border-onyx-border/20">
            <p className="text-[10px] text-muted-foreground mb-1">N° de bon</p>
            <p className="text-sm font-mono font-semibold text-gold">{brNumber}</p>
          </div>
          <div className="p-3 rounded-xl bg-background border border-onyx-border/20">
            <p className="text-[10px] text-muted-foreground mb-1">Date de création</p>
            <p className="text-xs font-medium text-foreground">{formatDate(now)}</p>
            <p className="text-[10px] text-muted-foreground">{formatTime(now)}</p>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Validité</label>
          <PillToggle
            options={["24h", "48h", "7j", "30j"] as ValidityOption[]}
            value={validity}
            onChange={setValidity}
            labels={{ "24h": "24h", "48h": "48h", "7j": "7 jours", "30j": "30 jours" }}
          />
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Expire le {formatDate(expiryDate)} à {formatTime(now)}
          </p>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Statut</label>
          <div className="flex gap-2">
            {(["attente", "confirme", "annule"] as StatusOption[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95",
                  status === s
                    ? s === "attente" ? "bg-gold/15 border-gold/40 text-gold"
                      : s === "confirme" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : "bg-rose-500/15 border-rose-500/40 text-rose-400"
                    : "bg-secondary/30 border-onyx-border/50 text-muted-foreground"
                )}
              >
                {s === "attente" ? "EN ATTENTE" : s === "confirme" ? "CONFIRMÉ" : "ANNULÉ"}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* SECTION 2: Émetteur */}
      <CollapsibleSection title="Votre profil (Émetteur)" icon={<Briefcase className="h-4 w-4" strokeWidth={1.5} />}>
        <div className="flex items-center gap-4 mb-4">
          <div
            onClick={() => document.getElementById("logo-upload")?.click()}
            className="w-16 h-16 rounded-xl bg-gold/10 border-2 border-dashed border-gold/30 flex items-center justify-center cursor-pointer hover:bg-gold/15 transition-colors"
          >
            {emetteurLogo ? (
              <img src={emetteurLogo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
            ) : (
              <span className="text-lg font-bold text-gold">JD</span>
            )}
          </div>
          <input
            id="logo-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setEmetteurLogo(URL.createObjectURL(file))
            }}
          />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">Logo ou initiales</p>
            {emetteurLogo && (
              <button type="button" onClick={() => setEmetteurLogo(null)} className="text-[10px] text-rose-400 hover:underline">
                Supprimer
              </button>
            )}
          </div>
        </div>

        <InputField label="Nom / Raison sociale" required value={emetteurNom} onChange={setEmetteurNom} placeholder="Jean Dupont Transport" />
        <InputField label="Adresse complète" required value={emetteurAdresse} onChange={setEmetteurAdresse} rows={2} placeholder="15 rue des Lilas, 75011 Paris" />
        <InputField label="SIREN" required tag="Factur-X requis" value={emetteurSiren} onChange={setEmetteurSiren} placeholder="123 456 789" info="Format : XXX XXX XXX (9 chiffres)" />
        <InputField label="N° TVA intracommunautaire" tag="Si assujetti" tagColor="muted" value={emetteurTva} onChange={setEmetteurTva} placeholder="FR12 123456789" />
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Email" value={emetteurEmail} onChange={setEmetteurEmail} type="email" placeholder="email@example.com" />
          <InputField label="Téléphone" value={emetteurTel} onChange={setEmetteurTel} type="tel" placeholder="+33 6 12 34 56 78" />
        </div>
      </CollapsibleSection>

      {/* SECTION 3: Client */}
      <CollapsibleSection title="Client (Destinataire)" icon={<User className="h-4 w-4" strokeWidth={1.5} />}>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Type de client</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setClientType("particulier")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border transition-all",
                clientType === "particulier" ? "bg-gold/15 border-gold/40 text-gold" : "bg-secondary/30 border-onyx-border/50 text-muted-foreground"
              )}
            >
              <User className="h-3.5 w-3.5" strokeWidth={1.5} />
              Particulier
            </button>
            <button
              type="button"
              onClick={() => setClientType("professionnel")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border transition-all",
                clientType === "professionnel" ? "bg-gold/15 border-gold/40 text-gold" : "bg-secondary/30 border-onyx-border/50 text-muted-foreground"
              )}
            >
              <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              Professionnel
            </button>
          </div>
        </div>

        {clientType === "professionnel" ? (
          <>
            <InputField label="Raison sociale" required value={clientRaisonSociale} onChange={setClientRaisonSociale} placeholder="Nom de l'entreprise" />
            <InputField label="SIREN" tag="Factur-X requis" value={clientSiren} onChange={setClientSiren} placeholder="123 456 789" />
            <InputField label="N° TVA intracommunautaire" value={clientTvaIntra} onChange={setClientTvaIntra} placeholder="FR12 123456789" />
            <InputField label="Adresse de facturation" required value={clientAdresseFacturation} onChange={setClientAdresseFacturation} rows={2} placeholder="Adresse complète..." />
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="same-address"
                checked={clientAdresseSame}
                onChange={(e) => setClientAdresseSame(e.target.checked)}
                className="w-4 h-4 rounded border-onyx-border/50 bg-onyx-card text-gold focus:ring-gold/50"
              />
              <label htmlFor="same-address" className="text-xs text-muted-foreground">
                Adresse de livraison identique
              </label>
            </div>

            {!clientAdresseSame && (
              <InputField label="Adresse de livraison" value={clientAdresseLivraison} onChange={setClientAdresseLivraison} rows={2} placeholder="Adresse de livraison..." />
            )}

            <InputField label="Nom du contact" value={clientContact} onChange={setClientContact} placeholder="Prénom Nom" />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Email" required value={clientEmail} onChange={setClientEmail} type="email" placeholder="email@entreprise.com" />
              <InputField label="Téléphone" value={clientTel} onChange={setClientTel} type="tel" placeholder="+33 6 00 00 00 00" />
            </div>
          </>
        ) : (
          <>
            <InputField label="Nom complet" required value={clientNom} onChange={setClientNom} placeholder="Prénom Nom" />
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Email" required value={clientEmail} onChange={setClientEmail} type="email" placeholder="email@example.com" />
              <InputField label="Téléphone" value={clientTel} onChange={setClientTel} type="tel" placeholder="+33 6 00 00 00 00" />
            </div>
            <InputField label="Adresse" value={clientAdresse} onChange={setClientAdresse} rows={2} placeholder="Adresse complète (optionnel)" />
          </>
        )}
      </CollapsibleSection>

      {/* SECTION 4: Détails de la course */}
      <CollapsibleSection title="Détails de la course" icon={<Car className="h-4 w-4" strokeWidth={1.5} />}>
        <InputField
          label="Point de départ"
          required
          value={depart}
          onChange={setDepart}
          placeholder="Adresse de départ..."
          icon={<MapPin className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />}
        />

        {stops.map((stop, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="flex-1">
              <InputField
                label={`Étape ${index + 1}`}
                value={stop}
                onChange={(val) => updateStop(index, val)}
                placeholder="Adresse de l'étape..."
                icon={<CircleDot className="h-4 w-4 text-amber-400" strokeWidth={1.5} />}
              />
            </div>
            <button
              type="button"
              onClick={() => removeStop(index)}
              className="mt-6 p-2 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addStop}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gold/30 text-gold text-xs font-medium hover:bg-gold/5 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Ajouter une étape
        </button>

        <InputField
          label="Point d'arrivée"
          required
          value={arrivee}
          onChange={setArrivee}
          placeholder="Adresse d'arrivée..."
          icon={<MapPin className="h-4 w-4 text-rose-400" strokeWidth={1.5} />}
        />

        <div className="grid grid-cols-2 gap-3">
          <InputField label="Date de la course" required value={courseDate} onChange={setCourseDate} type="date" />
          <InputField label="Heure de prise en charge" required value={courseHeure} onChange={setCourseHeure} type="time" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InputField label="Durée estimée" value={duree} onChange={setDuree} placeholder="45" suffix="min" inputMode="numeric" />
          <InputField label="Distance estimée" value={distance} onChange={setDistance} placeholder="32" suffix="km" inputMode="numeric" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InputField label="Véhicule" required value={vehicule} onChange={setVehicule} placeholder="Mercedes Classe E" />
          <InputField label="Immatriculation" required value={immatriculation} onChange={setImmatriculation} placeholder="AA-123-BB" />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Catégorie</label>
          <PillToggle
            options={["berline", "van", "monospace", "luxe"] as VehicleCategory[]}
            value={categorie}
            onChange={setCategorie}
            labels={{ berline: "Berline", van: "Van", monospace: "Monospace", luxe: "Luxe" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Passagers <span className="text-gold">*</span>
            </label>
            <Stepper value={passagers} onChange={setPassagers} min={1} max={8} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Bagages
            </label>
            <Stepper value={bagages} onChange={setBagages} min={0} max={10} />
          </div>
        </div>

        <InputField label="Instructions particulières" value={instructions} onChange={setInstructions} rows={3} placeholder="Ex : Accueil avec pancarte, bagages volumineux..." />
      </CollapsibleSection>

      {/* SECTION 5: Tarification */}
      <CollapsibleSection title="Tarification" icon={<CreditCard className="h-4 w-4" strokeWidth={1.5} />}>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <InputField label="Prestation" required value={prestationDesc} onChange={setPrestationDesc} placeholder="Course aller CDG → Paris" />
          </div>
          <InputField label="Montant HT" required value={prestationHT} onChange={setPrestationHT} placeholder="0.00" suffix="€" inputMode="decimal" />
        </div>

        {/* Suppléments */}
        {supplements.map((sup) => (
          <div key={sup.id} className="flex items-start gap-2">
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <InputField label="Supplément" value={sup.desc} onChange={(v) => updateSupplement(sup.id, "desc", v)} placeholder="Description..." />
              </div>
              <InputField label="Montant HT" value={sup.montant} onChange={(v) => updateSupplement(sup.id, "montant", v)} placeholder="0.00" suffix="€" inputMode="decimal" />
            </div>
            <button
              type="button"
              onClick={() => removeSupplement(sup.id)}
              className="mt-6 p-2 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => addSupplement()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gold/30 text-gold text-xs font-medium hover:bg-gold/5 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Ajouter un supplément
        </button>

        {/* Quick add chips */}
        <div className="flex flex-wrap gap-2">
          {["Attente", "Bagage", "Nuit/Dimanche", "Péage"].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => addSupplement(preset)}
              className="px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-onyx-border/30 text-[10px] font-medium text-muted-foreground hover:border-gold/30 hover:text-gold transition-colors"
            >
              + {preset}
            </button>
          ))}
        </div>

        {/* Remise toggle */}
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Remise</label>
          <button
            type="button"
            onClick={() => setShowRemise(!showRemise)}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              showRemise ? "bg-gold" : "bg-onyx-border/50"
            )}
          >
            <span className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
              showRemise ? "translate-x-5" : "translate-x-0.5"
            )} />
          </button>
        </div>

        {showRemise && (
          <div className="flex gap-3">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setRemiseType("euro")}
                className={cn(
                  "px-3 py-2 rounded-l-xl text-xs font-medium border-y border-l transition-all",
                  remiseType === "euro" ? "bg-gold/15 border-gold/40 text-gold" : "bg-secondary/30 border-onyx-border/50 text-muted-foreground"
                )}
              >
                €
              </button>
              <button
                type="button"
                onClick={() => setRemiseType("percent")}
                className={cn(
                  "px-3 py-2 rounded-r-xl text-xs font-medium border-y border-r transition-all",
                  remiseType === "percent" ? "bg-gold/15 border-gold/40 text-gold" : "bg-secondary/30 border-onyx-border/50 text-muted-foreground"
                )}
              >
                %
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={remiseValue}
              onChange={(e) => setRemiseValue(e.target.value)}
              placeholder="0"
              className="flex-1 px-4 py-2 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground text-right focus:outline-none focus:border-gold/50"
              style={{ fontSize: "16px" }}
            />
          </div>
        )}

        {/* Summary */}
        <div className="p-4 rounded-xl bg-background border border-onyx-border/20 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total HT</span>
            <span className="text-foreground tabular-nums">{formatAmount(totalHT)} €</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">TVA (10%)</span>
            <span className="text-foreground tabular-nums">{formatAmount(tva)} €</span>
          </div>
          {remiseAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Remise</span>
              <span className="text-rose-400 tabular-nums">-{formatAmount(remiseAmount)} €</span>
            </div>
          )}
          <div className="border-t border-onyx-border/20 pt-2 flex justify-between">
            <span className="text-sm font-semibold text-foreground">TOTAL TTC</span>
            <span className="text-lg font-bold text-gold tabular-nums">{formatAmount(totalTTC)} €</span>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" strokeWidth={1.5} />
          TVA applicable : 10% — Transport de personnes (Art. 279-b du CGI)
        </p>

        {/* Acompte toggle */}
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Acompte demandé</label>
          <button
            type="button"
            onClick={() => setShowAcompte(!showAcompte)}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              showAcompte ? "bg-gold" : "bg-onyx-border/50"
            )}
          >
            <span className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
              showAcompte ? "translate-x-5" : "translate-x-0.5"
            )} />
          </button>
        </div>

        {showAcompte && (
          <>
            <div className="flex gap-3">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setAcompteType("euro")}
                  className={cn(
                    "px-3 py-2 rounded-l-xl text-xs font-medium border-y border-l transition-all",
                    acompteType === "euro" ? "bg-gold/15 border-gold/40 text-gold" : "bg-secondary/30 border-onyx-border/50 text-muted-foreground"
                  )}
                >
                  €
                </button>
                <button
                  type="button"
                  onClick={() => setAcompteType("percent")}
                  className={cn(
                    "px-3 py-2 rounded-r-xl text-xs font-medium border-y border-r transition-all",
                    acompteType === "percent" ? "bg-gold/15 border-gold/40 text-gold" : "bg-secondary/30 border-onyx-border/50 text-muted-foreground"
                  )}
                >
                  %
                </button>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={acompteValue}
                onChange={(e) => setAcompteValue(e.target.value)}
                placeholder="0"
                className="flex-1 px-4 py-2 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground text-right focus:outline-none focus:border-gold/50"
                style={{ fontSize: "16px" }}
              />
            </div>
            {acompteAmount > 0 && (
              <p className="text-xs text-muted-foreground">
                Solde restant : <span className="text-gold font-semibold">{formatAmount(soldeRestant)} €</span>
              </p>
            )}
          </>
        )}
      </CollapsibleSection>

      {/* SECTION 6: CGV */}
      <CollapsibleSection title="Conditions générales" icon={<FileText className="h-4 w-4" strokeWidth={1.5} />}>
        <div className="p-3 rounded-xl bg-background border border-onyx-border/20">
          <ul className="space-y-1.5 text-[11px] text-muted-foreground">
            <li>• Paiement exigé <strong className="text-foreground">avant</strong> l&apos;exécution de la course</li>
            <li>• Annulation gratuite jusqu&apos;à <strong className="text-foreground">2h</strong> avant la prise en charge</li>
            <li>• En cas d&apos;annulation tardive : facturation de <strong className="text-foreground">50%</strong> du montant TTC</li>
            <li>• Temps d&apos;attente gratuit : <strong className="text-foreground">10 min</strong></li>
            <li>• Au-delà : facturation de <strong className="text-foreground">0,50 €/min</strong></li>
          </ul>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl bg-gold/5 border border-gold/20">
          <input
            type="checkbox"
            id="cgv-accept"
            checked={cgvAccepted}
            onChange={(e) => setCgvAccepted(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gold/30 bg-transparent text-gold focus:ring-gold/50"
          />
          <label htmlFor="cgv-accept" className="text-xs text-foreground leading-relaxed">
            Le client a pris connaissance et accepté les présentes conditions générales de vente
          </label>
        </div>
      </CollapsibleSection>

      {/* SECTION 7: Mentions légales */}
      <CollapsibleSection title="Mentions légales VTC" icon={<Shield className="h-4 w-4" strokeWidth={1.5} />}>
        <p className="text-[10px] text-muted-foreground mb-3">
          Informations requises par la réglementation VTC (Loi Thévenoud, Code des transports)
        </p>

        <InputField
          label="N° Carte VTC"
          required
          tag="Obligatoire"
          value={carteVTC}
          onChange={setCarteVTC}
          placeholder="VTC-075-XXXXXX"
          info="Délivrée par la préfecture"
        />

        <InputField
          label="N° Police d'assurance RC Pro"
          required
          tag="Obligatoire"
          value={policeRC}
          onChange={setPoliceRC}
          placeholder="Numéro de votre contrat"
          info="Assurance Responsabilité Civile Professionnelle obligatoire"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-background border border-onyx-border/20">
            <p className="text-[10px] text-muted-foreground mb-1">SIREN</p>
            <p className="text-xs font-medium text-foreground">{emetteurSiren || "—"}</p>
            <p className="text-[9px] text-gold mt-1">Voir profil émetteur</p>
          </div>
          <div className="p-3 rounded-xl bg-background border border-onyx-border/20">
            <p className="text-[10px] text-muted-foreground mb-1">Immatriculation</p>
            <p className="text-xs font-medium text-foreground">{immatriculation || "—"}</p>
            <p className="text-[9px] text-gold mt-1">Voir course</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-background border border-onyx-border/20">
          <p className="text-[10px] text-muted-foreground mb-1">Capacité maximale</p>
          <p className="text-xs font-medium text-foreground">{passagers} passager{passagers > 1 ? "s" : ""} maximum</p>
        </div>
      </CollapsibleSection>
    </div>
  )

  // ── Render Preview Tab ──
  const renderPreviewTab = () => (
    <div className="p-4 pb-40">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Document Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200 flex items-center justify-center">
                {emetteurLogo ? (
                  <img src={emetteurLogo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-lg font-bold text-amber-700">JD</span>
                )}
              </div>
              <div>
                <p className="font-bold text-gray-900">{emetteurNom}</p>
                <p className="text-xs text-gray-500">{emetteurAdresse}</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-lg font-bold text-gray-900">BON DE RÉSERVATION</h1>
              <p className="text-sm font-mono text-amber-600 mt-1">{brNumber}</p>
              <p className="text-xs text-gray-500 mt-1">Établi le {formatDate(now)} à {formatTime(now)}</p>
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-6 p-6 border-b border-gray-200">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Émetteur</p>
            <p className="text-sm font-semibold text-gray-900">{emetteurNom}</p>
            <p className="text-xs text-gray-600 mt-1">{emetteurAdresse}</p>
            <p className="text-xs text-gray-600">{emetteurEmail}</p>
            <p className="text-xs text-gray-600">{emetteurTel}</p>
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
              <span className="text-[9px] font-semibold text-amber-700">SIREN</span>
              <span className="text-[10px] font-mono text-amber-800">{emetteurSiren}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Destinataire</p>
            {clientType === "professionnel" ? (
              <>
                <p className="text-sm font-semibold text-gray-900">{clientRaisonSociale || "—"}</p>
                <p className="text-xs text-gray-600 mt-1">{clientAdresseFacturation || "—"}</p>
                {clientSiren && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                    <span className="text-[9px] font-semibold text-amber-700">SIREN</span>
                    <span className="text-[10px] font-mono text-amber-800">{clientSiren}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-900">{clientNom || "—"}</p>
                <p className="text-xs text-gray-600 mt-1">{clientEmail}</p>
                <p className="text-xs text-gray-600">{clientTel}</p>
              </>
            )}
          </div>
        </div>

        {/* Course Details */}
        <div className="p-6 border-b border-gray-200">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Détails de la course</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <p className="text-sm text-gray-900">{depart || "Point de départ"}</p>
          </div>
          {stops.map((stop, i) => (
            <div key={i} className="flex items-center gap-3 mb-3 pl-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <p className="text-sm text-gray-600">{stop || `Étape ${i + 1}`}</p>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-rose-500" />
            <p className="text-sm text-gray-900">{arrivee || "Point d'arrivée"}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400">Date & Heure</p>
              <p className="text-xs font-medium text-gray-900">{courseDate || "—"} à {courseHeure || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Véhicule</p>
              <p className="text-xs font-medium text-gray-900">{vehicule}</p>
              <p className="text-[10px] text-gray-500">{immatriculation}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Passagers</p>
              <p className="text-xs font-medium text-gray-900">{passagers} pax • {bagages} bagage{bagages > 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="p-6 border-b border-gray-200">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Tarification</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">{prestationDesc || "Prestation"}</span>
              <span className="font-mono text-gray-900">{formatAmount(montantHT)} €</span>
            </div>
            {supplements.map((sup) => (
              <div key={sup.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{sup.desc}</span>
                <span className="font-mono text-gray-900">{formatAmount(parseFloat(sup.montant) || 0)} €</span>
              </div>
            ))}
            {remiseAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Remise</span>
                <span className="font-mono text-rose-600">-{formatAmount(remiseAmount)} €</span>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total HT</span>
              <span className="font-mono text-gray-700">{formatAmount(totalHT)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">TVA 10%</span>
              <span className="font-mono text-gray-700">{formatAmount(tva)} €</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
              <span className="text-gray-900">TOTAL TTC</span>
              <span className="text-amber-600">{formatAmount(totalTTC)} €</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50">
          <div className="flex justify-between items-end">
            <div className="text-[9px] text-gray-400 max-w-[200px]">
              Les CGV sont fournies à titre indicatif. Validation juridique recommandée pour usage professionnel.
            </div>
            <div className="text-[8px] text-gray-400 text-right">
              Document généré via NoX VTC
            </div>
          </div>
        </div>
      </div>
    </div>
  )

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
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 active:scale-95 transition-all"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Nouveau Bon de Réservation</h1>
          <p className="text-[10px] text-muted-foreground">Les champs marqués * sont obligatoires</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 active:scale-95 transition-all"
        >
          <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-onyx-border/30">
        <button
          onClick={() => setActiveTab("form")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all",
            activeTab === "form" ? "bg-gold/15 text-gold" : "bg-onyx-card text-muted-foreground"
          )}
        >
          <Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} />
          Formulaire
        </button>
        <button
          onClick={() => setActiveTab("preview")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all",
            activeTab === "preview" ? "bg-gold/15 text-gold" : "bg-onyx-card text-muted-foreground"
          )}
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
          Aperçu PDF
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === "form" ? renderFormTab() : renderPreviewTab()}
      </div>

      {/* Sticky Actions */}
      <div className="px-4 py-4 border-t border-onyx-border/30 bg-background space-y-3">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-onyx-card border border-onyx-border/50 text-sm font-medium text-muted-foreground hover:border-gold/30 active:scale-[0.98] transition-all"
          >
            <Save className="h-4 w-4" strokeWidth={1.5} />
            Brouillon
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!cgvAccepted}
            className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl bg-gold text-primary-foreground text-sm font-semibold hover:bg-gold-light gold-glow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4" strokeWidth={1.5} />
            Générer le bon
          </button>
        </div>
        <div className="flex gap-2 justify-center">
          <button className="px-3 py-1.5 text-[10px] text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
            <Mail className="h-3 w-3" strokeWidth={1.5} />
            Envoyer par email
          </button>
          <button className="px-3 py-1.5 text-[10px] text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
            <Link2 className="h-3 w-3" strokeWidth={1.5} />
            Copier le lien
          </button>
          <button className="px-3 py-1.5 text-[10px] text-muted-foreground hover:text-gold transition-colors flex items-center gap-1">
            <Download className="h-3 w-3" strokeWidth={1.5} />
            Télécharger PDF
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Main Export ───────────────────────────────────────────────

export function CreateBCFlow({ open, onClose, prefillClient }: CreateBCProps) {
  const [step, setStep] = useState<BCStep>("choose")

  function handleClose() {
    setStep("choose")
    onClose()
  }

  if (!open) return null

  return (
    <AnimatePresence mode="wait">
      {step === "choose" && (
        <ChooseMethodSheet
          key="choose"
          onManual={() => setStep("manual")}
          onLink={() => setStep("link")}
          onClose={handleClose}
        />
      )}
      {step === "manual" && (
        <ManualBCForm
          key="manual"
          onBack={() => setStep("choose")}
          onClose={handleClose}
          prefillClient={prefillClient}
        />
      )}
      {step === "link" && (
        <ShareLinkScreen
          key="link"
          onBack={() => setStep("choose")}
          onClose={handleClose}
        />
      )}
    </AnimatePresence>
  )
}

"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Coins,
  Building2,
  FileText,
  Shield,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Bell,
  User,
  Users,
  Car,
  Lock,
  Calculator,

  Crown,
  Headphones,
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  BadgeCheck,
  Fingerprint,
  Eye,
  EyeOff,
  Hash,
  Sparkles,
  Globe,
  Upload,
  Palette,
  Calendar,
  AlertTriangle,
  ImageIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  Zap,
  BarChart3,
  Plus,
  X,
  History,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useNav } from "./nav-context"
import { LimitAlertModal } from "./limit-alert-modal"
import { GoldConfetti } from "./gold-confetti"
import { defaultTarifBase, defaultForfaits, defaultSupplements } from "./data"
import { DriverDrawer } from "./driver-drawer"
import { VehicleDrawer } from "./vehicle-drawer"
import { WalletDrawer } from "./wallet-drawer"
import { SubscriptionDrawer } from "./subscription-drawer"
import { ComplianceDot, getDriverComplianceStatus, getVehicleComplianceStatus } from "./compliance-dot"
import { CGVSettings } from "./cgv-settings"
import { TarifsSettings } from "./tarifs-settings"
import { useNox } from "./nox-context"
import { createClient } from "@/lib/supabase/client"
import type { Driver, Vehicle, Client, BCDocument, InvoiceDocument, BCStatus, InvoiceStatus } from "./data"
import { AccountSecurityScreen } from "./account-security/AccountSecurityScreen"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { usePromo } from "@/lib/hooks/usePromo"
import { SupportTicketModal } from "./support-ticket-modal"
import { getNotifPrefsAction, saveNotifPrefsAction } from "@/app/actions/notifications"
import type { NotifPrefs } from "@/app/actions/notifications"
import { SupportHistory } from "./support-history"
import { planLabel, getPlanLimits } from "@/lib/plans"
import { isPasswordStrong, PasswordStrengthIndicator } from "@/lib/password"
import { sendPasswordChangedEmailAction } from "@/app/actions/security"
import {
  getTwoFactorStatusAction,
  requestTwoFactorCodeAction,
  verifyTwoFactorCodeAction,
  enableTwoFactorAction,
  disableTwoFactorAction,
} from "@/app/actions/two-factor"

// ── Helpers : expiration la plus proche ───────────────────────

type ExpiryInfo = { label: string; dateLabel: string; color: string } | null

function getEarliestExpiry(dates: Array<{ label: string; date: string | undefined | null }>): ExpiryInfo {
  const now = new Date()
  const parsed: Array<{ label: string; date: Date; diff: number }> = []

  for (const entry of dates) {
    if (!entry.date) continue
    const d = new Date(entry.date)
    if (isNaN(d.getTime())) continue
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    parsed.push({ label: entry.label, date: d, diff })
  }

  if (parsed.length === 0) return null

  // Sort by date ascending — earliest first
  parsed.sort((a, b) => a.diff - b.diff)
  const nearest = parsed[0]

  const day = String(nearest.date.getDate()).padStart(2, '0')
  const month = String(nearest.date.getMonth() + 1).padStart(2, '0')
  const year = nearest.date.getFullYear()
  const dateLabel = `${day}/${month}/${year}`

  let color = '#888888'
  if (nearest.diff < 7) color = '#a13544'
  else if (nearest.diff <= 30) color = '#da7101'

  return { label: nearest.label, dateLabel, color }
}

// ── CardToggle : toggle actif / in-service sur carte ─────────

function CardToggle({
  value,
  onToggle,
}: {
  value: boolean
  onToggle: (next: boolean) => Promise<void>
}) {
  const [localValue, setLocalValue] = useState(value)
  const [loading, setLoading] = useState(false)

  // Sync with parent if external changes arrive
  useEffect(() => { setLocalValue(value) }, [value])

  async function handleTap(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading) return
    const next = !localValue
    setLocalValue(next) // optimistic
    setLoading(true)
    try {
      await onToggle(next)
    } catch {
      setLocalValue(!next) // rollback
      toast.error('Mise à jour échouée', { duration: 2500 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleTap}
      disabled={loading}
      aria-label={localValue ? 'Désactiver' : 'Activer'}
      style={{ transition: 'background-color 180ms ease' }}
      className={cn(
        'relative shrink-0 w-10 h-[22px] rounded-full focus:outline-none',
        loading ? 'opacity-60 cursor-default' : 'cursor-pointer',
        localValue ? 'bg-[#D4AF37]' : 'bg-[#333333]'
      )}
    >
      <motion.div
        className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm"
        animate={{ left: localValue ? 22 : 3 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
      />
    </button>
  )
}

class SettingsErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) { }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center h-full">
          <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Erreur d&apos;affichage</h2>
          <p className="text-sm text-gray-400 mb-4 whitespace-pre-wrap">{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })} className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SOLO_LIMIT = 1
const DUO_LIMIT = 2
const TEAM_LIMIT = 10

type SettingsScreen = "main" | "team" | "fleet" | "profile" | "accountSecurity" | "enterprise" | "subscription" | "plans" | "notifications" | "security" | "cgv" | "tarifs" | "wallet_history"

// ── Animation variants ────────────────────────────────────────

const slideIn = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
}

const slideBack = {
  initial: { opacity: 0, x: -60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 60 },
}

// ── Reusable Components ───────────────────────────────────────

export function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-2 pb-4">
      <button
        onClick={onBack}
        className="w-9 h-9 rounded-xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 active:scale-95 transition-all"
      >
        <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      </button>
      <h1 className="text-lg font-bold font-heading text-foreground">{title}</h1>
    </div>
  )
}

export function InfoCard({ icon, label, value, masked }: { icon: React.ReactNode; label: string; value: string; masked?: boolean }) {
  const [visible, setVisible] = useState(!masked)
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">
          {visible ? value : value.replace(/./g, "\u2022")}
        </p>
      </div>
      {masked && (
        <button onClick={() => setVisible(!visible)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary/40 transition-colors">
          {visible ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />}
        </button>
      )}
    </div>
  )
}

export function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "mx-4 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/40 overflow-hidden divide-y divide-onyx-border/20",
      className
    )}>
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 text-[10px] font-semibold font-heading text-muted-foreground uppercase tracking-[0.15em] mb-2">
      {children}
    </p>
  )
}

export interface SettingItem {
  icon: React.ReactNode
  label: string
  description?: string
  badge?: string
  alertBadge?: boolean
  screen?: SettingsScreen
}

export function SettingRow({ item, onPress }: { item: SettingItem; onPress?: () => void }) {
  const isClickable = !!onPress
  return (
    <button
      onClick={onPress}
      disabled={!isClickable}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3.5 transition-all duration-150 group",
        isClickable
          ? "hover:bg-gold/5 active:bg-gold/10 active:scale-[0.99] cursor-pointer"
          : "cursor-default"
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-150",
        isClickable
          ? "bg-secondary/60 text-muted-foreground group-hover:bg-gold/10 group-hover:text-gold group-active:bg-gold/15"
          : "bg-secondary/60 text-muted-foreground"
      )}>
        {item.icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn(
            "text-sm font-medium transition-colors duration-150",
            isClickable ? "text-foreground group-hover:text-gold" : "text-foreground"
          )}>{item.label}</p>
          {item.badge && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-gold/10 text-gold border border-gold/20">
              {item.badge}
            </span>
          )}
          {item.alertBadge && (
            <span className="w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-red-500 text-white shrink-0">
              !
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.description}</p>
        )}
      </div>
      {isClickable && (
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-gold/50" strokeWidth={1.5} />
      )}
    </button>
  )
}

// ── Mon Profil Screen ──────────────────────────────────────────

function ProfileScreen({ onBack }: { onBack: () => void }) {
  const [editing, setEditing] = useState(false)
  const [socials, setSocials] = useState([
    { name: "Google", connected: true, color: "bg-red-500/10 border-red-500/20 text-red-400", hoverColor: "hover:bg-red-500/20 hover:border-red-500/30" },
    { name: "Facebook", connected: false, color: "bg-blue-600/10 border-blue-600/20 text-blue-500", hoverColor: "hover:bg-blue-600/20 hover:border-blue-600/30" },
    { name: "Apple", connected: false, color: "bg-white/5 border-white/10 text-foreground", hoverColor: "hover:bg-white/10 hover:border-white/20" },
  ])
  const [userMetadata, setUserMetadata] = useState<{ displayName: string; initials: string; email: string; phone: string }>({ displayName: "", initials: "—", email: "", phone: "" })

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ""
      const firstName = user.user_metadata?.given_name || ""
      const lastName = user.user_metadata?.family_name || ""
      const userEmail = user.email || ""

      let nameToDisplay = ""
      let initialsToDisplay = "—"

      if (fullName) {
        nameToDisplay = fullName
        const parts = fullName.trim().split(" ")
        initialsToDisplay = parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : fullName.substring(0, 2).toUpperCase()
      } else if (firstName || lastName) {
        nameToDisplay = `${firstName} ${lastName}`.trim()
        initialsToDisplay = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "—"
      } else if (userEmail) {
        nameToDisplay = userEmail.split("@")[0]
        initialsToDisplay = nameToDisplay.substring(0, 2).toUpperCase()
      }

      let phoneToDisplay = user.phone || user.user_metadata?.phone || ""
      try {
        const { data: acc } = await supabase.from("user_accounts").select("phone").eq("id", user.id).single()
        if (acc?.phone) phoneToDisplay = acc.phone
      } catch (e) {}

      setUserMetadata({ displayName: nameToDisplay, initials: initialsToDisplay, email: userEmail, phone: phoneToDisplay })
    }
    loadUser()
  }, [])

  function toggleSocial(name: string) {
    setSocials((prev) =>
      prev.map((s) => (s.name === name ? { ...s, connected: !s.connected } : s))
    )
  }

  return (
    <motion.div key="profile" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <SubScreenHeader title="Mon Profil" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Avatar + Identity */}
        <div className="flex flex-col items-center px-4 mb-6">
          <div className="relative mb-3">
            <button
              onClick={() => setEditing(!editing)}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-gold/30 via-gold/15 to-gold/5 border-2 border-gold/40 flex items-center justify-center hover:border-gold/70 hover:from-gold/40 active:scale-95 transition-all"
            >
              <span className="text-2xl font-bold font-heading text-gold">{userMetadata.initials}</span>
            </button>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gold flex items-center justify-center border-2 border-background">
              <BadgeCheck className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-lg font-bold font-heading text-foreground">{userMetadata.displayName || "Non renseigné"}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Utilisateur NoX VTC</p>
        </div>

        {/* Contact Info */}
        <SectionLabel>Coordonnées</SectionLabel>
        <GlassCard className="mb-5">
          {editing ? (
            <div className="p-4 space-y-3">
              <input
                type="email"
                value={userMetadata.email}
                onChange={(e) => setUserMetadata({ ...userMetadata, email: e.target.value })}
                placeholder="Votre email"
                className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
              />
              <input
                type="tel"
                value={userMetadata.phone}
                onChange={(e) => setUserMetadata({ ...userMetadata, phone: e.target.value })}
                placeholder="+33 6 00 00 00 00"
                className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>
          ) : (
            <>
              <InfoCard icon={<Mail className="h-4 w-4 text-gold" strokeWidth={1.5} />} label="Email" value={userMetadata.email || "Non renseigné"} />
              <InfoCard icon={<Phone className="h-4 w-4 text-gold" strokeWidth={1.5} />} label="Téléphone" value={userMetadata.phone || "Non renseigné"} />
            </>
          )}
        </GlassCard>

        {/* Social Login Badges */}
        <SectionLabel>Connexion sociale</SectionLabel>
        <div className="flex gap-3 px-4 mb-5">
          {socials.map((social) => (
            <button
              key={social.name}
              onClick={() => toggleSocial(social.name)}
              className={cn(
                "flex-1 py-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all duration-150 active:scale-95",
                social.connected
                  ? `${social.color} ${social.hoverColor}`
                  : `bg-secondary/20 border-onyx-border/30 opacity-40 hover:opacity-70 hover:border-gold/20`
              )}
            >
              <Globe className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-[10px] font-semibold">{social.name}</span>
              <span className="text-[8px] opacity-70">{social.connected ? "Connecté" : "Connecter"}</span>
            </button>
          ))}
        </div>

        {/* Edit / Save button */}
        <div className="px-4">
          <button
            onClick={async () => {
              if (editing) {
                // Save to Supabase backend
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                  await supabase
                    .from('user_accounts')
                    .update({ phone: userMetadata.phone })
                    .eq('id', user.id)
                }
                setEditing(false)
              } else {
                setEditing(true)
              }
            }}
            className={cn(
              "w-full py-3 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-all",
              editing
                ? "bg-gold text-primary-foreground hover:bg-gold-light gold-glow-sm"
                : "bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20"
            )}
          >
            {editing ? "Enregistrer les modifications" : "Modifier mon profil"}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Profil Entreprise Screen ───────────────────────────────────

function getExpirationStatus(dateStr: string): { label: string; color: string } {
  if (!dateStr) return { label: "", color: "" }
  const target = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: "Expiré", color: "bg-red-500/15 text-red-400 border-red-500/25" }
  if (diffDays <= 30) return { label: `Expire dans ${diffDays}j`, color: "bg-amber-500/15 text-amber-400 border-amber-500/25" }
  if (diffDays <= 90) return { label: `Valide (${diffDays}j)`, color: "bg-gold/15 text-gold border-gold/25" }
  return { label: "Valide", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" }
}

const BRAND_COLORS = [
  { name: "Or Sablé", value: "#C5A059" },
  { name: "Noir Onyx", value: "#0F0F0F" },
  { name: "Bleu Nuit", value: "#1E3A5F" },
  { name: "Bordeaux", value: "#6B1D2A" },
  { name: "Émeraude", value: "#1B6B4A" },
  { name: "Argent Chromé", value: "#9CA3AF" },
]

function getVatFromStatut(statut: string): { vatMode: 'franchise' | 'normal'; isMicroEntrepreneur: boolean } {
  if (statut === 'Micro-Entreprise') return { vatMode: 'franchise', isMicroEntrepreneur: true }
  if (statut === 'EI' || statut === 'EIRL') return { vatMode: 'franchise', isMicroEntrepreneur: false }
  return { vatMode: 'normal', isMicroEntrepreneur: false }
}

function EnterpriseScreen({ onBack }: { onBack: () => void }) {
  const { enterprise, updateEnterprise } = useNox()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  // Statut juridique
  const [statutJuridique, setStatutJuridique] = useState(enterprise.statutJuridique || "")

  // Identité visuelle
  const [logoPreview, setLogoPreview] = useState<string | null>(enterprise.logo || null)
  const [logoName, setLogoName] = useState(enterprise.logo ? "logo_actuel.png" : "")
  const [brandColor, setBrandColor] = useState(enterprise.brandColor || "#C5A059")

  // Informations legales
  const [legal, setLegal] = useState({
    denomination: enterprise.name || "",
    siren: enterprise.siren || "",
    tvaIntra: enterprise.tva || "",
    adresse: enterprise.adresse || "",
    complementAdresse: enterprise.complementAdresse || "",
    codePostal: enterprise.zipCode || "",
    ville: enterprise.city || "",
    pays: enterprise.pays || "",
  })

  // Conformité VTC
  const [compliance, setCompliance] = useState({
    registreVTC: enterprise.registreVTC || "",
    dateRegistre: enterprise.dateRegistre || "",
    dateAssurance: enterprise.dateAssurance || "",
  })

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/enterprise/upload-logo", { method: "POST", body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erreur upload")
      setLogoPreview(json.url)
      setLogoName(file.name)
    } catch (err) {
      toast.error("Échec de l'upload du logo. Veuillez réessayer.")
      console.error(err)
    } finally {
      setLogoUploading(false)
    }
  }

  function handleSave() {
    try {
      const vatFields = statutJuridique ? getVatFromStatut(statutJuridique) : {}
      updateEnterprise({
        name: legal.denomination,
        siren: legal.siren,
        tva: legal.tvaIntra,
        adresse: legal.adresse,
        complementAdresse: legal.complementAdresse,
        zipCode: legal.codePostal,
        city: legal.ville,
        pays: legal.pays,
        brandColor,
        logo: logoPreview || undefined,
        registreVTC: compliance.registreVTC,
        dateRegistre: compliance.dateRegistre,
        dateAssurance: compliance.dateAssurance,
        statutJuridique: statutJuridique || undefined,
        ...vatFields
      })
      toast.success("Modifications enregistrées ✓", { duration: 3000 })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      toast.error("Une erreur est survenue, veuillez réessayer")
    }
  }

  const registreStatus = getExpirationStatus(compliance.dateRegistre)
  const assuranceStatus = getExpirationStatus(compliance.dateAssurance)

  return (
    <motion.div key="enterprise" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full relative">
      <SubScreenHeader title="Profil Entreprise" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-6">

        {/* ── Section 0: Statut Juridique ── */}
        <SectionLabel>Statut juridique</SectionLabel>
        <GlassCard className="mb-3">
          <div className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Forme juridique</p>
            <select
              value={statutJuridique}
              onChange={(e) => setStatutJuridique(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors appearance-none"
            >
              <option value="" className="bg-onyx text-muted-foreground">Sélectionner...</option>
              <option value="Micro-Entreprise" className="bg-onyx text-white">Micro-Entreprise</option>
              <option value="EI" className="bg-onyx text-white">EI</option>
              <option value="EIRL" className="bg-onyx text-white">EIRL</option>
              <option value="EURL" className="bg-onyx text-white">EURL</option>
              <option value="SAS" className="bg-onyx text-white">SAS</option>
              <option value="SASU" className="bg-onyx text-white">SASU</option>
              <option value="SARL" className="bg-onyx text-white">SARL</option>
            </select>
            {(statutJuridique === 'EI' || statutJuridique === 'EIRL') && (
              <p className="text-[10px] text-amber-500 mt-1.5">
                Si votre CA annuel dépasse 37 500€, passez en régime TVA normal dans vos réglages.
              </p>
            )}
          </div>
        </GlassCard>

        {/* ── Section 1: Identite Visuelle ── */}
        <SectionLabel>Identite visuelle</SectionLabel>
        <GlassCard className="mb-3">
          {/* Logo Upload */}
          <div className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Logo de l&apos;entreprise</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.svg,.jpg,.jpeg,.webp"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              onClick={() => !logoUploading && fileInputRef.current?.click()}
              disabled={logoUploading}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-onyx-border/50 hover:border-gold/40 hover:bg-gold/5 active:scale-[0.99] transition-all group disabled:opacity-60 disabled:cursor-wait"
            >
              {logoPreview ? (
                <div className="w-11 h-11 rounded-lg border border-gold/30 overflow-hidden bg-onyx-card shrink-0 flex items-center justify-center">
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 group-hover:bg-gold/15 transition-colors">
                  <ImageIcon className="h-5 w-5 text-gold/60 group-hover:text-gold transition-colors" strokeWidth={1.5} />
                </div>
              )}
              <div className="flex-1 text-left min-w-0">
                {logoUploading ? (
                  <>
                    <p className="text-sm font-medium text-foreground">Upload en cours…</p>
                    <p className="text-[10px] text-gold animate-pulse">Envoi vers le serveur</p>
                  </>
                ) : logoName ? (
                  <>
                    <p className="text-sm font-medium text-foreground truncate">{logoName}</p>
                    <p className="text-[10px] text-emerald-400">Importé</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Importer votre logo</p>
                    <p className="text-[10px] text-muted-foreground/60">PNG, SVG, JPG (max 2 Mo)</p>
                  </>
                )}
              </div>
              <Upload className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-gold/50 transition-colors" strokeWidth={1.5} />
            </button>
          </div>

          {/* Brand Color Pastilles */}
          <div className="px-3 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2.5 flex items-center gap-1.5">
              <Palette className="h-3 w-3" strokeWidth={1.5} />
              Couleur de marque
            </p>
            <div className="flex items-start justify-between gap-1">
              {BRAND_COLORS.map((c) => {
                const isActive = brandColor === c.value
                return (
                  <button
                    key={c.value}
                    onClick={() => setBrandColor(c.value)}
                    className="flex flex-col items-center gap-1.5 flex-1 min-w-0 active:scale-95 transition-transform"
                  >
                    <div className="relative">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full transition-all duration-200",
                          isActive && "ring-2 ring-gold ring-offset-2 ring-offset-background"
                        )}
                        style={{
                          backgroundColor: c.value,
                          boxShadow: isActive ? `0 0 12px ${c.value}50` : "none",
                        }}
                      />
                      {isActive && (
                        <motion.div
                          layoutId="color-check"
                          className="absolute inset-0 flex items-center justify-center"
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        >
                          <CheckCircle2 className="h-4 w-4 text-white drop-shadow-md" strokeWidth={2} />
                        </motion.div>
                      )}
                    </div>
                    <span className={cn(
                      "text-[8px] leading-tight text-center truncate w-full",
                      isActive ? "font-semibold text-gold" : "text-muted-foreground/60"
                    )}>{c.name}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[9px] text-muted-foreground/50 mt-2">
              Appliquée aux liens clients, factures et bons de commande.
            </p>
          </div>
        </GlassCard>

        {/* ── Section 2: Informations Legales ── */}
        <SectionLabel>Informations legales</SectionLabel>
        <GlassCard className="mb-3">
          <div className="p-3 space-y-2.5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Denomination sociale</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                </div>
                <input
                  type="text"
                  value={legal.denomination}
                  onChange={(e) => setLegal({ ...legal, denomination: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Numero SIREN / SIRET</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <Hash className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                </div>
                <input
                  type="text"
                  value={legal.siren}
                  onChange={(e) => setLegal({ ...legal, siren: e.target.value })}
                  placeholder="9 ou 14 chiffres"
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground font-mono focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">N° TVA Intracommunautaire</p>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gold/10 text-gold border border-gold/20">Factur-X</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <FileText className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                </div>
                <input
                  type="text"
                  value={legal.tvaIntra}
                  onChange={(e) => setLegal({ ...legal, tvaIntra: e.target.value })}
                  placeholder="FR12 123456789"
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground font-mono focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1 ml-10">Si assujetti a la TVA - utilise pour vos documents legaux</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Adresse du siege social</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                </div>
                <PlacesAutocomplete
                  value={legal.adresse}
                  onChange={(val) => setLegal({ ...legal, adresse: val })}
                  onPostalCode={(val) => setLegal(prev => ({ ...prev, codePostal: val }))}
                  onCity={(val) => setLegal(prev => ({ ...prev, ville: val }))}
                  onCountry={(val) => setLegal(prev => ({ ...prev, pays: val }))}
                  placeholder="Adresse du siège social"
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Complément d'adresse</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-gold/50" strokeWidth={1.5} />
                </div>
                <input
                  type="text"
                  value={legal.complementAdresse}
                  onChange={(e) => setLegal({ ...legal, complementAdresse: e.target.value })}
                  placeholder="Bâtiment, étage... (Optionnel)"
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Code postal</p>
                <input
                  type="text"
                  value={legal.codePostal}
                  onChange={(e) => setLegal({ ...legal, codePostal: e.target.value })}
                  placeholder="75000"
                  maxLength={5}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Ville</p>
                <input
                  type="text"
                  value={legal.ville}
                  onChange={(e) => setLegal({ ...legal, ville: e.target.value })}
                  placeholder="Paris"
                  className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Pays</p>
              <input
                type="text"
                value={legal.pays}
                onChange={(e) => setLegal({ ...legal, pays: e.target.value })}
                placeholder="France"
                className="w-full px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>
          </div>
        </GlassCard>

        {/* ── Section 3: Conformite VTC ── */}
        <SectionLabel>Conformite VTC</SectionLabel>
        <GlassCard className="mb-3">
          <div className="p-3 space-y-2.5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">N inscription au registre VTC</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <FileText className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                </div>
                <input
                  type="text"
                  value={compliance.registreVTC}
                  onChange={(e) => setCompliance({ ...compliance, registreVTC: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground font-mono focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>

            {/* Date Registre VTC */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Validite du registre VTC</p>
                {registreStatus.label && (
                  <span className={cn("px-1.5 py-0.5 text-[8px] font-semibold rounded border", registreStatus.color)}>
                    {registreStatus.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                  registreStatus.label === "Expiré" ? "bg-red-500/10 border-red-500/20" : "bg-gold/10 border-gold/20"
                )}>
                  <Calendar className={cn("h-3.5 w-3.5", registreStatus.label === "Expiré" ? "text-red-400" : "text-gold")} strokeWidth={1.5} />
                </div>
                <input
                  type="date"
                  value={compliance.dateRegistre}
                  onChange={(e) => setCompliance({ ...compliance, dateRegistre: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Date Assurance RC Pro */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Assurance RC Professionnelle</p>
                {assuranceStatus.label && (
                  <span className={cn("px-1.5 py-0.5 text-[8px] font-semibold rounded border", assuranceStatus.color)}>
                    {assuranceStatus.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                  assuranceStatus.label === "Expiré" ? "bg-red-500/10 border-red-500/20" : "bg-gold/10 border-gold/20"
                )}>
                  <Shield className={cn("h-3.5 w-3.5", assuranceStatus.label === "Expiré" ? "text-red-400" : "text-gold")} strokeWidth={1.5} />
                </div>
                <input
                  type="date"
                  value={compliance.dateAssurance}
                  onChange={(e) => setCompliance({ ...compliance, dateAssurance: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Expiration Warning */}
            {(registreStatus.label === "Expiré" || assuranceStatus.label === "Expiré") && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" strokeWidth={1.5} />
                <p className="text-[10px] text-red-400 font-medium">
                  Document(s) expiré(s). Mettez à jour pour rester en conformité.
                </p>
              </motion.div>
            )}
          </div>
        </GlassCard>

        {/* ── Info Notice ── */}
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-gold/5 border border-gold/15 flex items-start gap-2">
          <Sparkles className="h-3 w-3 text-gold/60 shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-[9px] text-muted-foreground/70 leading-relaxed">
            Logo et nom commercial automatiquement injectés sur factures, BC et liens clients.
          </p>
        </div>
      </div>

      {/* ── Fixed Save Button ── */}
      {/* ── Fixed Save Button ── */}
      <div className="shrink-0 px-4 py-4 border-t border-onyx-border/20 bg-background z-10 w-full">
        <button
          onClick={handleSave}
          disabled={saved}
          className={cn(
            "w-full py-3.5 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2",
            saved
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
              : "bg-gold text-primary-foreground hover:bg-gold-light gold-glow"
          )}
        >
          {saved ? (
            <>
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
              Modifications enregistrées
            </>
          ) : (
            "Enregistrer les modifications"
          )}
        </button>
      </div>
    </motion.div>
  )
}

// ── Abonnement Screen (statut personnel) ──────────────────────

function SubscriptionScreen({ onBack, onNavigatePlans }: { onBack: () => void; onNavigatePlans: () => void }) {
  const { plan, subscriptionStatus, trialEndsAt } = useNox()
  const isTeam = plan === "TEAM"
  const isDuo = plan === "DUO"
  const isTrial = subscriptionStatus === "trial"
  const [subDetails, setSubDetails] = useState<{ cancel_at: string | null; current_period_end: string | null } | null>(null)

  function fmtDateFr(iso: string | null): string {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('subscriptions')
      .select('cancel_at, current_period_end')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as { cancel_at: string | null; current_period_end: string | null }
          setSubDetails({ cancel_at: d.cancel_at, current_period_end: d.current_period_end })
        }
      })
  }, [])

  return (
    <motion.div key="subscription" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <SubScreenHeader title="Mon Abonnement" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Current Plan Banner */}
        <div className={cn(
          "mx-4 mb-5 p-5 rounded-2xl border",
          isTeam
            ? "bg-gradient-to-br from-gold/15 via-gold/5 to-transparent border-gold/40 gold-glow-sm"
            : isDuo
              ? "bg-gold/5 border-gold/30"
              : "bg-onyx-card border-onyx-border/30"
        )}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {isTrial ? "Plan actuel (Essai)" : "Plan actuel"}
              </p>
              <p className={cn(
                "text-2xl font-bold font-heading mt-0.5",
                isTeam ? "gold-gradient-text" : isDuo ? "text-gold" : "text-foreground"
              )}>
                {planLabel(plan)}
              </p>
              {isTrial && trialEndsAt && (
                <p className="text-xs text-gold/80 mt-1">
                  Accès gratuit jusqu&apos;au {fmtDateFr(trialEndsAt)}
                </p>
              )}
              {!isTrial && (plan === "DUO" || plan === "TEAM") && (
                subDetails?.cancel_at ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Actif jusqu&apos;au {fmtDateFr(subDetails.cancel_at)}, puis retour automatique en Starter
                  </p>
                ) : subDetails?.current_period_end ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Valide jusqu&apos;au {fmtDateFr(subDetails.current_period_end)}
                  </p>
                ) : null
              )}
            </div>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              isTeam ? "bg-gold/20 border border-gold/40" : "bg-gold/10 border border-gold/20"
            )}>
              <Crown className={cn("h-6 w-6", isTeam ? "text-gold" : "text-gold/60")} strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isTrial
              ? "Profitez de toutes les fonctionnalités pendant votre essai. Souscrivez pour continuer après."
              : isTeam
                ? "Vous profitez de toutes les fonctionnalités premium NoX VTC."
                : isDuo
                  ? "Documents illimités inclus. Passez en Premium pour gérer votre flotte complète."
                  : "Paiement à l'usage via jetons. Passez en Pro ou Premium pour des documents illimités."
            }
          </p>
        </div>

        {/* CTA Voir les offres */}
        <div className="px-4 mb-5">
          <button
            onClick={onNavigatePlans}
            className="w-full py-3 rounded-2xl bg-gold/10 border border-gold/30 text-gold text-xs font-bold flex items-center justify-center gap-2 hover:bg-gold/15 active:scale-[0.98] transition-all"
          >
            Voir toutes les offres
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Token conservation note */}
        <div className="mx-4 mb-5 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-onyx-card/50 border border-onyx-border/20">
          <Coins className="h-3.5 w-3.5 text-gold/50 shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {"Vos jetons acquis sont conservés précieusement en cas de changement d'offre."}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// ── Plans Screen (vitrine des offres) ─────────────────────────

function PlansScreen({ onBack }: { onBack: () => void }) {
  const { plan, subscriptionStatus, trialEndsAt } = useNox()
  const { promo } = usePromo()
  const isTeam = plan === "TEAM"
  const isDuo = plan === "DUO"
  const isTrial = subscriptionStatus === "trial"
  const [targetPlan, setTargetPlan] = useState<"DUO" | "TEAM" | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [subDetails, setSubDetails] = useState<{ cancel_at: string | null; current_period_end: string | null; status: string | null; trial_ends_at: string | null } | null>(null)

  function handleChoose(target: "DUO" | "TEAM") { setTargetPlan(target) }

  function fmtPrice(n: number) {
    return (Math.floor(n * 100) / 100).toFixed(2).replace('.', ',') + '€'
  }

  function fmtDateFr(iso: string | null): string {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('subscriptions')
      .select('cancel_at, current_period_end, status, trial_ends_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as { cancel_at: string | null; current_period_end: string | null; status: string | null; trial_ends_at: string | null }
          setSubDetails({ cancel_at: d.cancel_at, current_period_end: d.current_period_end, status: d.status, trial_ends_at: d.trial_ends_at })
        }
      })
  }, [])

  async function handleConfirmCancel() {
    setIsCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch('/api/subscription/cancel', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setCancelError(data.error ?? 'Erreur lors de la résiliation')
      } else {
        setSubDetails(prev => ({ ...(prev ?? { current_period_end: null, status: null, trial_ends_at: null }), cancel_at: data.cancel_at }))
        toast("Fin d’abonnement enregistrée", {
          description: data.cancel_at
            ? `Votre accès reste actif jusqu'au ${fmtDateFr(data.cancel_at)}, puis retour automatique en Starter.`
            : "Votre demande a bien été enregistrée.",
          duration: 5000,
        })
      }
    } catch {
      setCancelError('Erreur réseau, veuillez réessayer')
    } finally {
      setIsCancelling(false)
      setShowCancelConfirm(false)
    }
  }

  const planCards = [
    {
      id: "SOLO" as const,
      name: "Starter",
      subtitle: "L'offre Indépendant",
      price: null as number | null,
      capacity: `Max ${getPlanLimits("solo").drivers} Chauffeur / Max ${getPlanLimits("solo").vehicles} Véhicule`,
      features: ["Signature Entreprise incluse", "Paiement à l'usage (jetons)"],
    },
    {
      id: "DUO" as const,
      name: "Pro",
      subtitle: "L'offre Binôme",
      price: 4.99 as number | null,
      priceSuffix: "/mois",
      capacity: `Max ${getPlanLimits("duo").drivers} Chauffeurs / Max ${getPlanLimits("duo").vehicles} Véhicules`,
      features: ["Signature Entreprise incluse", "Documents ILLIMITÉS"],
    },
    {
      id: "TEAM" as const,
      name: "Premium",
      subtitle: "L'offre Flotte",
      price: 9.99 as number | null,
      priceSuffix: "/mois",
      capacity: `Max ${getPlanLimits("team").drivers} Chauffeurs / Max ${getPlanLimits("team").vehicles} Véhicules`,
      features: ["Signature Entreprise incluse", "Documents ILLIMITÉS", "API & Intégrations", "Statistiques avancées"],
    },
  ]

  return (
    <motion.div key="plans" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <SubScreenHeader title="Découvrir les offres" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-24">
        <SectionLabel>Offres disponibles</SectionLabel>
        <div className="space-y-3 px-4 mb-4">
          {planCards.map((p) => {
            const isCurrent = p.id === plan
            const isPlanTeam = p.id === "TEAM"
            const isPlanDuo = p.id === "DUO"
            const isUpgrade = !isCurrent && (
              (plan === "SOLO") ||
              (plan === "DUO" && p.id === "TEAM")
            )

            return (
              <div key={p.id} className={cn(
                "p-4 rounded-2xl border transition-all",
                isCurrent
                  ? isPlanTeam
                    ? "bg-gradient-to-br from-gold/15 via-gold/5 to-transparent border-gold/40 gold-glow-sm"
                    : isPlanDuo
                      ? "bg-gold/10 border-gold/40"
                      : "bg-onyx-card border-gold/30"
                  : "bg-onyx-card/70 border-onyx-border/30"
              )}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h3 className={cn("text-sm font-bold font-heading", isPlanTeam ? (isCurrent ? "gold-gradient-text" : "text-foreground") : isPlanDuo ? (isCurrent ? "text-gold" : "text-foreground") : "text-foreground")}>{p.name}</h3>
                    <span className="text-[9px] text-muted-foreground font-medium italic">{p.subtitle}</span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 text-[7px] font-bold rounded-full bg-[#D4AF37] text-[#0E0E0E] uppercase tracking-wide shadow-[0_0_10px_rgba(212,175,55,0.3)]">Offre Active</span>
                    )}
                  </div>
                  <div className="text-right">
                    {(isPlanDuo || isPlanTeam) && plan === "SOLO" && promo.active && p.price !== null ? (
                      <>
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-[10px] text-muted-foreground line-through">{fmtPrice(p.price)}</span>
                          <span className={cn("text-sm font-bold", (isPlanTeam || isPlanDuo) && isCurrent ? "text-gold" : "text-foreground")}>
                            {fmtPrice(p.price * (1 - promo.percent / 100))}
                          </span>
                          <span className="px-1 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-bold">-{promo.percent}%</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">1er mois · puis {fmtPrice(p.price)}/mois</span>
                      </>
                    ) : (
                      <>
                        <span className={cn("text-sm font-bold", (isPlanTeam || isPlanDuo) && isCurrent ? "text-gold" : "text-foreground")}>
                          {p.price !== null ? fmtPrice(p.price) : "Gratuit"}
                        </span>
                        {"priceSuffix" in p && p.priceSuffix && (
                          <span className="text-[10px] font-normal text-muted-foreground">{p.priceSuffix}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <p className={cn(
                  "text-[10px] font-semibold mb-2",
                  isPlanTeam ? "text-gold/80" : isPlanDuo ? "text-gold/70" : "text-muted-foreground"
                )}>
                  {p.capacity}
                </p>

                <div className="space-y-1.5">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className={cn("h-3 w-3 shrink-0", isPlanTeam ? "text-gold" : isPlanDuo ? "text-gold/60" : "text-muted-foreground")} strokeWidth={2} />
                      <span className={cn("text-[11px]", f.includes("ILLIMIT") ? "font-semibold text-gold" : isCurrent ? "text-foreground" : "text-muted-foreground")}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* Upgrade CTA — ou switch pendant un essai (sauf SOLO) */}
                {!isCurrent && (isUpgrade || (isTrial && p.id !== "SOLO")) && (
                  <button
                    onClick={() => handleChoose(p.id as "DUO" | "TEAM")}
                    className={cn(
                      "w-full mt-3 py-2.5 rounded-xl text-xs font-bold active:scale-[0.98] transition-all",
                      isPlanTeam
                        ? "bg-gold text-primary-foreground hover:bg-gold-light gold-glow"
                        : "bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25"
                    )}
                  >
                    Choisir cette offre
                  </button>
                )}

                {/* Starter pendant un essai → annuler l'essai */}
                {!isCurrent && isTrial && p.id === "SOLO" && (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full mt-3 py-2.5 rounded-xl bg-gold/15 border border-gold/30 text-gold text-xs font-bold active:scale-[0.98] transition-all hover:bg-gold/25"
                  >
                    Choisir cette offre
                  </button>
                )}

                {/* Actions sous la carte du plan actif */}
                {isCurrent && (plan === "DUO" || plan === "TEAM") && (
                  isTrial ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-center text-[11px] text-muted-foreground">
                        Essai gratuit — fin le {fmtDateFr(subDetails?.trial_ends_at ?? trialEndsAt)}
                      </p>
                      <button
                        onClick={() => handleChoose(plan as "DUO" | "TEAM")}
                        className="w-full py-2.5 rounded-xl bg-gold text-primary-foreground text-xs font-bold active:scale-[0.98] transition-all hover:bg-gold-light gold-glow"
                      >
                        Choisir cette offre
                      </button>
                    </div>
                  ) : subDetails?.cancel_at ? (
                    <p className="w-full mt-3 py-2 text-center text-[11px] text-muted-foreground">
                      Actif jusqu&apos;au {fmtDateFr(subDetails.cancel_at)}, puis retour automatique en Starter
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {subDetails?.current_period_end && (
                        <p className="text-center text-[11px] text-muted-foreground">
                          Valide jusqu&apos;au {fmtDateFr(subDetails.current_period_end)}
                        </p>
                      )}
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="w-full py-2 rounded-xl text-[11px] font-medium text-red-400 border border-red-500/30 hover:border-red-500/50 hover:bg-red-500/5 active:scale-[0.98] transition-all"
                      >
                        Mettre fin à mon abonnement
                      </button>
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>

        <div className="mx-4 mb-5 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-onyx-card/50 border border-onyx-border/20">
          <Coins className="h-3.5 w-3.5 text-gold/50 shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {"Vos jetons acquis sont conservés précieusement en cas de changement d'offre."}
          </p>
        </div>
      </div>

      <SubscriptionDrawer
        open={!!targetPlan}
        targetPlan={targetPlan}
        onClose={() => setTargetPlan(null)}
      />

      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => { if (!isCancelling) setShowCancelConfirm(false) }} />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="absolute bottom-0 left-0 right-0 mx-auto mb-10 w-[calc(100%-2rem)] max-w-md rounded-2xl bg-[#0A0A0A] border border-red-500/40 shadow-[0_8px_40px_rgba(0,0,0,0.9)] p-4 pb-safe"
            >
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full border border-[#333] bg-[#1A1A1A] flex items-center justify-center hover:bg-[#222] active:scale-[0.95] transition-all disabled:opacity-40"
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5 text-[#A1A1AA]" strokeWidth={2.5} />
              </button>
              <div className="flex justify-center mb-3 mt-1">
                <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle className="h-4.5 w-4.5 text-red-400" strokeWidth={1.5} />
                </div>
              </div>
              <p className="text-xs font-bold text-red-400 text-center tracking-wider uppercase mb-3">
                Confirmer la fin d'abonnement
              </p>
              <div className="text-[11px] text-[#A1A1AA] text-center leading-relaxed px-1 mb-1 space-y-1.5">
                <p>Votre offre <span className="text-foreground font-medium">{planLabel(plan)}</span> restera active jusqu'à la fin de la période en cours.</p>
                <p>
                  {subDetails?.current_period_end
                    ? <>Accès confirmé jusqu'au <span className="text-foreground font-semibold">{fmtDateFr(subDetails.current_period_end)}</span>.</>
                    : "Votre accès restera actif jusqu'à la fin de votre période actuelle."}
                </p>
                <p>Après cette date, vous passerez automatiquement en <span className="text-foreground font-medium">Starter</span>.</p>
              </div>
              {cancelError && (
                <p className="text-[10px] text-red-400 text-center mt-2">{cancelError}</p>
              )}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isCancelling}
                  className="flex-1 py-2.5 min-h-[44px] rounded-xl text-[11px] font-semibold text-[#A1A1AA] border border-[#333] hover:border-[#555] active:scale-[0.97] transition-all disabled:opacity-40"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={isCancelling}
                  className="flex-1 py-2.5 min-h-[44px] rounded-xl text-[11px] font-bold bg-red-500/90 text-white hover:bg-red-600 active:scale-[0.97] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCancelling ? <span className="animate-pulse">En cours...</span> : 'Confirmer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Locked Slot ───────────────────────────────────────────────

function LockedSlot({ type }: { type: "driver" | "vehicle"; onUpgrade: () => void }) {
  const { plan, upgrade } = useNox()
  const { promo } = usePromo()
  const limitLabel = type === "driver" ? "chauffeurs" : "vehicules"
  const currentLimit = plan === "SOLO" ? SOLO_LIMIT : DUO_LIMIT
  return (
    <div className="relative min-h-[280px] rounded-2xl bg-onyx-card/40 border border-onyx-border/30 overflow-hidden">
      <div className="absolute inset-0 p-5 opacity-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-onyx-border/50" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 bg-onyx-border/50 rounded" />
            <div className="h-2 w-20 bg-onyx-border/30 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-onyx-border/50" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 bg-onyx-border/50 rounded" />
            <div className="h-2 w-16 bg-onyx-border/30 rounded" />
          </div>
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center gap-5 p-6 min-h-[280px]">
        <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
          <Lock className="h-6 w-6 text-gold" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold font-heading text-foreground mb-1.5">Limite {planLabel(plan)} atteinte</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">
            Vous utilisez {currentLimit}/{currentLimit} {limitLabel}. Choisissez une offre pour en ajouter davantage.
          </p>
        </div>
        <div className="w-full flex gap-2 max-w-[260px]">
          <button onClick={() => upgrade("DUO")} className="flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-2xl bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 active:scale-[0.97] transition-all">
            <Crown className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-[11px] font-bold">Pro</span>
            {plan === "SOLO" && promo.active ? (
              <>
                <span className="text-[9px] text-gold/50 line-through">4,99€/mois</span>
                <span className="text-[10px] text-gold font-bold">{(Math.floor(4.99 * (1 - promo.percent / 100) * 100) / 100).toFixed(2).replace('.', ',')}€</span>
              </>
            ) : (
              <span className="text-[10px] text-gold/70 font-medium">4,99€/mois</span>
            )}
          </button>
          <button onClick={() => upgrade("TEAM")} className="flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-2xl bg-gold text-primary-foreground hover:bg-gold-light active:scale-[0.97] transition-all gold-glow">
            <Crown className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-[11px] font-bold">Premium</span>
            {plan === "SOLO" && promo.active ? (
              <>
                <span className="text-[9px] text-primary-foreground/40 line-through">9,99€/mois</span>
                <span className="text-[10px] text-primary-foreground font-bold">{(Math.floor(9.99 * (1 - promo.percent / 100) * 100) / 100).toFixed(2).replace('.', ',')}€</span>
              </>
            ) : (
              <span className="text-[10px] text-primary-foreground/70 font-medium">9,99€/mois</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Team Screen ────────────────────────────────────────────────

function TeamScreen({ onBack }: { onBack: () => void }) {
  const { drivers, addDriver, updateDriver, deleteDriver, plan, upgrade, driverCount } = useNox()
  const isTeam = plan === "TEAM"
  const limit = plan === "SOLO" ? SOLO_LIMIT : plan === "DUO" ? DUO_LIMIT : TEAM_LIMIT
  const visibleDrivers = drivers.slice(0, limit)
  const maxSlots = limit
  const isFull = driverCount >= limit
  const [showConfetti, setShowConfetti] = useState(false)
  const [showLimitAlert, setShowLimitAlert] = useState(false)
  const [showSubDrawer, setShowSubDrawer] = useState(false)
  const [subDrawerPlan, setSubDrawerPlan] = useState<"DUO" | "TEAM">("DUO")
  // Unified drawer: null = closed, undefined = add mode, Driver = edit mode
  const [drawerDriver, setDrawerDriver] = useState<Driver | null | undefined>(null)
  const { navigateToSubscription, pendingEntityNavigation, clearPendingEntityNavigation } = useNav()

  // Deep link: open driver drawer if pending navigation
  useEffect(() => {
    if (pendingEntityNavigation && pendingEntityNavigation.entityType === "driver") {
      const driver = drivers.find(d => d.id === pendingEntityNavigation.entityId)
      if (driver) {
        setDrawerDriver(driver)
      }
      clearPendingEntityNavigation()
    }
  }, [pendingEntityNavigation, clearPendingEntityNavigation, drivers])

  function handleUpgrade() {
    setShowConfetti(true)
    setTimeout(() => upgrade(), 300)
  }

  function handleDriverSave(data: any) {
    if (drawerDriver) {
      // Edit mode
      updateDriver(drawerDriver.id, {
        name: `${data.prenom} ${data.nom}`.trim(),
        carteProNumber: data.cartePro || null,
        carteProExpiration: data.expirationCarte || null,
        apacNumber: data.apacNumber || null,
        apacExpiration: data.apacExpiration || null,
        permisNumber: data.permisNumber || null,
        permisExpiration: data.permisExpiration || null,
        rcProNumber: data.rcProNumber || null,
        rcProExpiration: data.rcProExpiration || null,
        phone: data.phone || null,
        email: data.email || null
      })
      setDrawerDriver(null)
    } else {
      // Add mode — id omis : Supabase génère un UUID réel
      const newDriver: Driver = {
        id: '',
        name: `${data.prenom} ${data.nom}`.trim(),
        initials: ((data.prenom?.[0] || '') + (data.nom?.[0] || '')).toUpperCase(),
        online: true, // actif = true par défaut à la création
        carteProNumber: data.cartePro || '',
        carteProExpiration: data.expirationCarte || '',
        apacNumber: data.apacNumber || '',
        apacExpiration: data.apacExpiration || '',
        permisNumber: data.permisNumber || '',
        permisExpiration: data.permisExpiration || '',
        rcProNumber: data.rcProNumber || '',
        rcProExpiration: data.rcProExpiration || '',
        phone: data.phone || '',
        email: data.email || ''
      }
      addDriver(newDriver)
      setDrawerDriver(null)
    }
  }

  function handleDriverDelete(driver: Driver) {
    deleteDriver(driver.id)
    setDrawerDriver(null)
  }

  return (
    <motion.div key="team" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full relative">
      <GoldConfetti trigger={showConfetti} />
      <SubScreenHeader title="Gestion des Chauffeurs" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-24">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold font-heading tracking-[0.15em]">
            Chauffeurs ({visibleDrivers.length}/{maxSlots})
          </p>
          {isTeam && (
            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-gold/15 border border-gold/30 gold-gradient-text">TEAM</span>
          )}
        </div>
        <AnimatePresence mode="popLayout">
          {visibleDrivers.map((driver, index) => {
            const expiryInfo = getEarliestExpiry([
              { label: 'Carte VTC', date: driver.carteProExpiration },
              { label: 'APAC', date: driver.apacExpiration },
              { label: 'Permis', date: driver.permisExpiration },
              { label: 'RC Pro', date: driver.rcProExpiration },
            ])
            return (
              <motion.div
                key={driver.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
                className="relative rounded-2xl bg-onyx-card border border-onyx-border/50 overflow-hidden hover:border-gold/30 hover:bg-gold/5 transition-all duration-150 group"
              >
                {/* Compliance Status Dot — position inchangée */}
                <div className="absolute top-3 right-3 z-10">
                  <ComplianceDot status={getDriverComplianceStatus(driver.carteProExpiration, driver.apacExpiration, driver.rcProExpiration, driver.permisExpiration)} />
                </div>

                {/* Zone tap → ouvre la fiche */}
                <div
                  onClick={() => setDrawerDriver(driver)}
                  className="flex items-center gap-3 px-4 pt-3.5 pb-1.5 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0 group-hover:bg-gold/25 transition-colors">
                    <span className="text-sm font-bold text-gold">{driver.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors truncate">{driver.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Chauffeur VTC</p>
                  </div>
                </div>

                {/* Ligne infos expiration + toggle */}
                <div className="flex items-center justify-between px-4 pb-3.5">
                  <div className="pl-[52px]">
                    {expiryInfo ? (
                      <p
                        className="text-[11px] font-medium truncate"
                        style={{ color: expiryInfo.color }}
                      >
                        {expiryInfo.label} · expire {expiryInfo.dateLabel}
                      </p>
                    ) : (
                      <p className="text-[11px]" style={{ color: '#888888' }}>Aucun document renseigné</p>
                    )}
                  </div>
                  <CardToggle
                    value={driver.online}
                    onToggle={async (next) => { await updateDriver(driver.id, { online: next }) }}
                  />
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* FAB - Add Driver */}
      <button
        onClick={() => isFull ? setShowLimitAlert(true) : setDrawerDriver(undefined)}
        className="absolute bottom-6 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all z-30 bg-gold gold-glow hover:bg-gold-light"
      >
        <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
      </button>

      <LimitAlertModal
        open={showLimitAlert}
        onClose={() => setShowLimitAlert(false)}
        resourceLabel="chauffeur"
        onManageOffer={navigateToSubscription}
        onUpgradePro={() => { setShowLimitAlert(false); setSubDrawerPlan("DUO"); setShowSubDrawer(true) }}
        onUpgradePremium={() => { setShowLimitAlert(false); setSubDrawerPlan("TEAM"); setShowSubDrawer(true) }}
      />
      <SubscriptionDrawer
        open={showSubDrawer}
        targetPlan={subDrawerPlan}
        onClose={() => setShowSubDrawer(false)}
      />
      <DriverDrawer
        open={drawerDriver !== null}
        driver={drawerDriver || null}
        onClose={() => setDrawerDriver(null)}
        onSave={handleDriverSave}
        onDelete={drawerDriver ? handleDriverDelete : undefined}
      />
    </motion.div>
  )
}

// ── Fleet Screen ───────────────────────────────────────────────

function FleetScreen({ onBack }: { onBack: () => void }) {
  const { vehicles, addVehicle, updateVehicle, deleteVehicle, plan, upgrade, vehicleCount } = useNox()
  const isTeam = plan === "TEAM"
  const limit = plan === "SOLO" ? SOLO_LIMIT : plan === "DUO" ? DUO_LIMIT : TEAM_LIMIT
  const visibleVehicles = vehicles.slice(0, limit)
  const maxSlots = limit
  const isFull = vehicleCount >= limit
  const [showConfetti, setShowConfetti] = useState(false)
  const [showLimitAlert, setShowLimitAlert] = useState(false)
  const [showSubDrawer, setShowSubDrawer] = useState(false)
  const [subDrawerPlan, setSubDrawerPlan] = useState<"DUO" | "TEAM">("DUO")
  // Unified drawer: null = closed, undefined = add mode, Vehicle = edit mode
  const [drawerVehicle, setDrawerVehicle] = useState<Vehicle | null | undefined>(null)
  const { navigateToSubscription, pendingEntityNavigation, clearPendingEntityNavigation } = useNav()

  // Deep link: open vehicle drawer if pending navigation
  useEffect(() => {
    if (pendingEntityNavigation && pendingEntityNavigation.entityType === "vehicle") {
      const vehicle = vehicles.find(v => v.id === pendingEntityNavigation.entityId)
      if (vehicle) {
        setDrawerVehicle(vehicle)
      }
      clearPendingEntityNavigation()
    }
  }, [pendingEntityNavigation, clearPendingEntityNavigation, vehicles])

  function handleUpgrade() {
    setShowConfetti(true)
    setTimeout(() => upgrade(), 300)
  }

  function handleVehicleSave(data: any) {
    if (drawerVehicle) {
      // Edit mode — mapping sur la nouvelle interface Vehicle
      updateVehicle(drawerVehicle.id, {
        marque: data.brand || null,
        modele: data.model || null,
        immatriculation: data.plate || null,
        inService: data.inService ?? true,
        date_mise_en_circulation: data.datePremiereImmat || null,
        type_energie: data.motorType || null,
        category: data.category || null,
        color: data.color === 'custom' ? (data.customColor || null) : (data.color || null),
        assuranceTransportExpiration: data.assuranceTransportExpiration || null,
        controleTechniqueExpiration: data.expirationCT || null
      })
      setDrawerVehicle(null)
    } else {
      // Add mode — id omis : Supabase génère un UUID réel
      const newVehicle: Vehicle = {
        id: '',
        marque: data.brand || '',
        modele: data.model || '',
        immatriculation: data.plate || '',
        inService: true,
        date_mise_en_circulation: data.datePremiereImmat || '',
        type_energie: data.motorType || 'essence',
        category: data.category || 'berline',
        color: data.color === 'custom' ? (data.customColor || '') : (data.color || ''),
        assuranceTransportExpiration: data.assuranceTransportExpiration || '',
        controleTechniqueExpiration: data.expirationCT || ''
      }
      addVehicle(newVehicle)
      setDrawerVehicle(null)
    }
  }

  function handleVehicleDelete(vehicle: Vehicle) {
    deleteVehicle(vehicle.id)
    setDrawerVehicle(null)
  }

  return (
    <motion.div key="fleet" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full relative">
      <GoldConfetti trigger={showConfetti} />
      <SubScreenHeader title="Gestion des véhicules" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-24">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold font-heading tracking-[0.15em]">
            Véhicules ({visibleVehicles.length}/{maxSlots})
          </p>
          {isTeam && (
            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-gold/15 border border-gold/30 gold-gradient-text">TEAM</span>
          )}
        </div>
        <AnimatePresence mode="popLayout">
          {visibleVehicles.map((vehicle, index) => {
            const expiryInfo = getEarliestExpiry([
              { label: 'Assurance', date: vehicle.assuranceTransportExpiration },
              { label: 'CT', date: vehicle.controleTechniqueExpiration },
            ])
            return (
              <motion.div
                key={vehicle.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
                className="relative rounded-2xl bg-onyx-card border border-onyx-border/50 overflow-hidden hover:border-gold/30 hover:bg-gold/5 transition-all duration-150 group"
              >
                {/* Compliance Status Dot — position inchangée */}
                <div className="absolute top-3 right-3 z-10">
                  <ComplianceDot status={getVehicleComplianceStatus(vehicle.assuranceTransportExpiration, vehicle.controleTechniqueExpiration)} />
                </div>

                {/* Zone tap → ouvre la fiche */}
                <div
                  onClick={() => setDrawerVehicle(vehicle)}
                  className="flex items-center gap-3 px-4 pt-3.5 pb-1.5 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0 group-hover:bg-gold/25 transition-colors">
                    <Car className="h-4 w-4 text-gold" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors truncate">{vehicle.marque} {vehicle.modele}</p>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{vehicle.immatriculation}</p>
                  </div>
                </div>

                {/* Ligne infos expiration + toggle */}
                <div className="flex items-center justify-between px-4 pb-3.5">
                  <div className="pl-[52px]">
                    {expiryInfo ? (
                      <p
                        className="text-[11px] font-medium truncate"
                        style={{ color: expiryInfo.color }}
                      >
                        {expiryInfo.label} · expire {expiryInfo.dateLabel}
                      </p>
                    ) : (
                      <p className="text-[11px]" style={{ color: '#888888' }}>Aucun document renseigné</p>
                    )}
                  </div>
                  <CardToggle
                    value={vehicle.inService}
                    onToggle={async (next) => { await updateVehicle(vehicle.id, { inService: next }) }}
                  />
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* FAB - Add Vehicle */}
      <button
        onClick={() => isFull ? setShowLimitAlert(true) : setDrawerVehicle(undefined)}
        className="absolute bottom-6 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all z-30 bg-gold gold-glow hover:bg-gold-light"
      >
        <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
      </button>

      <LimitAlertModal
        open={showLimitAlert}
        onClose={() => setShowLimitAlert(false)}
        resourceLabel="véhicule"
        onManageOffer={navigateToSubscription}
        onUpgradePro={() => { setShowLimitAlert(false); setSubDrawerPlan("DUO"); setShowSubDrawer(true) }}
        onUpgradePremium={() => { setShowLimitAlert(false); setSubDrawerPlan("TEAM"); setShowSubDrawer(true) }}
      />
      <SubscriptionDrawer
        open={showSubDrawer}
        targetPlan={subDrawerPlan}
        onClose={() => setShowSubDrawer(false)}
      />
      <VehicleDrawer
        open={drawerVehicle !== null}
        vehicle={drawerVehicle || null}
        onClose={() => setDrawerVehicle(null)}
        onSave={handleVehicleSave}
        onDelete={drawerVehicle ? handleVehicleDelete : undefined}
      />
    </motion.div>
  )
}

// ── Notifications Screen ─────────────────────────────────────

function NotifToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0",
        checked ? "bg-gold" : "bg-secondary/80 border border-onyx-border/50"
      )}
    >
      <motion.div
        className={cn("absolute top-0.5 w-5 h-5 rounded-full shadow-sm", checked ? "bg-primary-foreground" : "bg-muted-foreground/60")}
        animate={{ left: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  )
}

function NotifRow({ label, description, checked, onChange }: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="relative h-[70px] px-4 overflow-hidden">
      <div className="absolute inset-y-0 left-4 right-20 flex flex-col justify-center">
        <p className="text-sm font-medium text-foreground truncate max-w-[70%]">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[70%]">{description}</p>
      </div>
      <div className="absolute inset-y-0 right-4 flex items-center">
        <NotifToggle checked={checked} onChange={onChange} />
      </div>
    </div>
  )
}

function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null)

  useEffect(() => {
    getNotifPrefsAction().then(setPrefs)
  }, [])

  function toggle(field: keyof NotifPrefs) {
    if (!prefs) return
    const next = { ...prefs, [field]: !prefs[field] }
    setPrefs(next)
    void saveNotifPrefsAction(next)
  }

  const SmsDisabledRow = ({ label, description }: { label: string; description: string }) => (
    <div className="flex items-center gap-3 px-4 py-3.5 opacity-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded bg-secondary/60 text-muted-foreground border border-onyx-border/40 tracking-wide whitespace-nowrap">Bientôt</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div aria-disabled="true" className="relative w-11 h-6 rounded-full bg-secondary/60 border border-onyx-border/40 shrink-0 cursor-not-allowed">
        <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-muted-foreground/30" />
      </div>
    </div>
  )

  return (
    <motion.div key="notifications" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <SubScreenHeader title="Notifications" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-24">
        {!prefs ? (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 rounded-full border-2 border-gold border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <SectionLabel>Notifications Push</SectionLabel>
            <GlassCard className="mb-5">
              <NotifRow label="Activité courses" description="Rappels de courses et confirmations" checked={prefs.pushReservations} onChange={() => toggle("pushReservations")} />
              <NotifRow label="Offres et promotions" description="Recevoir des offres et promotions (push et email)" checked={prefs.pushPromotions} onChange={() => toggle("pushPromotions")} />
            </GlassCard>

            <SectionLabel>Notifications Email</SectionLabel>
            <GlassCard className="mb-5">
              <NotifRow label="Récapitulatif journalier" description="Résumé quotidien de votre activité" checked={prefs.emailRecap} onChange={() => toggle("emailRecap")} />
              <div className="flex items-center gap-3 px-4 py-3.5 opacity-70">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Factures</p>
                    <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded bg-secondary/60 text-muted-foreground border border-onyx-border/40 tracking-wide whitespace-nowrap">Obligatoire</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Envoi automatique des factures générées</p>
                </div>
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
              </div>
            </GlassCard>

            <SectionLabel>Notifications SMS</SectionLabel>
            <GlassCard className="mb-5">
              <SmsDisabledRow label="Confirmations" description="SMS de confirmation de réservation" />
              <SmsDisabledRow label="Rappels" description="Rappel 1h avant chaque course" />
            </GlassCard>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ── Security Screen ───────────────────────────────────────────

function SecurityScreen({ onBack }: { onBack: () => void }) {
  const supabase = createClient()

  // ── 2FA email state ──
  const [twoFaEnabled, setTwoFaEnabled] = useState<boolean | null>(null)
  const [twoFaStep, setTwoFaStep] = useState<'idle' | 'activate-verify' | 'deactivate-verify'>('idle')
  const [twoFaCode, setTwoFaCode] = useState('')
  const [twoFaError, setTwoFaError] = useState<string | null>(null)
  const [twoFaLoading, setTwoFaLoading] = useState(false)
  const [twoFaSending, setTwoFaSending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // ── Password state ──
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', newPwd: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [pwChangedLabel, setPwChangedLabel] = useState<string | null>(null)

  const passwordsMatch = pwForm.confirm.length > 0 && pwForm.newPwd === pwForm.confirm
  const isNewStrong = isPasswordStrong(pwForm.newPwd)
  const canSubmitPwd = pwForm.current.length > 0 && isNewStrong && passwordsMatch

  useEffect(() => {
    void (async () => {
      const { enabled } = await getTwoFactorStatusAction()
      setTwoFaEnabled(enabled)
    })()
    const stored = localStorage.getItem('nox_pwd_changed_at')
    if (stored) {
      const days = Math.floor((Date.now() - parseInt(stored, 10)) / 86400000)
      if (days === 0) setPwChangedLabel("Modifié aujourd'hui")
      else if (days === 1) setPwChangedLabel('Modifié hier')
      else setPwChangedLabel(`Modifié il y a ${days} jours`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 2FA email handlers ──
  function startResendCooldown() {
    setResendCooldown(60)
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  async function handleToggle2FA() {
    setTwoFaError(null)
    setTwoFaCode('')
    setTwoFaSending(true)
    setTwoFaStep(twoFaEnabled ? 'deactivate-verify' : 'activate-verify')
    await requestTwoFactorCodeAction()
    setTwoFaSending(false)
    startResendCooldown()
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return
    setTwoFaSending(true)
    setTwoFaError(null)
    await requestTwoFactorCodeAction()
    setTwoFaSending(false)
    startResendCooldown()
  }

  async function handleVerify2FA() {
    if (twoFaCode.length !== 6) return
    setTwoFaLoading(true)
    setTwoFaError(null)
    try {
      const result = await verifyTwoFactorCodeAction(twoFaCode)
      if (!result.success) {
        setTwoFaError(result.error ?? 'Code incorrect.')
        setTwoFaCode('')
        return
      }
      if (twoFaStep === 'activate-verify') {
        await enableTwoFactorAction()
        setTwoFaEnabled(true)
        toast.success('Double authentification activée ✓')
      } else {
        await disableTwoFactorAction()
        setTwoFaEnabled(false)
        toast.success('Double authentification désactivée')
      }
      setTwoFaStep('idle')
      setTwoFaCode('')
    } catch {
      setTwoFaError('Erreur réseau, veuillez réessayer.')
    } finally {
      setTwoFaLoading(false)
    }
  }

  function cancelVerify2FA() {
    setTwoFaStep('idle')
    setTwoFaCode('')
    setTwoFaError(null)
    setResendCooldown(0)
  }

  // ── Password handler ──
  async function handleChangePassword() {
    setPwLoading(true)
    setPwError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      setPwError('Session expirée, veuillez vous reconnecter.')
      setPwLoading(false)
      return
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: pwForm.current })
    if (signInErr) {
      setPwError('Mot de passe actuel incorrect.')
      setPwLoading(false)
      return
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: pwForm.newPwd })
    if (updateErr) {
      setPwError(updateErr.message)
      setPwLoading(false)
      return
    }
    localStorage.setItem('nox_pwd_changed_at', Date.now().toString())
    setPwChangedLabel("Modifié aujourd'hui")
    setPwSuccess(true)
    setPwForm({ current: '', newPwd: '', confirm: '' })
    setPwLoading(false)
    toast.success('Mot de passe mis à jour ✓')
    setTimeout(() => { setShowChangePassword(false); setPwSuccess(false) }, 1500)
    try { await sendPasswordChangedEmailAction() } catch {}
  }

  return (
    <motion.div key="security" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <SubScreenHeader title="Sécurité" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Security Banner */}
        <div className="mx-4 mb-5 p-4 rounded-2xl bg-gold/5 border border-gold/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-gold" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-foreground">Connexion sécurisée</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Vos données sont chiffrées lors de leur transmission (TLS) et stockées sur des serveurs chiffrés.</p>
          </div>
        </div>

        <SectionLabel>Authentification</SectionLabel>
        <GlassCard className="mb-5">
          {/* 2FA email */}
          <AnimatePresence mode="wait">
            {twoFaStep !== 'idle' ? (
              <motion.div
                key="verify"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 space-y-4"
              >
                <p className="text-xs font-semibold text-foreground">
                  {twoFaStep === 'activate-verify' ? 'Activer la double authentification' : 'Désactiver la double authentification'}
                </p>
                {twoFaSending ? (
                  <p className="text-[11px] text-muted-foreground text-center py-2">Envoi du code en cours...</p>
                ) : (
                  <>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Un code à 6 chiffres a été envoyé à votre adresse email. Il est valable 10 minutes.
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      value={twoFaCode}
                      onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      autoComplete="one-time-code"
                      autoFocus
                      className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-foreground text-center text-lg font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold/50 transition-colors"
                      style={{ letterSpacing: "0.15em" }}
                    />
                    {twoFaError && (
                      <div className="text-center space-y-1.5">
                        <p className="text-[11px] text-red-400">{twoFaError}</p>
                        {twoFaCode.length === 6 && (
                          <button
                            type="button"
                            onClick={handleVerify2FA}
                            className="text-[11px] text-red-300 underline underline-offset-2 hover:text-red-200 transition-colors"
                          >
                            Réessayer
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendCooldown > 0 || twoFaSending}
                      className="w-full text-[11px] text-muted-foreground hover:text-gold transition-colors disabled:opacity-50"
                    >
                      {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : 'Renvoyer le code'}
                    </button>
                    <div className="flex gap-3">
                      <button
                        onClick={cancelVerify2FA}
                        disabled={twoFaLoading}
                        className="flex-1 py-2.5 rounded-xl bg-secondary/40 border border-onyx-border/30 text-xs font-medium text-muted-foreground hover:bg-secondary/60 active:scale-[0.98] transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleVerify2FA}
                        disabled={twoFaLoading || twoFaCode.length !== 6}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                          twoFaStep === 'activate-verify'
                            ? "bg-gold text-primary-foreground hover:bg-gold-light gold-glow-sm"
                            : "bg-red-500/80 text-white hover:bg-red-500"
                        )}
                      >
                        {twoFaLoading ? 'Vérification...' : twoFaStep === 'activate-verify' ? 'Activer' : 'Désactiver'}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="toggle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-gold" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Double authentification (2FA)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {twoFaEnabled === null ? 'Chargement...' : twoFaEnabled ? 'Activée — code par email' : 'Code par email à chaque connexion'}
                  </p>
                </div>
                <button
                  onClick={handleToggle2FA}
                  disabled={twoFaEnabled === null || twoFaSending}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-50",
                    twoFaEnabled ? "bg-gold" : "bg-secondary/80 border border-onyx-border/50"
                  )}
                >
                  <motion.div
                    className={cn("absolute top-0.5 w-5 h-5 rounded-full shadow-sm", twoFaEnabled ? "bg-primary-foreground" : "bg-muted-foreground/60")}
                    animate={{ left: twoFaEnabled ? 22 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Biometric — placeholder, non fonctionnel */}
          <div className="flex items-center gap-3 px-4 py-3.5 opacity-50">
            <div className="w-9 h-9 rounded-xl bg-secondary/40 border border-onyx-border/30 flex items-center justify-center shrink-0">
              <Fingerprint className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">Connexion biométrique</p>
                <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded bg-secondary/60 text-muted-foreground border border-onyx-border/40 tracking-wide whitespace-nowrap">Bientôt</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Face ID / Empreinte digitale</p>
            </div>
            <div
              aria-disabled="true"
              className="relative w-11 h-6 rounded-full bg-secondary/60 border border-onyx-border/40 shrink-0 cursor-not-allowed"
            >
              <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-muted-foreground/30" />
            </div>
          </div>
        </GlassCard>

        <SectionLabel>Mot de passe</SectionLabel>
        <GlassCard className="mb-5">
          <AnimatePresence mode="wait">
            {showChangePassword ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 space-y-3 overflow-hidden"
              >
                {pwSuccess ? (
                  <div className="py-4 text-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm font-semibold text-emerald-400">Mot de passe mis à jour</p>
                  </div>
                ) : (
                  <>
                    {/* Current password */}
                    <div className="relative">
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        placeholder="Mot de passe actuel"
                        value={pwForm.current}
                        onChange={(e) => setPwForm(f => ({ ...f, current: e.target.value }))}
                        className="w-full px-4 py-3 pr-11 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                      />
                      <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                        {showCurrentPw ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                    {/* New password */}
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        placeholder="Nouveau mot de passe"
                        value={pwForm.newPwd}
                        onChange={(e) => setPwForm(f => ({ ...f, newPwd: e.target.value }))}
                        className={cn(
                          "w-full px-4 py-3 pr-11 rounded-xl bg-secondary/60 border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors",
                          pwForm.newPwd && !isNewStrong ? "border-red-500/50 focus:border-red-500/70" : "border-onyx-border/50 focus:border-gold/50"
                        )}
                      />
                      <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                        {showNewPw ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                    <PasswordStrengthIndicator password={pwForm.newPwd} show={pwForm.newPwd.length > 0} />
                    {/* Confirm */}
                    <div className="relative">
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        placeholder="Confirmer le nouveau mot de passe"
                        value={pwForm.confirm}
                        onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                        className={cn(
                          "w-full px-4 py-3 pr-11 rounded-xl bg-secondary/60 border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors",
                          pwForm.confirm && !passwordsMatch ? "border-red-500/50 focus:border-red-500/70" : "border-onyx-border/50 focus:border-gold/50"
                        )}
                      />
                      <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground">
                        {showConfirmPw ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                    {pwForm.confirm && !passwordsMatch && (
                      <p className="text-[10px] text-red-400 font-semibold ml-1">Les mots de passe ne correspondent pas.</p>
                    )}
                    {pwError && <p className="text-[11px] text-red-400 text-center px-1">{pwError}</p>}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => { setShowChangePassword(false); setPwForm({ current: '', newPwd: '', confirm: '' }); setPwError(null) }}
                        disabled={pwLoading}
                        className="flex-1 py-2.5 rounded-xl bg-secondary/40 border border-onyx-border/30 text-xs font-medium text-muted-foreground hover:bg-secondary/60 active:scale-[0.98] transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleChangePassword}
                        disabled={pwLoading || !canSubmitPwd}
                        className="flex-1 py-2.5 rounded-xl bg-gold text-primary-foreground text-xs font-semibold hover:bg-gold-light active:scale-[0.98] transition-all gold-glow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pwLoading ? 'Mise à jour...' : 'Valider'}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.button
                key="btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowChangePassword(true)}
                className="flex items-center gap-3 w-full px-4 py-3.5 group hover:bg-gold/5 active:bg-gold/10 active:scale-[0.99] transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0 group-hover:bg-gold/10 group-hover:text-gold transition-colors text-muted-foreground">
                  <Lock className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-gold transition-colors">Changer mon mot de passe</p>
                  {pwChangedLabel && <p className="text-[11px] text-muted-foreground mt-0.5">{pwChangedLabel}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 group-hover:text-gold/50 transition-all" strokeWidth={1.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </GlassCard>

        {/* Sessions (façade) */}
        <SectionLabel>Sessions actives</SectionLabel>
        <GlassCard className="mb-5">
          {[
            { device: "iPhone 15 Pro", location: "Paris, France", current: true },
            { device: "MacBook Pro", location: "Paris, France", current: false },
          ].map((session) => (
            <div key={session.device} className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center shrink-0 text-muted-foreground">
                <Globe className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{session.device}</p>
                  {session.current && (
                    <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">Actuelle</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{session.location}</p>
              </div>
              {!session.current && (
                <button className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all">
                  Révoquer
                </button>
              )}
            </div>
          ))}
        </GlassCard>
      </div>
    </motion.div>
  )
}

// ── Main Settings ────────���────────────────────────────────────

// ── Wallet History Screen ──────────────────────────────────────

type WalletTx = {
  id: string
  type: string
  amount: number
  balance_after: number | null
  description: string | null
  created_at: string
  bc_id: string | null
  bc_numero?: string | null
}

const TX_LABELS: Record<string, string> = {
  purchase: "Achat de jetons",
  consumption: "Bon de réservation",
  admin_grant: "Attribution",
  bonus: "Bonus",
  refund: "Remboursement",
}

const WALLET_PAGE_SIZE = 10

function WalletHistoryScreen({ onBack }: { onBack: () => void }) {
  const { plan, tokens } = useNox()
  const { navigateToBC, switchTab } = useNav()
  const [walletOpen, setWalletOpen] = useState(false)
  const [txs, setTxs] = useState<WalletTx[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const from = page * WALLET_PAGE_SIZE
      const to = from + WALLET_PAGE_SIZE - 1

      const { data, count } = await supabase
        .from('token_transactions')
        .select('id, type, amount, balance_after, description, created_at, bc_id', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (cancelled) return

      const rows: WalletTx[] = (data ?? []) as WalletTx[]
      const bcIds = rows.filter(r => r.bc_id).map(r => r.bc_id as string)
      let bcMap: Record<string, string> = {}
      if (bcIds.length > 0) {
        const { data: bcsData } = await supabase
          .from('bcs')
          .select('id, numero')
          .in('id', bcIds)
        for (const bc of (bcsData ?? []) as { id: string; numero: string }[]) {
          bcMap[bc.id] = bc.numero
        }
      }

      if (cancelled) return
      setTxs(rows.map(r => ({ ...r, bc_numero: r.bc_id ? (bcMap[r.bc_id] ?? null) : null })))
      setTotal(count ?? 0)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [page])

  const totalPages = Math.ceil(total / WALLET_PAGE_SIZE)

  function fmtDate(iso: string) {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  return (
    <motion.div key="wallet_history" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <SubScreenHeader title="Mon Portefeuille" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-24">

        {/* Solde */}
        <div className="mx-4 mb-5 p-5 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-gold" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Solde actuel</p>
              {plan === "SOLO" ? (
                <p className="text-xl font-bold font-heading text-foreground">
                  {tokens} <span className="text-gold text-sm font-semibold">Jetons</span>
                </p>
              ) : (
                <p className="text-lg font-bold font-heading text-gold">Illimité</p>
              )}
            </div>
          </div>
          {plan === "SOLO" ? (
            <button
              onClick={() => setWalletOpen(true)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/10 to-[#D4AF37]/20 border border-gold/40 flex items-center justify-center gap-2 hover:border-gold/60 active:scale-[0.98] transition-all"
            >
              <Coins className="h-4 w-4 text-gold" strokeWidth={1.5} />
              <span className="text-[11px] font-bold text-gold tracking-wider uppercase">Recharger mes Jetons</span>
            </button>
          ) : (
            <div className="py-2 px-3 rounded-xl bg-gold/10 border border-gold/20">
              <p className="text-[11px] text-gold/80 text-center">
                Vous êtes en offre {plan === "TEAM" ? "Premium" : "Pro"} — vos jetons ({tokens}) sont conservés et réutilisables si vous repassez en Starter.
              </p>
            </div>
          )}
        </div>

        {/* Historique */}
        <SectionLabel>Historique des transactions</SectionLabel>
        <div className="mx-4 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/40 overflow-hidden mb-4">
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
            </div>
          ) : txs.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2">
              <History className="h-8 w-8 text-muted-foreground/30" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">Aucune transaction</p>
            </div>
          ) : (
            txs.map((tx, i) => {
              const isDebit = tx.type === "consumption" || tx.type === "debit" || tx.amount < 0
              const label = TX_LABELS[tx.type] ?? tx.type
              return (
                <div key={tx.id} className={cn("flex items-center gap-3 px-4 py-3.5", i > 0 && "border-t border-onyx-border/20")}>
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", isDebit ? "bg-red-500/10" : "bg-emerald-500/10")}>
                    <History className={cn("h-4 w-4", isDebit ? "text-red-400" : "text-emerald-400")} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{label}</p>
                      {tx.type === "consumption" && tx.bc_numero && (
                        <button
                          onClick={() => { navigateToBC(tx.bc_id!); switchTab("documents") }}
                          className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors"
                        >
                          {tx.bc_numero}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{fmtDate(tx.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-bold tabular-nums", isDebit ? "text-red-400" : "text-emerald-400")}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount}
                    </p>
                    {tx.balance_after != null && (
                      <p className="text-[10px] text-muted-foreground tabular-nums">→ {tx.balance_after}</p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mx-4">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="w-8 h-8 rounded-xl bg-onyx-card border border-onyx-border/40 flex items-center justify-center disabled:opacity-30 hover:border-gold/30 transition-all"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </button>
            <p className="text-xs text-muted-foreground">{page + 1} / {totalPages}</p>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="w-8 h-8 rounded-xl bg-onyx-card border border-onyx-border/40 flex items-center justify-center disabled:opacity-30 hover:border-gold/30 transition-all"
            >
              <ChevronRight className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </button>
          </div>
        )}

      </div>
      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
    </motion.div>
  )
}

function MainSettings({ onNavigate }: { onNavigate: (screen: SettingsScreen) => void }) {
  const { plan, tokens, driverCount, vehicleCount, enterprise, subscriptionStatus, trialEndsAt } = useNox()
  const { logout } = useNav()
  const isTeam = plan === "TEAM"
  const [walletOpen, setWalletOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [userInfo, setUserInfo] = useState({ name: "Chargement...", email: "" })
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || ""
        setUserInfo({ name: fullName, email: user.email || "" })
      } else {
        setUserInfo({ name: "Non renseigné", email: "" })
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (subscriptionStatus === "trial" || plan === "SOLO") return
    const supabase = createClient()
    supabase
      .from("subscriptions")
      .select("current_period_end")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.current_period_end) setCurrentPeriodEnd(data.current_period_end)
      })
  }, [subscriptionStatus, plan])

  const enterpriseDesc = enterprise.name 
    ? `${enterprise.name}${enterprise.siren ? ` \u2022 SIRET ${enterprise.siren}` : ""}`
    : "Non renseignée"

  const accountSettings: SettingItem[] = [
    { icon: <User className="h-4 w-4" strokeWidth={1.5} />, label: "Compte & Sécurité", description: "Gérer l'accès et les infos", screen: "accountSecurity" },
    { icon: <Building2 className="h-4 w-4" strokeWidth={1.5} />, label: "Profil Entreprise", description: enterpriseDesc, screen: "enterprise" },
    { icon: <FileText className="h-4 w-4" strokeWidth={1.5} />, label: "Mes Conditions de Vente", description: "CGV rattachées à vos documents", screen: "cgv", alertBadge: !enterprise?.cgvMode },
    { icon: <Calculator className="h-4 w-4" strokeWidth={1.5} />, label: "Mes Grilles Tarifaires", description: "Tarifs, suppléments et forfaits", screen: "tarifs" },
    { icon: <Crown className="h-4 w-4" strokeWidth={1.5} />, label: "Mon Abonnement", description: plan === "TEAM" ? "Offre Premium active" : plan === "DUO" ? "Offre Pro active" : "Offre Starter active", screen: "subscription" },
  ]

  const managementSettings: SettingItem[] = [
    {
      icon: <Users className="h-4 w-4" strokeWidth={1.5} />,
      label: "Gestion des Chauffeurs",
      description: `${driverCount} chauffeur${driverCount > 1 ? "s" : ""} actif${driverCount > 1 ? "s" : ""}`,
      screen: "team",
    },
    {
      icon: <Car className="h-4 w-4" strokeWidth={1.5} />,
      label: "Gestion des véhicules",
      description: `${vehicleCount} véhicule${vehicleCount > 1 ? "s" : ""} en service`,
      screen: "fleet",
    },
  ]

  const appSettings: SettingItem[] = [
    { icon: <Bell className="h-4 w-4" strokeWidth={1.5} />, label: "Notifications", description: "Push, Email, SMS", screen: "notifications" },
  ]

  return (
    <motion.div key="main" variants={slideBack} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold font-heading text-foreground">Réglages</h1>
        <div className={cn(
          "px-2.5 py-1 rounded-lg border",
          isTeam
            ? "bg-gradient-to-r from-gold/25 via-gold/15 to-gold/25 border-gold/50 gold-badge-glow"
            : "bg-gold/15 border-gold/30"
        )}>
          <span className={cn("text-[10px] font-bold tracking-wider", isTeam ? "gold-gradient-text" : "text-gold")}>{planLabel(plan)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* NoX Wallet */}
        <button
          onClick={() => onNavigate("subscription")}
          className="w-full mx-0 mb-5 text-left active:scale-[0.99] transition-transform"
        >
          <div className="mx-4 p-5 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/30 hover:border-gold/30 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <Coins className="h-5 w-5 text-gold" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">NoX Wallet</p>
                {plan === "SOLO" ? (
                  <p className="text-xl font-bold font-heading text-foreground">
                    {tokens} <span className="text-gold text-sm font-semibold">Jetons</span>
                  </p>
                ) : (
                  <p className="text-lg font-bold font-heading text-gold">
                    Illimité
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
            </div>
            {plan === "SOLO" ? (
              <div className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/10 to-[#D4AF37]/20 border border-gold/40 flex items-center justify-center gap-2">
                <Coins className="h-4 w-4 text-gold" strokeWidth={1.5} />
                <span className="text-[11px] font-bold text-gold tracking-wider uppercase">Gérer mon abonnement</span>
              </div>
            ) : subscriptionStatus === "trial" ? (
              <div className="w-full py-2 rounded-xl bg-gold/10 border border-gold/25 flex flex-col items-center justify-center gap-0.5">
                <span className="text-[11px] font-bold text-gold tracking-wider uppercase">Essai {planLabel(plan)}</span>
                {trialEndsAt && (
                  <span className="text-[9px] text-gold/70 font-medium">
                    Jusqu&apos;au {new Date(trialEndsAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  </span>
                )}
              </div>
            ) : (
              <div className="w-full py-2 rounded-xl bg-gold/15 border border-gold/30 flex flex-col items-center justify-center gap-0.5">
                <span className="text-[11px] font-bold text-gold tracking-wider uppercase">Documents Illimités</span>
                <div className="flex items-center gap-1">
                  <Headphones className="h-3 w-3 text-gold/70" strokeWidth={1.5} />
                  <span className="text-[9px] text-gold/70 font-medium">Support Prioritaire 24/7</span>
                </div>
                {currentPeriodEnd && (
                  <span className="text-[9px] text-gold/50 font-medium mt-0.5">
                    Valide jusqu&apos;au {new Date(currentPeriodEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
            )}
          </div>
        </button>

        {/* Compte */}
        <SectionLabel>Compte</SectionLabel>
        <GlassCard className="mb-5">
          {accountSettings.map((item) => (
            <SettingRow key={item.label} item={item} onPress={item.screen ? () => onNavigate(item.screen!) : undefined} />
          ))}
        </GlassCard>

        {/* Gestion */}
        <SectionLabel>Gestion</SectionLabel>
        <GlassCard className="mb-5">
          {managementSettings.map((item) => (
            <SettingRow key={item.label} item={item} onPress={item.screen ? () => onNavigate(item.screen!) : undefined} />
          ))}
        </GlassCard>

        {/* Mon Portefeuille */}
        <SectionLabel>Mon Portefeuille</SectionLabel>
        <GlassCard className="mb-5">
          <SettingRow
            item={{
              icon: <History className="h-4 w-4" strokeWidth={1.5} />,
              label: "Historique des jetons",
              description: plan === "SOLO" ? `${tokens} jeton(s) disponible(s)` : "Vos jetons sont conservés",
            }}
            onPress={() => onNavigate("wallet_history")}
          />
        </GlassCard>

        {/* Application */}
        <SectionLabel>Application</SectionLabel>
        <GlassCard className="mb-5">
          {appSettings.map((item) => (
            <SettingRow key={item.label} item={item} onPress={item.screen ? () => onNavigate(item.screen!) : undefined} />
          ))}
        </GlassCard>

        {/* Support & Aide */}
        <SectionLabel>Support &amp; Aide</SectionLabel>
        <GlassCard className="mb-5">
          <SettingRow
            item={{
              icon: <Headphones className="h-4 w-4" strokeWidth={1.5} />,
              label: "Contacter le support",
              description: "Signaler un problème ou poser une question",
            }}
            onPress={() => setSupportOpen(true)}
          />
          <SettingRow
            item={{
              icon: <MessageSquare className="h-4 w-4" strokeWidth={1.5} />,
              label: "Mes demandes",
              description: "Consulter l'historique de vos tickets",
            }}
            onPress={() => setHistoryOpen(true)}
          />
        </GlassCard>

        {/* Légal */}
        <SectionLabel>Légal</SectionLabel>
        <GlassCard className="mb-5">
          <SettingRow
            item={{
              icon: <FileText className="h-4 w-4" strokeWidth={1.5} />,
              label: "Politique de confidentialité",
              description: "Données personnelles & RGPD",
            }}
            onPress={() => window.open('/politique-de-confidentialite', '_blank')}
          />
          <SettingRow
            item={{
              icon: <FileText className="h-4 w-4" strokeWidth={1.5} />,
              label: "Politique de cookies",
              description: "Gestion des traceurs",
            }}
            onPress={() => window.open('/politique-de-cookies', '_blank')}
          />
        </GlassCard>

        {/* Déconnexion */}
        <div className="mx-4 mb-6">
          <button 
            onClick={logout}
            className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-red-950/30 border border-red-900/40 hover:bg-red-950/50 hover:border-red-800/50 active:scale-[0.98] active:bg-red-950/60 transition-all group"
          >
            <LogOut className="h-4 w-4 text-red-400/80 group-hover:text-red-400 transition-colors" strokeWidth={1.5} />
            <span className="text-sm font-medium text-red-400/80 group-hover:text-red-400 transition-colors">Déconnexion</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <p className="text-[10px] text-muted-foreground/50 font-medium">NoX VTC v1.0.0</p>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold/5 border border-gold/15">
            <Shield className="h-3 w-3 text-gold/60" strokeWidth={1.5} />
            <span className="text-[9px] font-semibold text-gold/60 tracking-wider">Connexion sécurisée (TLS)</span>
          </div>
        </div>
      </div>
      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
      <SupportTicketModal isOpen={supportOpen} onClose={() => setSupportOpen(false)} />
      <SupportHistory isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </motion.div>
  )
}

// ── Export ───���────���────────��────────────────────────────────���───

export function SettingsTab() {
  const [screen, setScreen] = useState<SettingsScreen>("main")
  const { registerSettingsNavigator } = useNav()

  React.useEffect(() => {
    registerSettingsNavigator(setScreen)
  }, [registerSettingsNavigator])

  return (
    <SettingsErrorBoundary>
      <div className="h-full overflow-hidden">
        <AnimatePresence mode="wait">
          {screen === "main" && <MainSettings key="main" onNavigate={setScreen} />}
          {screen === "team" && <TeamScreen key="team" onBack={() => setScreen("main")} />}
          {screen === "fleet" && <FleetScreen key="fleet" onBack={() => setScreen("main")} />}
          {screen === "profile" && <ProfileScreen key="profile" onBack={() => setScreen("main")} />}
          {screen === "accountSecurity" && <AccountSecurityScreen key="accountSecurity" onBack={() => setScreen("main")} onNavigateSecurity={() => setScreen("security")} />}
          {screen === "enterprise" && <EnterpriseScreen key="enterprise" onBack={() => setScreen("main")} />}
          {screen === "subscription" && <SubscriptionScreen key="subscription" onBack={() => setScreen("main")} onNavigatePlans={() => setScreen("plans")} />}
          {screen === "plans" && <PlansScreen key="plans" onBack={() => setScreen("subscription")} />}
          {screen === "notifications" && <NotificationsScreen key="notifications" onBack={() => setScreen("main")} />}
          {screen === "security" && <SecurityScreen key="security" onBack={() => setScreen("main")} />}
          {screen === "cgv" && <CGVSettings key="cgv" onBack={() => setScreen("main")} />}
          {screen === "tarifs" && <TarifsSettings key="tarifs" onBack={() => setScreen("main")} />}
          {screen === "wallet_history" && <WalletHistoryScreen key="wallet_history" onBack={() => setScreen("main")} />}
        </AnimatePresence>
      </div>
    </SettingsErrorBoundary>
  )
}

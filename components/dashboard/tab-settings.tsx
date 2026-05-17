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
  CreditCard,
  Bell,
  User,
  Users,
  Car,
  Lock,
  Calculator,

  Crown,
  Headphones,
  Mail,
  Phone,
  MapPin,
  BadgeCheck,
  Eye,
  EyeOff,
  Landmark,
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

type SettingsScreen = "main" | "team" | "fleet" | "profile" | "accountSecurity" | "enterprise" | "banking" | "subscription" | "notifications" | "security" | "cgv" | "tarifs"

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

function EnterpriseScreen({ onBack }: { onBack: () => void }) {
  const { enterprise, updateEnterprise } = useNox()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

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
        dateAssurance: compliance.dateAssurance
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

// ── Infos Bancaires Screen ─────────────────────────────────────

function BankingScreen({ onBack }: { onBack: () => void }) {
  const { enterprise, updateEnterprise } = useNox()
  const [editing, setEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [bank, setBank] = useState({
    banque: enterprise.bankName || "À renseigner",
    iban: enterprise.iban || "À renseigner",
    bic: enterprise.bic || "À renseigner",
  })

  function handleSave() {
    setIsSaving(true)
    try {
      updateEnterprise({
        bankName: bank.banque,
        iban: bank.iban,
        bic: bank.bic
      })
      setEditing(false)
      toast.success("Modifications enregistrées ✓", { duration: 3000 })
    } catch {
      toast.error("Une erreur est survenue, veuillez réessayer")
    } finally {
      setTimeout(() => setIsSaving(false), 500)
    }
  }

  return (
    <motion.div key="banking" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <SubScreenHeader title="Infos Bancaires" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Security Banner */}
        <div className="mx-4 mb-5 px-4 py-3 rounded-2xl bg-gold/5 border border-gold/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-gold" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Chiffrement AES-256</p>
            <p className="text-[10px] text-muted-foreground">Vos données bancaires sont sécurisées</p>
          </div>
        </div>

        <SectionLabel>Compte bancaire</SectionLabel>
        <GlassCard className="mb-5">
          {editing ? (
            <div className="p-4 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Banque</p>
                <input type="text" value={bank.banque} onChange={(e) => setBank({ ...bank, banque: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">IBAN</p>
                <input type="text" value={bank.iban} onChange={(e) => setBank({ ...bank, iban: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground font-mono focus:outline-none focus:border-gold/50 transition-colors" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">BIC / SWIFT</p>
                <input type="text" value={bank.bic} onChange={(e) => setBank({ ...bank, bic: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground font-mono focus:outline-none focus:border-gold/50 transition-colors" />
              </div>
            </div>
          ) : (
            <>
              <InfoCard icon={<Landmark className="h-4 w-4 text-gold" strokeWidth={1.5} />} label="Banque" value={bank.banque} />
              <InfoCard icon={<CreditCard className="h-4 w-4 text-gold" strokeWidth={1.5} />} label="IBAN" value={bank.iban} masked />
              <InfoCard icon={<Hash className="h-4 w-4 text-gold" strokeWidth={1.5} />} label="BIC / SWIFT" value={bank.bic} masked />
            </>
          )}
        </GlassCard>

        <SectionLabel>Moyen de paiement</SectionLabel>
        <GlassCard className="mb-5">
          <div className="flex items-center gap-3 p-4 group hover:bg-gold/5 transition-colors rounded-2xl">
            <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 group-hover:bg-gold/15 transition-colors">
              <CreditCard className="h-4 w-4 text-gold" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Carte bancaire</p>
              <p className="text-sm font-medium text-foreground">Visa **** **** **** 4242</p>
            </div>
            <span className="px-2 py-1 text-[9px] font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
          </div>
        </GlassCard>

        <div className="px-4">
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={isSaving}
            className={cn(
              "w-full py-3 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-all",
              editing
                ? isSaving
                  ? "bg-gold/50 text-primary-foreground cursor-not-allowed"
                  : "bg-gold text-primary-foreground hover:bg-gold-light gold-glow-sm"
                : "bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20"
            )}
          >
            {editing
              ? isSaving
                ? <span className="animate-pulse">Enregistrement...</span>
                : "Enregistrer les modifications"
              : "Modifier mes coordonnées bancaires"}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Abonnement Screen ──────────────────────────────────────────

function SubscriptionScreen({ onBack }: { onBack: () => void }) {
  const { plan, upgrade, tokens } = useNox()
  const isTeam = plan === "TEAM"
  const isDuo = plan === "DUO"
  const [showConfetti, setShowConfetti] = useState(false)
  const [targetPlan, setTargetPlan] = useState<"DUO" | "TEAM" | null>(null)
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false)

  function handleChoose(target: "SOLO" | "DUO" | "TEAM") {
    // Downgrade to SOLO requires confirmation
    if (target === "SOLO" && (plan === "DUO" || plan === "TEAM")) {
      setShowDowngradeConfirm(true)
      return
    }
    // Upgrade to DUO or TEAM opens payment drawer
    if (target === "DUO" || target === "TEAM") {
      setTargetPlan(target)
    }
  }

  function confirmDowngrade() {
    setShowDowngradeConfirm(false)
    setShowConfetti(true)
    setTimeout(() => {
      upgrade("SOLO")
      toast("Vous êtes de retour en SOLO", {
        description: tokens > 0 ? `Vos ${tokens} jetons ont été réactivés.` : "Rechargez des jetons pour générer des documents.",
        duration: 3000,
      })
    }, 300)
  }

  const planCards = [
    {
      id: "SOLO" as const,
      name: "SOLO",
      subtitle: "L\u2019offre Ind\u00e9pendant",
      price: "Gratuit",
      capacity: "Max 1 Chauffeur / Max 1 V\u00e9hicule",
      features: ["Signature Entreprise incluse", "Paiement \u00e0 l\u2019usage (jetons)"],
    },
    {
      id: "DUO" as const,
      name: "DUO",
      subtitle: "L\u2019offre Bin\u00f4me",
      price: "4,99\u20ac",
      priceSuffix: "/mois",
      capacity: "Max 2 Chauffeurs / Max 2 V\u00e9hicules",
      features: ["Signature Entreprise incluse", "Documents ILLIMIT\u00c9S"],
    },
    {
      id: "TEAM" as const,
      name: "TEAM",
      subtitle: "L\u2019offre Flotte",
      price: "9,99\u20ac",
      priceSuffix: "/mois",
      capacity: "Max 10 Chauffeurs / Max 10 V\u00e9hicules",
      features: ["Signature Entreprise incluse", "Documents ILLIMIT\u00c9S", "API & Int\u00e9grations", "Statistiques avanc\u00e9es"],
    },
  ]

  return (
    <motion.div key="subscription" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <GoldConfetti trigger={showConfetti} />
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
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Plan actuel</p>
              <p className={cn(
                "text-2xl font-bold font-heading mt-0.5",
                isTeam ? "gold-gradient-text" : isDuo ? "text-gold" : "text-foreground"
              )}>
                {plan}
              </p>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              isTeam ? "bg-gold/20 border border-gold/40" : "bg-gold/10 border border-gold/20"
            )}>
              <Crown className={cn("h-6 w-6", isTeam ? "text-gold" : "text-gold/60")} strokeWidth={1.5} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isTeam
              ? "Vous profitez de toutes les fonctionnalit\u00e9s premium NoX VTC."
              : isDuo
                ? "Documents illimit\u00e9s inclus. Passez \u00e0 TEAM pour g\u00e9rer votre flotte compl\u00e8te."
                : "Paiement \u00e0 l\u2019usage via jetons. Passez \u00e0 DUO ou TEAM pour des documents illimit\u00e9s."
            }
          </p>
        </div>

        {/* Plan Cards */}
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
                    <span className={cn("text-sm font-bold", (isPlanTeam || isPlanDuo) && isCurrent ? "text-gold" : "text-foreground")}>{p.price}</span>
                    {"priceSuffix" in p && p.priceSuffix && (
                      <span className="text-[10px] font-normal text-muted-foreground">{p.priceSuffix}</span>
                    )}
                  </div>
                </div>

                {/* Capacity - single line */}
                <p className={cn(
                  "text-[10px] font-semibold mb-2",
                  isPlanTeam ? "text-gold/80" : isPlanDuo ? "text-gold/70" : "text-muted-foreground"
                )}>
                  {p.capacity}
                </p>

                {/* Features */}
                <div className="space-y-1.5">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className={cn("h-3 w-3 shrink-0", isPlanTeam ? "text-gold" : isPlanDuo ? "text-gold/60" : "text-muted-foreground")} strokeWidth={2} />
                      <span className={cn("text-[11px]", f.includes("ILLIMIT") ? "font-semibold text-gold" : isCurrent ? "text-foreground" : "text-muted-foreground")}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* Show button for upgrades */}
                {isUpgrade && (
                  <button
                    onClick={() => handleChoose(p.id)}
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
                {/* Show downgrade button for SOLO when user is DUO/TEAM */}
                {!isCurrent && p.id === "SOLO" && (plan === "DUO" || plan === "TEAM") && (
                  <button
                    onClick={() => handleChoose("SOLO")}
                    className="w-full mt-3 py-2 rounded-xl text-[11px] font-medium text-muted-foreground border border-onyx-border/30 hover:border-gold/30 hover:text-gold/70 active:scale-[0.98] transition-all"
                  >
                    Repasser en SOLO
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Token conservation note */}
        <div className="mx-4 mb-5 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-onyx-card/50 border border-onyx-border/20">
          <Coins className="h-3.5 w-3.5 text-gold/50 shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {"Vos jetons acquis sont conservés précieusement en cas de changement d'offre."}
          </p>
        </div>
      </div>

      {/* Subscription Payment Drawer */}
      <SubscriptionDrawer
        open={!!targetPlan}
        targetPlan={targetPlan}
        onClose={() => setTargetPlan(null)}
      />

      {/* Downgrade Confirmation Modal */}
      <AnimatePresence>
        {showDowngradeConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={() => setShowDowngradeConfirm(false)} />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="absolute bottom-0 left-0 right-0 mx-auto mb-10 w-[calc(100%-2rem)] max-w-md rounded-2xl bg-[#0A0A0A] border border-[#D4AF37]/50 shadow-[0_8px_40px_rgba(0,0,0,0.9),0_0_30px_rgba(212,175,55,0.2)] p-4 pb-safe"
            >
              {/* Close X */}
              <button
                onClick={() => setShowDowngradeConfirm(false)}
                className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex items-center justify-center hover:bg-[#D4AF37]/25 active:scale-[0.95] transition-all"
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5 text-[#D4AF37]" strokeWidth={2.5} />
              </button>

              {/* Alert Icon */}
              <div className="flex justify-center mb-3 mt-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#D4AF37]/25 to-[#D4AF37]/5 border border-[#D4AF37]/40 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                  <AlertTriangle className="h-4.5 w-4.5 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
              </div>

              {/* Title */}
              <p className="text-xs font-bold text-[#D4AF37] text-center tracking-wider uppercase mb-2">
                Attention
              </p>

              {/* Message */}
              <p className="text-[11px] text-[#A1A1AA] text-center leading-relaxed px-1 mb-4">
                En repassant en SOLO, votre capacité sera limitée à 1 véhicule et 1 chauffeur. Pour générer des documents vous devrez acheter des jetons. Confirmer le changement ?
              </p>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDowngradeConfirm(false)}
                  className="flex-1 py-2.5 min-h-[44px] rounded-xl text-[11px] font-semibold text-[#A1A1AA] border border-[#333] hover:border-[#D4AF37]/30 active:scale-[0.97] transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDowngrade}
                  className="flex-1 py-2.5 min-h-[44px] rounded-xl text-[11px] font-bold bg-gradient-to-r from-[#D4AF37] to-[#B8962E] text-[#0A0A0A] tracking-wide uppercase hover:from-[#E5C44D] hover:to-[#D4AF37] active:scale-[0.97] transition-all shadow-[0_2px_12px_rgba(212,175,55,0.3)]"
                >
                  Confirmer
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
          <p className="text-sm font-semibold font-heading text-foreground mb-1.5">Limite {plan} atteinte</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">
            Vous utilisez {currentLimit}/{currentLimit} {limitLabel}. Choisissez une offre pour en ajouter davantage.
          </p>
        </div>
        <div className="w-full flex gap-2 max-w-[260px]">
          <button onClick={() => upgrade("DUO")} className="flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-2xl bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 active:scale-[0.97] transition-all">
            <Crown className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-[11px] font-bold">DUO</span>
            <span className="text-[10px] text-gold/70 font-medium">4,99&#8364;/mois</span>
          </button>
          <button onClick={() => upgrade("TEAM")} className="flex-1 flex flex-col items-center gap-1 px-3 py-3 rounded-2xl bg-gold text-primary-foreground hover:bg-gold-light active:scale-[0.97] transition-all gold-glow">
            <Crown className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-[11px] font-bold">TEAM</span>
            <span className="text-[10px] text-primary-foreground/70 font-medium">9,99&#8364;/mois</span>
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
        {plan !== "TEAM" && <LockedSlot type="driver" onUpgrade={handleUpgrade} />}
      </div>

      {/* FAB - Add Driver : cadenas si limite atteinte, identique au dashboard */}
      <button
        onClick={() => isFull ? setShowLimitAlert(true) : setDrawerDriver(undefined)}
        className={cn(
          "absolute bottom-6 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all z-30",
          isFull
            ? "bg-onyx-card border border-onyx-border/60 cursor-pointer"
            : "bg-gold gold-glow hover:bg-gold-light"
        )}
      >
        {isFull
          ? <Lock className="h-5 w-5 text-zinc-400" strokeWidth={1.5} />
          : <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
        }
      </button>

      <LimitAlertModal
        open={showLimitAlert}
        onClose={() => setShowLimitAlert(false)}
        resourceLabel="chauffeur"
        onManageOffer={navigateToSubscription}
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
        {plan !== "TEAM" && <LockedSlot type="vehicle" onUpgrade={handleUpgrade} />}
      </div>

      {/* FAB - Add Vehicle : cadenas si limite atteinte, identique au dashboard */}
      <button
        onClick={() => isFull ? setShowLimitAlert(true) : setDrawerVehicle(undefined)}
        className={cn(
          "absolute bottom-6 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all z-30",
          isFull
            ? "bg-onyx-card border border-onyx-border/60 cursor-pointer"
            : "bg-gold gold-glow hover:bg-gold-light"
        )}
      >
        {isFull
          ? <Lock className="h-5 w-5 text-zinc-400" strokeWidth={1.5} />
          : <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
        }
      </button>

      <LimitAlertModal
        open={showLimitAlert}
        onClose={() => setShowLimitAlert(false)}
        resourceLabel="véhicule"
        onManageOffer={navigateToSubscription}
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

// ── Notifications Screen ───��──────────────────────────────────

function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState({
    pushReservations: true,
    pushMessages: true,
    pushPromotions: false,
    emailRecap: true,
    emailFactures: true,
    smsConfirmation: true,
    smsRappel: false,
  })

  function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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

  function NotifRow({ label, description, field }: { label: string; description: string; field: keyof typeof prefs }) {
    return (
      <div className="relative h-[70px] px-4 overflow-hidden">
        <div className="absolute inset-y-0 left-4 right-20 flex flex-col justify-center">
          <p className="text-sm font-medium text-foreground truncate max-w-[70%]">{label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[70%]">{description}</p>
        </div>
        <div className="absolute inset-y-0 right-4 flex items-center">
          <Toggle checked={prefs[field]} onChange={(v) => setPrefs({ ...prefs, [field]: v })} />
        </div>
      </div>
    )
  }

  return (
    <motion.div key="notifications" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <SubScreenHeader title="Notifications" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-24">
        <SectionLabel>Notifications Push</SectionLabel>
        <GlassCard className="mb-5">
          <NotifRow label="Réservations" description="Nouvelles courses et modifications" field="pushReservations" />
          <NotifRow label="Messages" description="Messages des clients et passagers" field="pushMessages" />
          <NotifRow label="Promotions" description="Offres spéciales et nouveautés NoX" field="pushPromotions" />
        </GlassCard>

        <SectionLabel>Notifications Email</SectionLabel>
        <GlassCard className="mb-5">
          <NotifRow label="Récapitulatif journalier" description="Résumé quotidien de votre activité" field="emailRecap" />
          <NotifRow label="Factures" description="Envoi automatique des factures générées" field="emailFactures" />
        </GlassCard>

        <SectionLabel>Notifications SMS</SectionLabel>
        <GlassCard className="mb-5">
          <NotifRow label="Confirmations" description="SMS de confirmation de réservation" field="smsConfirmation" />
          <NotifRow label="Rappels" description="Rappel 1h avant chaque course" field="smsRappel" />
        </GlassCard>
      </div>
    </motion.div>
  )
}

// ── Security Screen ───────────────────────────────────────────

function SecurityScreen({ onBack }: { onBack: () => void }) {
  const [twoFA, setTwoFA] = useState(true)
  const [biometric, setBiometric] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  return (
    <motion.div key="security" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <SubScreenHeader title="Sécurité" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-24">
        {/* AES-256 Banner */}
        <div className="mx-4 mb-5 p-4 rounded-2xl bg-gold/5 border border-gold/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-gold" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">Chiffrement de bout en bout</p>
              <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-gold/15 text-gold border border-gold/25">AES-256</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Toutes vos données sont protégées par un chiffrement de grade militaire.</p>
          </div>
        </div>

        <SectionLabel>Authentification</SectionLabel>
        <GlassCard className="mb-5">
          {/* 2FA */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-gold" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Double authentification (2FA)</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Code SMS ou application Authenticator</p>
            </div>
            <button
              onClick={() => setTwoFA(!twoFA)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0",
                twoFA ? "bg-gold" : "bg-secondary/80 border border-onyx-border/50"
              )}
            >
              <motion.div
                className={cn("absolute top-0.5 w-5 h-5 rounded-full shadow-sm", twoFA ? "bg-primary-foreground" : "bg-muted-foreground/60")}
                animate={{ left: twoFA ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          {/* Biometric */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
              <BadgeCheck className="h-4 w-4 text-gold" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Connexion biométrique</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Face ID / Empreinte digitale</p>
            </div>
            <button
              onClick={() => setBiometric(!biometric)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0",
                biometric ? "bg-gold" : "bg-secondary/80 border border-onyx-border/50"
              )}
            >
              <motion.div
                className={cn("absolute top-0.5 w-5 h-5 rounded-full shadow-sm", biometric ? "bg-primary-foreground" : "bg-muted-foreground/60")}
                animate={{ left: biometric ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
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
                <input
                  type="password"
                  placeholder="Mot de passe actuel"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
                <input
                  type="password"
                  placeholder="Nouveau mot de passe"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
                <input
                  type="password"
                  placeholder="Confirmer le nouveau mot de passe"
                  className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowChangePassword(false)}
                    className="flex-1 py-2.5 rounded-xl bg-secondary/40 border border-onyx-border/30 text-xs font-medium text-muted-foreground hover:bg-secondary/60 active:scale-[0.98] transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => setShowChangePassword(false)}
                    className="flex-1 py-2.5 rounded-xl bg-gold text-primary-foreground text-xs font-semibold hover:bg-gold-light active:scale-[0.98] transition-all gold-glow-sm"
                  >
                    Valider
                  </button>
                </div>
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
                  <p className="text-[11px] text-muted-foreground mt-0.5">Dernière modification il y a 45 jours</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:translate-x-0.5 group-hover:text-gold/50 transition-all" strokeWidth={1.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </GlassCard>

        {/* Sessions */}
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

function MainSettings({ onNavigate }: { onNavigate: (screen: SettingsScreen) => void }) {
  const { plan, tokens, driverCount, vehicleCount, enterprise } = useNox()
  const { logout } = useNav()
  const isTeam = plan === "TEAM"
  const [walletOpen, setWalletOpen] = useState(false)
  const [userInfo, setUserInfo] = useState({ name: "Chargement...", email: "" })

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

  const enterpriseDesc = enterprise.name 
    ? `${enterprise.name}${enterprise.siren ? ` \u2022 SIRET ${enterprise.siren}` : ""}`
    : "Non renseignée"

  const accountSettings: SettingItem[] = [
    { icon: <User className="h-4 w-4" strokeWidth={1.5} />, label: "Compte & Sécurité", description: "Gérer l'accès et les infos", screen: "accountSecurity" },
    { icon: <Building2 className="h-4 w-4" strokeWidth={1.5} />, label: "Profil Entreprise", description: enterpriseDesc, screen: "enterprise" },
    { icon: <FileText className="h-4 w-4" strokeWidth={1.5} />, label: "Mes Conditions de Vente", description: "CGV rattachées à vos documents", screen: "cgv", alertBadge: !enterprise?.cgvMode },
    { icon: <Calculator className="h-4 w-4" strokeWidth={1.5} />, label: "Mes Grilles Tarifaires", description: "Tarifs, suppléments et forfaits", screen: "tarifs" },
    { icon: <Landmark className="h-4 w-4" strokeWidth={1.5} />, label: "Infos Bancaires", description: "Non renseigné", badge: "AES-256", screen: "banking" },
    { icon: <Crown className="h-4 w-4" strokeWidth={1.5} />, label: "Mon Abonnement", description: isTeam ? "Offre TEAM active" : plan === "DUO" ? "Offre DUO active" : "Offre SOLO active", screen: "subscription" },
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
    { icon: <Shield className="h-4 w-4" strokeWidth={1.5} />, label: "Sécurité", badge: "AES-256", description: "Chiffrement de bout en bout", screen: "security" },
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
          <span className={cn("text-[10px] font-bold tracking-wider", isTeam ? "gold-gradient-text" : "text-gold")}>{plan}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* NoX Wallet */}
        <div className="mx-4 mb-5 p-5 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-gold" strokeWidth={1.5} />
            </div>
            <div>
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
            <div className="w-full py-2 rounded-xl bg-gold/15 border border-gold/30 flex flex-col items-center justify-center gap-0.5">
              <span className="text-[11px] font-bold text-gold tracking-wider uppercase">Documents Illimités</span>
              <div className="flex items-center gap-1">
                <Headphones className="h-3 w-3 text-gold/70" strokeWidth={1.5} />
                <span className="text-[9px] text-gold/70 font-medium">Support Prioritaire 24/7</span>
              </div>
            </div>
          )}
        </div>

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

        {/* Application */}
        <SectionLabel>Application</SectionLabel>
        <GlassCard className="mb-5">
          {appSettings.map((item) => (
            <SettingRow key={item.label} item={item} onPress={item.screen ? () => onNavigate(item.screen!) : undefined} />
          ))}
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
            <span className="text-[9px] font-semibold text-gold/60 tracking-wider">AES-256 Secured</span>
          </div>
        </div>
      </div>
      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
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
          {screen === "accountSecurity" && <AccountSecurityScreen key="accountSecurity" onBack={() => setScreen("main")} />}
          {screen === "enterprise" && <EnterpriseScreen key="enterprise" onBack={() => setScreen("main")} />}
          {screen === "banking" && <BankingScreen key="banking" onBack={() => setScreen("main")} />}
          {screen === "subscription" && <SubscriptionScreen key="subscription" onBack={() => setScreen("main")} />}
          {screen === "notifications" && <NotificationsScreen key="notifications" onBack={() => setScreen("main")} />}
          {screen === "security" && <SecurityScreen key="security" onBack={() => setScreen("main")} />}
          {screen === "cgv" && <CGVSettings key="cgv" onBack={() => setScreen("main")} />}
          {screen === "tarifs" && <TarifsSettings key="tarifs" onBack={() => setScreen("main")} />}
        </AnimatePresence>
      </div>
    </SettingsErrorBoundary>
  )
}

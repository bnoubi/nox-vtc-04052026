"use client"

import React, { useState, useRef } from "react"
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
import { usePlan } from "./plan-context"
import { useNav } from "./nav-context"
import { GoldConfetti } from "./gold-confetti"
import { allDrivers, allVehicles } from "./data"
import { AddDriverModal } from "./add-driver-modal"
import { AddVehicleFlow } from "./add-vehicle-modal"

const SOLO_LIMIT = 1
const DUO_LIMIT = 2
const TEAM_LIMIT = 10

type SettingsScreen = "main" | "team" | "fleet" | "profile" | "enterprise" | "banking" | "subscription" | "notifications" | "security"

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

function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
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

function InfoCard({ icon, label, value, masked }: { icon: React.ReactNode; label: string; value: string; masked?: boolean }) {
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

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "mx-4 rounded-2xl bg-onyx-card/80 backdrop-blur-sm border border-onyx-border/40 overflow-hidden divide-y divide-onyx-border/20",
      className
    )}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 text-[10px] font-semibold font-heading text-muted-foreground uppercase tracking-[0.15em] mb-2">
      {children}
    </p>
  )
}

interface SettingItem {
  icon: React.ReactNode
  label: string
  description?: string
  badge?: string
  screen?: SettingsScreen
}

function SettingRow({ item, onPress }: { item: SettingItem; onPress?: () => void }) {
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
    { name: "Apple", connected: true, color: "bg-white/5 border-white/10 text-foreground", hoverColor: "hover:bg-white/10 hover:border-white/20" },
    { name: "LinkedIn", connected: false, color: "bg-blue-500/10 border-blue-500/20 text-blue-400", hoverColor: "hover:bg-blue-500/20 hover:border-blue-500/30" },
  ])

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
              <span className="text-2xl font-bold font-heading text-gold">JD</span>
            </button>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gold flex items-center justify-center border-2 border-background">
              <BadgeCheck className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2} />
            </div>
          </div>
          <h2 className="text-lg font-bold font-heading text-foreground">Jean Dupont</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Chauffeur VTC Professionnel</p>
        </div>

        {/* Contact Info */}
        <SectionLabel>Coordonnées</SectionLabel>
        <GlassCard className="mb-5">
          {editing ? (
            <div className="p-4 space-y-3">
              <input
                type="email"
                defaultValue="jean.dupont@nox-vtc.fr"
                className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
              />
              <input
                type="tel"
                defaultValue="+33 6 12 34 56 78"
                className="w-full px-4 py-3 rounded-xl bg-secondary/60 border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>
          ) : (
            <>
              <InfoCard icon={<Mail className="h-4 w-4 text-gold" strokeWidth={1.5} />} label="Email" value="jean.dupont@nox-vtc.fr" />
              <InfoCard icon={<Phone className="h-4 w-4 text-gold" strokeWidth={1.5} />} label="Téléphone" value="+33 6 12 34 56 78" />
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
            onClick={() => setEditing(!editing)}
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState(false)

  // Identité visuelle
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoName, setLogoName] = useState("")
  const [brandColor, setBrandColor] = useState("#C5A059")

  // Informations légales
  const [legal, setLegal] = useState({
    denomination: "NoX VTC SAS",
    siren: "912 345 678 00015",
    adresse: "42 Avenue des Champs-Élysées, 75008 Paris",
  })

  // Conformité VTC
  const [compliance, setCompliance] = useState({
    registreVTC: "EVTC-2024-75-001234",
    dateRegistre: "2027-03-15",
    dateAssurance: "2026-09-30",
  })

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const registreStatus = getExpirationStatus(compliance.dateRegistre)
  const assuranceStatus = getExpirationStatus(compliance.dateAssurance)

  return (
    <motion.div key="enterprise" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full">
      <SubScreenHeader title="Profil Entreprise" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-20">

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
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-onyx-border/50 hover:border-gold/40 hover:bg-gold/5 active:scale-[0.99] transition-all group"
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
                {logoName ? (
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
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground font-mono focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Adresse du siege social</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
                </div>
                <input
                  type="text"
                  value={legal.adresse}
                  onChange={(e) => setLegal({ ...legal, adresse: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/60 border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>
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
      <div className="absolute bottom-0 left-0 right-0 px-4 py-4 bg-gradient-to-t from-background via-background to-transparent">
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
  const [editing, setEditing] = useState(false)
  const [bank, setBank] = useState({
    banque: "BNP Paribas",
    iban: "FR76 3000 4028 3700 0100 0466 854",
    bic: "BNPAFRPPXXX",
  })

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
            onClick={() => setEditing(!editing)}
            className={cn(
              "w-full py-3 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-all",
              editing
                ? "bg-gold text-primary-foreground hover:bg-gold-light gold-glow-sm"
                : "bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20"
            )}
          >
            {editing ? "Enregistrer les modifications" : "Modifier mes coordonnées bancaires"}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Abonnement Screen ──────────────────────────────────────────

function SubscriptionScreen({ onBack }: { onBack: () => void }) {
  const { plan, upgrade } = usePlan()
  const isTeam = plan === "TEAM"
  const isDuo = plan === "DUO"
  const [showConfetti, setShowConfetti] = useState(false)

  function handleChoose(target: "DUO" | "TEAM") {
    setShowConfetti(true)
    setTimeout(() => upgrade(target), 300)
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
        <div className="space-y-3 px-4 mb-5">
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
                      <span className="px-1.5 py-0.5 text-[8px] font-bold rounded bg-gold/20 text-gold border border-gold/30 uppercase">Actif</span>
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

                {isUpgrade && (
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
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}



// ── Locked Slot ───────────────────────────────────────────────

function LockedSlot({ type }: { type: "driver" | "vehicle"; onUpgrade: () => void }) {
  const { plan, upgrade } = usePlan()
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
  const { plan, upgrade, driverCount } = usePlan()
  const isTeam = plan === "TEAM"
  const limit = plan === "SOLO" ? SOLO_LIMIT : plan === "DUO" ? DUO_LIMIT : TEAM_LIMIT
  const visibleDrivers = allDrivers.slice(0, limit)
  const maxSlots = limit
  const isFull = driverCount >= limit
  const [showConfetti, setShowConfetti] = useState(false)
  const [showAddDriver, setShowAddDriver] = useState(false)
  const { navigateToSubscription } = useNav()

  function handleUpgrade() {
    setShowConfetti(true)
    setTimeout(() => upgrade(), 300)
  }

  function handleLockedFab() {
    toast("Limite atteinte", {
      description: "Limite d\u2019ajout de chauffeur atteinte. Redirection vers les offres...",
      icon: <Crown className="h-5 w-5 text-[#D4AF37] shrink-0" strokeWidth={1.5} />,
      duration: 2000,
    })
    setTimeout(() => navigateToSubscription(), 1500)
  }

  return (
    <motion.div key="team" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full relative">
      <GoldConfetti trigger={showConfetti} />
      <SubScreenHeader title="Gestion de l'Équipe" onBack={onBack} />
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
          {visibleDrivers.map((driver, index) => (
            <motion.div
              key={driver.id}
              initial={isTeam && index >= DUO_LIMIT ? { opacity: 0, y: 20, scale: 0.95 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, delay: index >= DUO_LIMIT ? (index - DUO_LIMIT) * 0.06 : 0 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 cursor-pointer hover:border-gold/30 hover:bg-gold/5 active:scale-[0.98] transition-all duration-150 group"
            >
              <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0 group-hover:bg-gold/25 transition-colors">
                <span className="text-sm font-bold text-gold">{driver.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors">{driver.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Chauffeur VTC</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-gold/50" strokeWidth={1.5} />
            </motion.div>
          ))}
        </AnimatePresence>
        {plan !== "TEAM" && <LockedSlot type="driver" onUpgrade={handleUpgrade} />}
      </div>

      {/* FAB - Add Driver (locked if full) */}
      <button
        onClick={() => isFull ? handleLockedFab() : setShowAddDriver(true)}
        className={cn(
          "absolute bottom-6 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all z-30",
          isFull
            ? "bg-onyx-card border border-gold/30"
            : "bg-gold gold-glow hover:bg-gold-light"
        )}
      >
        {isFull
          ? <Lock className="h-5 w-5 text-gold" strokeWidth={1.5} />
          : <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
        }
      </button>

      <AddDriverModal
        open={showAddDriver}
        onClose={() => setShowAddDriver(false)}
      />
    </motion.div>
  )
}

// ── Fleet Screen ───────────────────────────────────────────────

function FleetScreen({ onBack }: { onBack: () => void }) {
  const { plan, upgrade, vehicleCount } = usePlan()
  const isTeam = plan === "TEAM"
  const limit = plan === "SOLO" ? SOLO_LIMIT : plan === "DUO" ? DUO_LIMIT : TEAM_LIMIT
  const visibleVehicles = allVehicles.slice(0, limit)
  const maxSlots = limit
  const isFull = vehicleCount >= limit
  const [showConfetti, setShowConfetti] = useState(false)
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const { navigateToSubscription } = useNav()

  function handleUpgrade() {
    setShowConfetti(true)
    setTimeout(() => upgrade(), 300)
  }

  function handleLockedFab() {
    toast("Limite atteinte", {
      description: "Limite d\u2019ajout de v\u00e9hicule atteinte. Redirection vers les offres...",
      icon: <Crown className="h-5 w-5 text-[#D4AF37] shrink-0" strokeWidth={1.5} />,
      duration: 2000,
    })
    setTimeout(() => navigateToSubscription(), 1500)
  }

  return (
    <motion.div key="fleet" variants={slideIn} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25, ease: "easeInOut" }} className="flex flex-col h-full relative">
      <GoldConfetti trigger={showConfetti} />
      <SubScreenHeader title="Gestion du Parc" onBack={onBack} />
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
          {visibleVehicles.map((vehicle, index) => (
            <motion.div
              key={vehicle.id}
              initial={isTeam && index >= DUO_LIMIT ? { opacity: 0, y: 20, scale: 0.95 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, delay: index >= DUO_LIMIT ? (index - DUO_LIMIT) * 0.06 : 0 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 cursor-pointer hover:border-gold/30 hover:bg-gold/5 active:scale-[0.98] transition-all duration-150 group"
            >
              <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0 group-hover:bg-gold/25 transition-colors">
                <Car className="h-4 w-4 text-gold" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors">{vehicle.model}</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{vehicle.plate}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-gold/50" strokeWidth={1.5} />
            </motion.div>
          ))}
        </AnimatePresence>
        {plan !== "TEAM" && <LockedSlot type="vehicle" onUpgrade={handleUpgrade} />}
      </div>

      {/* FAB - Add Vehicle (locked if full) */}
      <button
        onClick={() => isFull ? handleLockedFab() : setShowAddVehicle(true)}
        className={cn(
          "absolute bottom-6 right-4 w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all z-30",
          isFull
            ? "bg-onyx-card border border-gold/30"
            : "bg-gold gold-glow hover:bg-gold-light"
        )}
      >
        {isFull
          ? <Lock className="h-5 w-5 text-gold" strokeWidth={1.5} />
          : <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
        }
      </button>

      <AddVehicleFlow
        open={showAddVehicle}
        onClose={() => setShowAddVehicle(false)}
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
      <div className="flex items-center gap-3 px-4 py-3.5 group">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        </div>
        <Toggle checked={prefs[field]} onChange={(v) => setPrefs({ ...prefs, [field]: v })} />
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

// ── Main Settings ─────────────────────────────────────────────

function MainSettings({ onNavigate }: { onNavigate: (screen: SettingsScreen) => void }) {
  const { plan, tokens } = usePlan()
  const isTeam = plan === "TEAM"

  const accountSettings: SettingItem[] = [
    { icon: <User className="h-4 w-4" strokeWidth={1.5} />, label: "Mon Profil", description: "Jean Dupont, jean.dupont@nox-vtc.fr", screen: "profile" },
    { icon: <Building2 className="h-4 w-4" strokeWidth={1.5} />, label: "Profil Entreprise", description: "NoX VTC SAS \u2022 SIRET 912 345 678", screen: "enterprise" },
    { icon: <Landmark className="h-4 w-4" strokeWidth={1.5} />, label: "Infos Bancaires", description: "IBAN \u2022\u2022\u2022\u2022 4668", badge: "AES-256", screen: "banking" },
    { icon: <Crown className="h-4 w-4" strokeWidth={1.5} />, label: "Mon Abonnement", description: isTeam ? "Offre TEAM active" : plan === "DUO" ? "Offre DUO active" : "Offre SOLO active", screen: "subscription" },
  ]

  const managementSettings: SettingItem[] = [
    {
      icon: <Users className="h-4 w-4" strokeWidth={1.5} />,
      label: "Gestion de l'\u00c9quipe",
      description: isTeam ? `${allDrivers.length} chauffeurs actifs` : plan === "DUO" ? "2 chauffeurs max" : "0 chauffeur actif",
      screen: "team",
    },
    {
      icon: <Car className="h-4 w-4" strokeWidth={1.5} />,
      label: "Gestion du Parc",
      description: isTeam ? `${allVehicles.length} vehicules en service` : plan === "DUO" ? "2 vehicules max" : "0 vehicule actif",
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
                  Illimite
                </p>
              )}
            </div>
          </div>
          <div className="w-full py-2 rounded-xl bg-gold/15 border border-gold/30 flex flex-col items-center justify-center gap-0.5">
            <span className="text-[11px] font-bold text-gold tracking-wider uppercase">Documents Illimités</span>
            <div className="flex items-center gap-1">
              <Headphones className="h-3 w-3 text-gold/70" strokeWidth={1.5} />
              <span className="text-[9px] text-gold/70 font-medium">Support Prioritaire 24/7</span>
            </div>
          </div>
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
          <button className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-red-950/30 border border-red-900/40 hover:bg-red-950/50 hover:border-red-800/50 active:scale-[0.98] active:bg-red-950/60 transition-all group">
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
    </motion.div>
  )
}

// ── Export ───���────���────────��────────────────────────────────────

export function SettingsTab() {
  const [screen, setScreen] = useState<SettingsScreen>("main")
  const { registerSettingsNavigator } = useNav()

  React.useEffect(() => {
    registerSettingsNavigator(setScreen)
  }, [registerSettingsNavigator])

  return (
    <div className="h-full overflow-hidden">
      <AnimatePresence mode="wait">
        {screen === "main" && <MainSettings key="main" onNavigate={setScreen} />}
        {screen === "team" && <TeamScreen key="team" onBack={() => setScreen("main")} />}
        {screen === "fleet" && <FleetScreen key="fleet" onBack={() => setScreen("main")} />}
        {screen === "profile" && <ProfileScreen key="profile" onBack={() => setScreen("main")} />}
        {screen === "enterprise" && <EnterpriseScreen key="enterprise" onBack={() => setScreen("main")} />}
        {screen === "banking" && <BankingScreen key="banking" onBack={() => setScreen("main")} />}
        {screen === "subscription" && <SubscriptionScreen key="subscription" onBack={() => setScreen("main")} />}
        {screen === "notifications" && <NotificationsScreen key="notifications" onBack={() => setScreen("main")} />}
        {screen === "security" && <SecurityScreen key="security" onBack={() => setScreen("main")} />}
      </AnimatePresence>
    </div>
  )
}

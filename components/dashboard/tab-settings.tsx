"use client"

import { useState } from "react"
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
  Wifi,
  WifiOff,
  Crown,
  Headphones,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePlan } from "./plan-context"
import { GoldConfetti } from "./gold-confetti"

// ── Constants ──────────────────────────────────────────────────
const PRO_LIMIT = 2
const GOLD_LIMIT = 10

type SettingsScreen = "main" | "team" | "fleet"

interface Driver {
  id: string
  name: string
  initials: string
  online: boolean
}

interface Vehicle {
  id: string
  model: string
  plate: string
  inService: boolean
}

// ── Full Data (10 drivers, 10 vehicles) ────────────────────────

const allDrivers: Driver[] = [
  { id: "1", name: "Karim Benzari", initials: "KB", online: true },
  { id: "2", name: "Sophie Martin", initials: "SM", online: false },
  { id: "3", name: "Lucas Fernandez", initials: "LF", online: true },
  { id: "4", name: "Am\u00e9lie Rousseau", initials: "AR", online: true },
  { id: "5", name: "Thomas Nguyen", initials: "TN", online: false },
  { id: "6", name: "Fatima El Amrani", initials: "FA", online: true },
  { id: "7", name: "Pierre Leclerc", initials: "PL", online: false },
  { id: "8", name: "Nadia Bousquet", initials: "NB", online: true },
  { id: "9", name: "Julien Morel", initials: "JM", online: true },
  { id: "10", name: "Yasmine Khedira", initials: "YK", online: false },
]

const allVehicles: Vehicle[] = [
  { id: "1", model: "Mercedes Classe S", plate: "AB-123-CD", inService: true },
  { id: "2", model: "BMW S\u00e9rie 7", plate: "EF-456-GH", inService: true },
  { id: "3", model: "Audi A8 L", plate: "IJ-789-KL", inService: true },
  { id: "4", model: "Mercedes Classe V", plate: "MN-012-OP", inService: true },
  { id: "5", model: "Van Mercedes Sprinter", plate: "QR-345-ST", inService: false },
  { id: "6", model: "Tesla Model S", plate: "UV-678-WX", inService: true },
  { id: "7", model: "Range Rover Autobiography", plate: "YZ-901-AB", inService: true },
  { id: "8", model: "Porsche Panamera", plate: "CD-234-EF", inService: false },
  { id: "9", model: "Lexus LS 500h", plate: "GH-567-IJ", inService: true },
  { id: "10", model: "Bentley Flying Spur", plate: "KL-890-MN", inService: true },
]

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

// ── Setting Row ───────────────────────────────────────────────

interface SettingItem {
  icon: React.ReactNode
  label: string
  description?: string
  badge?: string
  screen?: SettingsScreen
}

function SettingRow({
  item,
  onPress,
}: {
  item: SettingItem
  onPress?: () => void
}) {
  return (
    <button
      onClick={onPress}
      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-secondary/30 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-muted-foreground">
        {item.icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{item.label}</p>
          {item.badge && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-gold/10 text-gold border border-gold/20">
              {item.badge}
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {item.description}
          </p>
        )}
      </div>
      <ChevronRight
        className="h-4 w-4 text-muted-foreground shrink-0"
        strokeWidth={1.5}
      />
    </button>
  )
}

// ── Locked Slot ───────────────────────────────────────────────

function LockedSlot({
  type,
  onUpgrade,
}: {
  type: "driver" | "vehicle"
  onUpgrade: () => void
}) {
  const limit = type === "driver" ? "chauffeurs" : "v\u00e9hicules"
  return (
    <div className="relative min-h-[320px] rounded-2xl bg-onyx-card/40 border border-onyx-border/30 overflow-hidden">
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

      <div className="relative z-10 flex flex-col items-center justify-center gap-6 p-8 min-h-[320px]">
        <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
          <Lock className="h-6 w-6 text-gold" strokeWidth={1.5} />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-foreground mb-1.5">
            Limite PRO atteinte
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">
            Vous utilisez {PRO_LIMIT}/{PRO_LIMIT} {limit}.{" "}
            <span className="text-gold font-medium">
              {"Passez \u00e0 l\u2019offre GOLD"}
            </span>{" "}
            {"pour g\u00e9rer jusqu\u2019\u00e0"} {GOLD_LIMIT} {limit}.
          </p>
        </div>

        <button
          onClick={onUpgrade}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gold text-primary-foreground text-sm font-semibold hover:bg-gold-light active:scale-[0.97] transition-all gold-glow"
        >
          <Crown className="h-4 w-4" strokeWidth={1.5} />
          {"D\u00e9bloquer l\u2019offre GOLD"}
        </button>
      </div>
    </div>
  )
}

// ── Sub Screen Header ─────────────────────────────────────────

function SubScreenHeader({
  title,
  onBack,
}: {
  title: string
  onBack: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 pt-2 pb-4">
      <button
        onClick={onBack}
        className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
      >
        <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      </button>
      <h1 className="text-lg font-bold text-foreground">{title}</h1>
    </div>
  )
}

// ── Team Screen ────────────────────────────────────────────────

function TeamScreen({ onBack }: { onBack: () => void }) {
  const { plan, upgrade } = usePlan()
  const isGold = plan === "GOLD"
  const visibleDrivers = isGold ? allDrivers : allDrivers.slice(0, PRO_LIMIT)
  const maxSlots = isGold ? GOLD_LIMIT : PRO_LIMIT
  const [showConfetti, setShowConfetti] = useState(false)

  function handleUpgrade() {
    setShowConfetti(true)
    setTimeout(() => upgrade(), 300)
  }

  return (
    <motion.div
      key="team"
      variants={slideIn}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex flex-col h-full"
    >
      <GoldConfetti trigger={showConfetti} />
      <SubScreenHeader
        title={"Gestion de l\u2019\u00c9quipe"}
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-24">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">
            Chauffeurs actifs ({visibleDrivers.length}/{maxSlots})
          </p>
          {isGold && (
            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-gold/15 border border-gold/30 gold-gradient-text">
              GOLD
            </span>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {visibleDrivers.map((driver, index) => (
            <motion.div
              key={driver.id}
              initial={isGold && index >= PRO_LIMIT ? { opacity: 0, y: 20, scale: 0.95 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, delay: index >= PRO_LIMIT ? (index - PRO_LIMIT) * 0.06 : 0 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-onyx-card border border-onyx-border/50"
            >
              <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-gold">
                  {driver.initials}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {driver.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {driver.online ? (
                    <Wifi className="h-3 w-3 text-emerald-400" strokeWidth={1.5} />
                  ) : (
                    <WifiOff className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                  )}
                  <span className={cn(
                    "text-[11px] font-medium",
                    driver.online ? "text-emerald-400" : "text-muted-foreground"
                  )}>
                    {driver.online ? "En ligne" : "Hors ligne"}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
            </motion.div>
          ))}
        </AnimatePresence>

        {!isGold && <LockedSlot type="driver" onUpgrade={handleUpgrade} />}
      </div>
    </motion.div>
  )
}

// ── Fleet Screen ───────────────────────────────────────────────

function FleetScreen({ onBack }: { onBack: () => void }) {
  const { plan, upgrade } = usePlan()
  const isGold = plan === "GOLD"
  const visibleVehicles = isGold ? allVehicles : allVehicles.slice(0, PRO_LIMIT)
  const maxSlots = isGold ? GOLD_LIMIT : PRO_LIMIT
  const [showConfetti, setShowConfetti] = useState(false)

  function handleUpgrade() {
    setShowConfetti(true)
    setTimeout(() => upgrade(), 300)
  }

  return (
    <motion.div
      key="fleet"
      variants={slideIn}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex flex-col h-full"
    >
      <GoldConfetti trigger={showConfetti} />
      <SubScreenHeader title="Gestion du Parc" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-24">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">
            {"V\u00e9hicules en service"} ({visibleVehicles.length}/{maxSlots})
          </p>
          {isGold && (
            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-gold/15 border border-gold/30 gold-gradient-text">
              GOLD
            </span>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {visibleVehicles.map((vehicle, index) => (
            <motion.div
              key={vehicle.id}
              initial={isGold && index >= PRO_LIMIT ? { opacity: 0, y: 20, scale: 0.95 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, delay: index >= PRO_LIMIT ? (index - PRO_LIMIT) * 0.06 : 0 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-onyx-card border border-onyx-border/50"
            >
              <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                <Car className="h-4 w-4 text-gold" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {vehicle.model}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {vehicle.plate}
                  </span>
                  <span className={cn(
                    "px-1.5 py-0.5 text-[9px] font-medium rounded-full border",
                    vehicle.inService
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}>
                    {vehicle.inService ? "En service" : "Indisponible"}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
            </motion.div>
          ))}
        </AnimatePresence>

        {!isGold && <LockedSlot type="vehicle" onUpgrade={handleUpgrade} />}
      </div>
    </motion.div>
  )
}

// ── Main Settings ─────────────────────────────────────────────

function MainSettings({
  onNavigate,
}: {
  onNavigate: (screen: SettingsScreen) => void
}) {
  const { plan } = usePlan()
  const isGold = plan === "GOLD"

  const profileSettings: SettingItem[] = [
    {
      icon: <User className="h-4 w-4" strokeWidth={1.5} />,
      label: "Mon Profil",
      description: "Jean Dupont",
    },
    {
      icon: <Building2 className="h-4 w-4" strokeWidth={1.5} />,
      label: "Profil Entreprise",
      description: "NoX VTC SAS",
    },
    {
      icon: <FileText className="h-4 w-4" strokeWidth={1.5} />,
      label: "SIRET / RIB",
      description: "Documents l\u00e9gaux",
    },
  ]

  const managementSettings: SettingItem[] = [
    {
      icon: <Users className="h-4 w-4" strokeWidth={1.5} />,
      label: "Gestion de l\u2019\u00c9quipe",
      description: isGold
        ? `${allDrivers.length} chauffeurs actifs`
        : "2 chauffeurs actifs",
      screen: "team",
    },
    {
      icon: <Car className="h-4 w-4" strokeWidth={1.5} />,
      label: "Gestion du Parc",
      description: isGold
        ? `${allVehicles.length} v\u00e9hicules en service`
        : "2 v\u00e9hicules en service",
      screen: "fleet",
    },
  ]

  const appSettings: SettingItem[] = [
    {
      icon: <Bell className="h-4 w-4" strokeWidth={1.5} />,
      label: "Notifications",
      description: "Push, Email, SMS",
    },
    {
      icon: <CreditCard className="h-4 w-4" strokeWidth={1.5} />,
      label: "Moyen de Paiement",
      description: "Visa **** 4242",
    },
    {
      icon: <Shield className="h-4 w-4" strokeWidth={1.5} />,
      label: "S\u00e9curit\u00e9",
      badge: "AES-256",
      description: "Chiffrement de bout en bout",
    },
  ]

  return (
    <motion.div
      key="main"
      variants={slideBack}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex flex-col h-full"
    >
      <div className="px-4 pt-2 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">
          {"R\u00e9glages"}
        </h1>
        <div className={cn(
          "px-2.5 py-1 rounded-lg border",
          isGold
            ? "bg-gradient-to-r from-gold/25 via-gold/15 to-gold/25 border-gold/50 gold-badge-glow"
            : "bg-gold/15 border-gold/30"
        )}>
          <span className={cn(
            "text-[10px] font-bold tracking-wider",
            isGold ? "gold-gradient-text" : "text-gold"
          )}>
            {plan}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* NoX Wallet */}
        <div className="mx-4 mb-5 p-5 rounded-2xl bg-onyx-card border border-onyx-border/30 opacity-40 pointer-events-none">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-gold/60" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">NoX Wallet</p>
              <p className="text-xl font-bold text-foreground/60">
                5{" "}
                <span className="text-gold/60 text-sm font-semibold">
                  {"Cr\u00e9dits"}
                </span>
              </p>
            </div>
          </div>
          <div className="w-full py-2 rounded-xl bg-gold/15 border border-gold/30 flex flex-col items-center justify-center gap-0.5">
            <span className="text-[11px] font-bold text-gold tracking-wider uppercase">
              {"Documents Illimit\u00e9s"}
            </span>
            <div className="flex items-center gap-1">
              <Headphones className="h-3 w-3 text-gold/70" strokeWidth={1.5} />
              <span className="text-[9px] text-gold/70 font-medium">
                {"Support Prioritaire 24/7"}
              </span>
            </div>
          </div>
        </div>

        {/* Compte */}
        <div className="mb-5">
          <p className="px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Compte
          </p>
          <div className="rounded-2xl mx-4 bg-onyx-card border border-onyx-border/50 overflow-hidden divide-y divide-onyx-border/30">
            {profileSettings.map((item) => (
              <SettingRow key={item.label} item={item} />
            ))}
          </div>
        </div>

        {/* Gestion */}
        <div className="mb-5">
          <p className="px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Gestion
          </p>
          <div className="rounded-2xl mx-4 bg-onyx-card border border-onyx-border/50 overflow-hidden divide-y divide-onyx-border/30">
            {managementSettings.map((item) => (
              <SettingRow
                key={item.label}
                item={item}
                onPress={
                  item.screen ? () => onNavigate(item.screen!) : undefined
                }
              />
            ))}
          </div>
        </div>

        {/* Application */}
        <div className="mb-5">
          <p className="px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Application
          </p>
          <div className="rounded-2xl mx-4 bg-onyx-card border border-onyx-border/50 overflow-hidden divide-y divide-onyx-border/30">
            {appSettings.map((item) => (
              <SettingRow key={item.label} item={item} />
            ))}
          </div>
        </div>

        {/* Deconnexion */}
        <div className="mx-4 mb-6">
          <button className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-red-500/20 hover:bg-red-500/10 transition-colors">
            <LogOut className="h-4 w-4 text-red-400" strokeWidth={1.5} />
            <span className="text-sm font-medium text-red-400">
              {"D\u00e9connexion"}
            </span>
          </button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mb-4">
          NoX VTC v1.0.0
        </p>
      </div>
    </motion.div>
  )
}

// ── Export ──────────────────────────────────────────────────────

export function SettingsTab() {
  const [screen, setScreen] = useState<SettingsScreen>("main")

  return (
    <div className="h-full overflow-hidden">
      <AnimatePresence mode="wait">
        {screen === "main" && (
          <MainSettings key="main" onNavigate={setScreen} />
        )}
        {screen === "team" && (
          <TeamScreen key="team" onBack={() => setScreen("main")} />
        )}
        {screen === "fleet" && (
          <FleetScreen key="fleet" onBack={() => setScreen("main")} />
        )}
      </AnimatePresence>
    </div>
  )
}

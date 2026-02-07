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
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────

type SettingsScreen = "main" | "team" | "fleet"

interface SettingItem {
  icon: React.ReactNode
  label: string
  description?: string
  badge?: string
  screen?: SettingsScreen
}

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

// ── Data ───────────────────────────────────────────────────────

const drivers: Driver[] = [
  { id: "1", name: "Karim Benzari", initials: "KB", online: true },
  { id: "2", name: "Sophie Martin", initials: "SM", online: false },
]

const vehicles: Vehicle[] = [
  { id: "1", model: "Mercedes Classe S", plate: "AB-123-CD", inService: true },
  { id: "2", model: "BMW Série 7", plate: "EF-456-GH", inService: true },
]

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
    description: "Documents légaux",
  },
]

const managementSettings: SettingItem[] = [
  {
    icon: <Users className="h-4 w-4" strokeWidth={1.5} />,
    label: "Gestion de l'Équipe",
    description: "2 chauffeurs actifs",
    screen: "team",
  },
  {
    icon: <Car className="h-4 w-4" strokeWidth={1.5} />,
    label: "Gestion du Parc",
    description: "2 véhicules en service",
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
    label: "Sécurité",
    badge: "AES-256",
    description: "Chiffrement de bout en bout",
  },
]

// ── Transition variants ────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────

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

function LockedSlot({
  type,
}: {
  type: "driver" | "vehicle"
}) {
  const limit = type === "driver" ? "chauffeurs" : "véhicules"
  return (
    <div className="relative rounded-2xl bg-onyx-card/40 border border-onyx-border/30 overflow-hidden mb-4">
      {/* Ghost content behind blur */}
      <div className="p-4 opacity-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-onyx-border/50" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 bg-onyx-border/50 rounded" />
            <div className="h-2 w-20 bg-onyx-border/30 rounded" />
          </div>
        </div>
      </div>

      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-background/60 z-10 flex flex-col items-center justify-center px-6 py-6 text-center">
        <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center mb-3">
          <Lock className="h-4 w-4 text-gold" strokeWidth={1.5} />
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
          Limite PRO atteinte (2/2).{" "}
          <span className="text-foreground font-medium">
            Passez {"à"} l{"'"}offre GOLD
          </span>{" "}
          pour g{"é"}rer jusqu{"'"}{"à"} 10 {limit}.
        </p>
        <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gold text-primary-foreground text-xs font-semibold hover:bg-gold-light active:scale-[0.97] transition-all gold-glow-sm">
          <Crown className="h-3.5 w-3.5" strokeWidth={1.5} />
          D{"é"}bloquer l{"'"}offre GOLD
        </button>
      </div>
    </div>
  )
}

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
      <SubScreenHeader title="Gestion de l'Équipe" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-20">
        <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">
          Chauffeurs actifs (2/2)
        </p>

        {drivers.map((driver) => (
          <div
            key={driver.id}
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
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    driver.online
                      ? "text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {driver.online ? "En ligne" : "Hors ligne"}
                </span>
              </div>
            </div>
            <ChevronRight
              className="h-4 w-4 text-muted-foreground shrink-0"
              strokeWidth={1.5}
            />
          </div>
        ))}

        {/* Locked 3rd slot */}
        <LockedSlot type="driver" />
      </div>
    </motion.div>
  )
}

// ── Fleet Screen ───────────────────────────────────────────────

function FleetScreen({ onBack }: { onBack: () => void }) {
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
      <SubScreenHeader title="Gestion du Parc" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-20">
        <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">
          V{"é"}hicules en service (2/2)
        </p>

        {vehicles.map((vehicle) => (
          <div
            key={vehicle.id}
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
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-[9px] font-medium rounded-full border",
                    vehicle.inService
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  {vehicle.inService ? "En service" : "Indisponible"}
                </span>
              </div>
            </div>
            <ChevronRight
              className="h-4 w-4 text-muted-foreground shrink-0"
              strokeWidth={1.5}
            />
          </div>
        ))}

        {/* Locked 3rd slot */}
        <LockedSlot type="vehicle" />
      </div>
    </motion.div>
  )
}

// ── Main Settings Screen ───────────────────────────────────────

function MainSettings({
  onNavigate,
}: {
  onNavigate: (screen: SettingsScreen) => void
}) {
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
        <h1 className="text-lg font-bold text-foreground">Réglages</h1>
        <div className="px-2.5 py-1 rounded-lg bg-gold/15 border border-gold/30">
          <span className="text-[10px] font-bold text-gold tracking-wider">
            PRO
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* NoX Wallet - Inactive for PRO (documents unlimited) */}
        <div className="mx-4 mb-5 p-5 rounded-2xl bg-onyx-card border border-onyx-border/30 opacity-50 pointer-events-none">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <Coins className="h-5 w-5 text-gold/60" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">NoX Wallet</p>
              <p className="text-xl font-bold text-foreground/60">
                5{" "}
                <span className="text-gold/60 text-sm font-semibold">
                  Crédits
                </span>
              </p>
            </div>
          </div>
          <div className="w-full py-2.5 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
            <span className="text-[11px] font-bold text-gold tracking-wider uppercase">
              Documents Illimit{"é"}s
            </span>
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

        {/* Déconnexion */}
        <div className="mx-4 mb-6">
          <button className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-red-500/20 hover:bg-red-500/10 transition-colors">
            <LogOut className="h-4 w-4 text-red-400" strokeWidth={1.5} />
            <span className="text-sm font-medium text-red-400">
              Déconnexion
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

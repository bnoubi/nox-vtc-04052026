"use client"

import {
  Coins,
  Building2,
  FileText,
  Shield,
  ChevronRight,
  LogOut,
  CreditCard,
  Bell,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SettingItem {
  icon: React.ReactNode
  label: string
  description?: string
  badge?: string
}

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

function SettingRow({ item }: { item: SettingItem }) {
  return (
    <button className="flex items-center gap-3 w-full px-4 py-3 hover:bg-secondary/30 transition-colors">
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
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.description}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
    </button>
  )
}

export function SettingsTab() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-2">
        <h1 className="text-lg font-bold text-foreground">Réglages</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* NoX Wallet Section */}
        <div className="mx-4 mb-5 p-5 rounded-2xl bg-onyx-card border border-gold/30 gold-glow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center">
              <Coins className="h-5 w-5 text-gold" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">NoX Wallet</p>
              <p className="text-xl font-bold text-foreground">
                5 <span className="text-gold text-sm font-semibold">Crédits</span>
              </p>
            </div>
          </div>
          <button className="w-full py-2.5 rounded-xl bg-gold text-primary-foreground text-sm font-semibold hover:bg-gold-light active:scale-[0.98] transition-all">
            Recharger
          </button>
        </div>

        {/* Profile Section */}
        <div className="mb-2">
          <p className="px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Compte
          </p>
          <div className="rounded-2xl mx-4 bg-onyx-card border border-onyx-border/50 overflow-hidden divide-y divide-onyx-border/30">
            {profileSettings.map((item) => (
              <SettingRow key={item.label} item={item} />
            ))}
          </div>
        </div>

        {/* App Settings */}
        <div className="mb-5 mt-5">
          <p className="px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Application
          </p>
          <div className="rounded-2xl mx-4 bg-onyx-card border border-onyx-border/50 overflow-hidden divide-y divide-onyx-border/30">
            {appSettings.map((item) => (
              <SettingRow key={item.label} item={item} />
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="mx-4 mb-6">
          <button className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-red-500/20 hover:bg-red-500/10 transition-colors">
            <LogOut className="h-4 w-4 text-red-400" strokeWidth={1.5} />
            <span className="text-sm font-medium text-red-400">Déconnexion</span>
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground mb-4">
          NoX VTC v1.0.0
        </p>
      </div>
    </div>
  )
}

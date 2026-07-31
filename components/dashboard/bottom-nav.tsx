"use client"

import { LayoutDashboard, Calendar, FileText, Users, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export type TabId = "dashboard" | "calendar" | "documents" | "clients" | "settings"

interface NavItem {
  icon: React.ReactNode
  label: string
  id: TabId
}

const navItems: NavItem[] = [
  {
    icon: <LayoutDashboard className="h-5 w-5" strokeWidth={1.5} />,
    label: "Tableau\nde Bord",
    id: "dashboard",
  },
  {
    icon: <Calendar className="h-5 w-5" strokeWidth={1.5} />,
    label: "Calendrier\ndes courses",
    id: "calendar",
  },
  {
    icon: <FileText className="h-5 w-5" strokeWidth={1.5} />,
    label: "Réservations\n& Factures",
    id: "documents",
  },
  {
    icon: <Users className="h-5 w-5" strokeWidth={1.5} />,
    label: "Clients\n& Sociétés",
    id: "clients",
  },
  {
    icon: <Settings className="h-5 w-5" strokeWidth={1.5} />,
    label: "Réglages",
    id: "settings",
  },
]

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (id: TabId) => void
  // TODO: brancher sur le système de promo ciblée par segment (post-launch, backlog point 3)
  // Passer hasOffer=true depuis le parent quand une offre est dispo pour l'utilisateur connecté.
  // La pastille disparaît quand le parent reçoit onTabChange("settings") et remet hasOffer à false.
  hasOffer?: boolean
}

export function BottomNav({ activeTab, onTabChange, hasOffer = false }: BottomNavProps) {
  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-40" />

      <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-6 pt-2">
        <div className="max-w-md mx-auto bg-[#0F0F0F]/95 backdrop-blur-xl rounded-2xl border border-gold/10 px-2 py-3">
          <div className="grid grid-cols-5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all duration-200",
                    isActive
                      ? "text-gold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "relative transition-all duration-200",
                      isActive && "gold-glow-sm rounded-lg p-1 -m-1",
                    )}
                  >
                    {item.icon}
                    {item.id === "settings" && hasOffer && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.8)]" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium leading-tight text-center w-full whitespace-pre-line",
                      isActive ? "text-gold" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}

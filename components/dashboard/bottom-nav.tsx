"use client"

import React from "react"

import { LayoutDashboard, Calendar, FileText, Users, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface NavItem {
  icon: React.ReactNode
  label: string
  id: string
}

const navItems: NavItem[] = [
  {
    icon: <LayoutDashboard className="h-5 w-5" strokeWidth={1.5} />,
    label: "Tableau de Bord",
    id: "dashboard",
  },
  {
    icon: <Calendar className="h-5 w-5" strokeWidth={1.5} />,
    label: "Calendrier",
    id: "calendar",
  },
  {
    icon: <FileText className="h-5 w-5" strokeWidth={1.5} />,
    label: "Documents",
    id: "documents",
  },
  {
    icon: <Users className="h-5 w-5" strokeWidth={1.5} />,
    label: "Clients",
    id: "users",
  },
  {
    icon: <Settings className="h-5 w-5" strokeWidth={1.5} />,
    label: "Réglages",
    id: "settings",
  },
]

export function BottomNav() {
  const [activeId, setActiveId] = useState("dashboard")

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2">
      <div className="glass-nav rounded-2xl border border-gold/10 px-2 py-3">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = activeId === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveId(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200",
                  isActive
                    ? "text-gold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "transition-all duration-200",
                    isActive && "gold-glow-sm rounded-lg p-1 -m-1"
                  )}
                >
                  {item.icon}
                </div>
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-gold" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

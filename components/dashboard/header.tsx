"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Coins } from "lucide-react"
import { usePlan } from "./plan-context"
import { cn } from "@/lib/utils"

export function DashboardHeader() {
  const { plan, tokens } = usePlan()
  const isGold = plan === "GOLD"

  return (
    <header className="flex items-center justify-between px-4 py-4">
      {/* User Profile */}
      <div className="flex items-center gap-3">
        <Avatar className={cn("h-11 w-11 border", isGold ? "border-gold/50" : "border-gold/30")}>
          <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
          <AvatarFallback className="bg-onyx-card text-foreground text-sm font-medium">
            JD
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Bonjour</span>
          <span className="text-sm font-semibold text-foreground">Jean Dupont</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Plan Badge */}
        <div className={cn(
          "px-3 py-1.5 rounded-xl border",
          isGold
            ? "bg-gradient-to-r from-gold/25 via-gold/15 to-gold/25 border-gold/50 gold-badge-glow"
            : plan === "PRO"
              ? "bg-gold/15 border-gold/30"
              : "bg-onyx-card/80 border-onyx-border/40"
        )}>
          <span className={cn(
            "text-[10px] font-bold tracking-wider",
            isGold ? "gold-gradient-text" : plan === "PRO" ? "text-gold" : "text-muted-foreground"
          )}>
            {plan}
          </span>
        </div>

        {/* Wallet Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-onyx-card/80 backdrop-blur-sm border border-gold/20">
          <Coins className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
          <span className="text-[11px] font-bold text-gold">{tokens}</span>
          <span className="text-[9px] font-medium text-gold/60">Jetons</span>
        </div>
      </div>
    </header>
  )
}

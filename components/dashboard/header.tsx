"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Coins } from "lucide-react"
import { usePlan } from "./plan-context"
import { cn } from "@/lib/utils"
import { WalletDrawer } from "./wallet-drawer"

export function DashboardHeader() {
  const { plan, tokens } = usePlan()
  const isTeam = plan === "TEAM"
  const [walletOpen, setWalletOpen] = useState(false)

  return (
    <header className="flex items-center justify-between px-4 py-4">
      {/* User Profile */}
      <div className="flex items-center gap-3">
        <Avatar className={cn("h-11 w-11 border", isTeam ? "border-gold/50" : "border-gold/30")}>
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
          isTeam
            ? "bg-gradient-to-r from-gold/25 via-gold/15 to-gold/25 border-gold/50 gold-badge-glow"
            : plan === "DUO"
              ? "bg-gradient-to-r from-gold/20 via-gold/10 to-gold/20 border-gold/40"
              : "bg-gradient-to-r from-[#D4AF37]/12 via-transparent to-[#D4AF37]/12 border-[#D4AF37]/35 shadow-[0_0_10px_rgba(212,175,55,0.08)]"
        )}>
          <span className={cn(
            "text-[10px] font-bold tracking-[0.15em]",
            isTeam ? "gold-gradient-text" : plan === "DUO" ? "text-gold" : "text-[#D4AF37]"
          )}>
            {plan}
          </span>
        </div>

        {/* Wallet Pill - Glassmorphism - Clickable */}
        {plan === "SOLO" ? (
          <button
            onClick={() => setWalletOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-[#D4AF37]/30 shadow-[0_0_8px_rgba(212,175,55,0.1)] hover:border-[#D4AF37]/50 active:scale-95 transition-all"
          >
            <Coins className="h-3.5 w-3.5 text-[#D4AF37]" strokeWidth={1.5} />
            <span className="text-[11px] font-bold text-[#D4AF37]">{tokens}</span>
            <span className="text-[9px] font-medium text-[#D4AF37]/50">Jetons</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-[#D4AF37]/15 shadow-[0_0_8px_rgba(212,175,55,0.05)]">
            <Coins className="h-3.5 w-3.5 text-[#D4AF37]/50" strokeWidth={1.5} />
            <span className="text-[9px] font-medium text-[#D4AF37]/40">Illimit&#233;</span>
          </div>
        )}
      </div>

      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
    </header>
  )
}

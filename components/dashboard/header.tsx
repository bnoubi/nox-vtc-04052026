"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Coins } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-4">
      {/* User Profile */}
      <div className="flex items-center gap-3">
        <Avatar className="h-11 w-11 border border-gold/30">
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
        {/* PRO Badge */}
        <div className="px-2.5 py-1.5 rounded-xl bg-gold/15 border border-gold/30">
          <span className="text-[10px] font-bold text-gold tracking-wider">PRO</span>
        </div>

        {/* Crédits NoX Badge - Greyed for PRO */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-onyx-card border border-onyx-border/30 opacity-40">
          <Coins className="h-3.5 w-3.5 text-gold/60" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-gold/60">5</span>
        </div>
      </div>
    </header>
  )
}

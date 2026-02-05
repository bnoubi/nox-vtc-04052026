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

      {/* Token Wallet Badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-onyx-card border border-gold/20 gold-glow-sm">
        <Coins className="h-4 w-4 text-gold" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-gold">5</span>
      </div>
    </header>
  )
}

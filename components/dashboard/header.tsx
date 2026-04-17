"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Coins } from "lucide-react"
import { useNox } from "./nox-context"
import { useNav } from "./nav-context"
import { cn } from "@/lib/utils"
import { WalletDrawer } from "./wallet-drawer"
import { createClient } from "@/lib/supabase/client"

export function DashboardHeader() {
  const { plan, tokens, userProfile } = useNox()
  const { registerWalletOpener } = useNav()
  const isTeam = plan === "TEAM"
  const [walletOpen, setWalletOpen] = useState(false)

  // Données réelles de l'utilisateur connecté
  const [displayName, setDisplayName] = useState("")
  const [initials, setInitials] = useState("—")

  useEffect(() => {
    // 1. Si on a des données profil depuis le context, on les utilise (réactivité assurée)
    if (userProfile?.prenom || userProfile?.nom) {
      const first = userProfile.prenom || ""
      const last = userProfile.nom || ""
      const combined = `${first} ${last}`.trim()
      setDisplayName(combined)
      setInitials(`${first[0] || ""}${last[0] || ""}`.toUpperCase() || "—")
      return; // On s'arrête ici
    }

    // 2. Fallback asynchrone si le profil est vide
    async function loadFallbackUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Préférer le full_name des metadata (Google OAuth ou inscription)
      const fullName: string =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        ""

      const firstName: string = user.user_metadata?.given_name || ""
      const lastName: string = user.user_metadata?.family_name || ""

      if (fullName) {
        setDisplayName(fullName)
        const parts = fullName.trim().split(" ")
        const init = parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : fullName.substring(0, 2).toUpperCase()
        setInitials(init)
      } else if (firstName || lastName) {
        const combined = `${firstName} ${lastName}`.trim()
        setDisplayName(combined)
        setInitials(`${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "—")
      } else if (user.email) {
        // Fallback ultime : afficher le début de l'email
        const emailPrefix = user.email.split("@")[0]
        setDisplayName(emailPrefix)
        setInitials(emailPrefix.substring(0, 2).toUpperCase())
      }
    }

    loadFallbackUser()
  }, [userProfile?.prenom, userProfile?.nom])

  const openWallet = useCallback(() => setWalletOpen(true), [])

  useEffect(() => {
    registerWalletOpener(openWallet)
  }, [registerWalletOpener, openWallet])

  return (
    <header className="flex items-center justify-between px-4 py-4">
      {/* Brand Icon + User Profile */}
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-xl overflow-hidden flex-shrink-0">
          <Image
            src="/assets/icon.png"
            alt="NOX VTC"
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        </div>
        <Avatar className={cn("h-11 w-11 border", isTeam ? "border-gold/50" : "border-gold/30")}>
          <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
          <AvatarFallback className="bg-onyx-card text-foreground text-sm font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Bonjour</span>
          <span className="text-sm font-semibold text-foreground">
            {displayName || "Mon compte"}
          </span>
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
            <span className="text-[9px] font-medium text-[#D4AF37]/40">Illimité</span>
          </div>
        )}
      </div>

      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
    </header>
  )
}

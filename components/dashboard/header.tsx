"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Coins, Bell } from "lucide-react"
import { useNox } from "./nox-context"
import { useNav } from "./nav-context"
import { cn } from "@/lib/utils"
import { WalletDrawer } from "./wallet-drawer"
import { createClient } from "@/lib/supabase/client"

const PLAN_LABEL: Record<string, string> = { SOLO: "Starter", DUO: "Pro", TEAM: "Premium" }

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

export function DashboardHeader() {
  const { plan, tokens, userProfile } = useNox()
  const { registerWalletOpener } = useNav()
  const isTeam = plan === "TEAM"
  const [walletOpen, setWalletOpen] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [initials, setInitials] = useState("—")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)

  const supabase = createClient()
  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (userProfile?.prenom || userProfile?.nom) {
      const first = userProfile.prenom || ""
      const last = userProfile.nom || ""
      setDisplayName(`${first} ${last}`.trim())
      setInitials(`${first[0] || ""}${last[0] || ""}`.toUpperCase() || "—")
      return
    }
    async function loadFallbackUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const fullName: string = user.user_metadata?.full_name || user.user_metadata?.name || ""
      const firstName: string = user.user_metadata?.given_name || ""
      const lastName: string = user.user_metadata?.family_name || ""
      if (fullName) {
        setDisplayName(fullName)
        const parts = fullName.trim().split(" ")
        setInitials(parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : fullName.substring(0, 2).toUpperCase())
      } else if (firstName || lastName) {
        setDisplayName(`${firstName} ${lastName}`.trim())
        setInitials(`${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "—")
      } else if (user.email) {
        const prefix = user.email.split("@")[0]
        setDisplayName(prefix)
        setInitials(prefix.substring(0, 2).toUpperCase())
      }
    }
    loadFallbackUser()
  }, [userProfile?.prenom, userProfile?.nom]) // eslint-disable-line

  useEffect(() => {
    let userId: string | null = null

    async function loadNotifications() {
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        userId = user.id
      }
      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, message, read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifications(data as Notification[])
    }

    void loadNotifications()
    const interval = setInterval(() => { void loadNotifications() }, 60 * 1000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  async function markAllRead() {
    const ids = notifications.filter(n => !n.read).map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const openWallet = useCallback(() => setWalletOpen(true), [])
  useEffect(() => { registerWalletOpener(openWallet) }, [registerWalletOpener, openWallet])

  return (
    <header className="flex items-center justify-between px-4 py-4">
      {/* Brand + Avatar + Name */}
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-xl overflow-hidden flex-shrink-0">
          <Image src="/assets/icon.png" alt="NOX VTC" width={40} height={40} className="w-full h-full object-cover" />
        </div>
        <Avatar className={cn("h-11 w-11 border", isTeam ? "border-gold/50" : "border-gold/30")}>
          <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
          <AvatarFallback className="bg-onyx-card text-foreground text-sm font-medium">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Bonjour</span>
          <span className="text-sm font-semibold text-foreground">{displayName || "Mon compte"}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Cloche notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(v => !v); if (!showNotifs) void markAllRead() }}
            className="relative p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors"
          >
            <Bell className="h-5 w-5" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {showNotifs && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
              <div className="fixed top-16 right-2 w-72 max-w-[calc(100vw-1rem)] bg-[#1a1a1a] border border-onyx-border/30 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-onyx-border/20">
                  <span className="text-sm font-semibold text-foreground">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={() => void markAllRead()} className="text-[11px] text-gold hover:text-gold/80">
                      Tout marquer lu
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucune notification</p>
                  ) : notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => void markRead(n.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-onyx-border/10 last:border-0 hover:bg-white/5 transition-colors",
                        !n.read && "bg-gold/5"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold flex-shrink-0" />}
                        <div className={cn("flex-1 min-w-0", n.read && "pl-3.5")}>
                          <p className="text-[12px] font-semibold text-foreground">{n.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

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
            {PLAN_LABEL[plan] ?? plan}
          </span>
        </div>

        {/* Wallet Pill */}
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

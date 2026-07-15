"use client"

import { useState, useEffect, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Coins, Gem, Crown, Bell, CheckCircle2, XCircle } from "lucide-react"
import { useNox } from "./nox-context"
import { useNav } from "./nav-context"
import { cn } from "@/lib/utils"
import { WalletDrawer } from "./wallet-drawer"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

const PLAN_UI = {
  SOLO: {
    Icon: Coins,
    label: 'Starter',
    color: '#9CA3AF',
    badgeBg: '#1F2224',
    borderColor: '#9CA3AF4D',
    avatarGradient: 'linear-gradient(135deg, #B0B6BD, #6B7280)',
    greetingColor: '#9CA3AF',
  },
  DUO: {
    Icon: Gem,
    label: 'Pro',
    color: '#3B82F6',
    badgeBg: '#10192B',
    borderColor: '#3B82F64D',
    avatarGradient: 'linear-gradient(135deg, #60A5FA, #2563EB)',
    greetingColor: '#3B82F6',
  },
  TEAM: {
    Icon: Crown,
    label: 'Premium',
    color: '#EAB308',
    badgeBg: '#241D0A',
    borderColor: '#EAB3084D',
    avatarGradient: 'linear-gradient(135deg, #EAB308, #B8860B)',
    greetingColor: '#EAB308',
  },
} as const

interface Notification {
  id: string
  type: string
  title: string
  message: string
  data?: { trip_id?: string; contract_id?: string; action?: string }
  read: boolean
  created_at: string
}

export function DashboardHeader() {
  const { plan, tokens, userProfile, subscriptionStatus, trialEndsAt } = useNox()
  const { registerWalletOpener } = useNav()
  const isTrial = subscriptionStatus === "trial"
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil(
        (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : 0

  const planKey = (plan === 'DUO' ? 'DUO' : plan === 'TEAM' ? 'TEAM' : 'SOLO') as keyof typeof PLAN_UI
  const planUi = PLAN_UI[planKey]
  const PlanIcon = planUi.Icon
  const badgeValue = plan === 'SOLO' ? String(tokens) : '∞'

  const [walletOpen, setWalletOpen] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [initials, setInitials] = useState("—")
  const [salutation, setSalutation] = useState("")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)

  const supabase = createClient()
  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    const h = new Date().getHours()
    setSalutation(h >= 5 && h < 18 ? "Bonjour" : "Bonsoir")
  }, [])

  useEffect(() => {
    if (userProfile?.prenom || userProfile?.nom) {
      const first = userProfile.prenom || ""
      const last = userProfile.nom || ""
      setDisplayName((first || last).slice(0, 12))
      setInitials(`${first[0] || ""}${last[0] || ""}`.toUpperCase() || "—")
      return
    }
    async function loadFallbackUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const fullName: string = user.user_metadata?.full_name || user.user_metadata?.name || ""
      const firstName: string = user.user_metadata?.given_name || ""
      const lastName: string = user.user_metadata?.family_name || ""
      if (firstName) {
        setDisplayName(firstName.slice(0, 12))
        setInitials(`${firstName[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "—")
      } else if (fullName) {
        const parts = fullName.trim().split(" ")
        setDisplayName(parts[0].slice(0, 12))
        setInitials(parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : fullName.substring(0, 2).toUpperCase())
      } else if (lastName) {
        setDisplayName(lastName.slice(0, 12))
        setInitials(lastName.substring(0, 2).toUpperCase())
      } else if (user.email) {
        const prefix = user.email.split("@")[0]
        setDisplayName(prefix.slice(0, 12))
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
        .select('id, type, title, message, data, read, created_at')
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
    const ids = notifications.filter(n => !n.read && n.type !== 'trip_confirmation').map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    setNotifications(prev => prev.map(n =>
      n.type !== 'trip_confirmation' ? { ...n, read: true } : n
    ))
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function confirmTrip(notifId: string, tripId: string, status: 'completed' | 'missed') {
    const res = await fetch('/api/trips/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: tripId, status, notification_id: notifId }),
    })
    if (res.ok) {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
      toast.success(status === 'completed' ? 'Course marquée réalisée' : 'Course marquée non réalisée')
    } else {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const openWallet = useCallback(() => setWalletOpen(true), [])
  useEffect(() => { registerWalletOpener(openWallet) }, [registerWalletOpener, openWallet])

  return (
    <header className="flex items-center justify-between px-4 py-2">
      {/* Avatar + Formule de politesse */}
      <div className="flex items-center gap-2 min-w-0">
        <Avatar
          className="h-8 w-8 border-2 flex-shrink-0"
          style={{ borderColor: planUi.color }}
        >
          <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
          <AvatarFallback
            className="text-white text-xs font-bold"
            style={{ background: planUi.avatarGradient }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <span
          className="text-sm font-semibold truncate whitespace-nowrap"
          style={{ color: planUi.greetingColor }}
        >
          {displayName ? (salutation ? `${salutation}, ${displayName} 👋` : displayName) : "Mon compte"}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
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
                    <div
                      key={n.id}
                      className={cn(
                        "px-4 py-3 border-b border-onyx-border/10 last:border-0",
                        !n.read && "bg-gold/5"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold flex-shrink-0" />}
                        <div className={cn("flex-1 min-w-0", n.read && "pl-3.5")}>
                          <p className="text-[12px] font-semibold text-foreground">{n.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                          {n.type === 'trip_confirmation' && n.data?.trip_id && !n.read && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => void confirmTrip(n.id, n.data!.trip_id!, 'completed')}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-500/15 border border-green-500/30 text-[11px] text-green-400 hover:bg-green-500/25 transition-colors"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Réalisé
                              </button>
                              <button
                                onClick={() => void confirmTrip(n.id, n.data!.trip_id!, 'missed')}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-[11px] text-red-400 hover:bg-red-500/25 transition-colors"
                              >
                                <XCircle className="h-3 w-3" />
                                Non réalisé
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Badge unifié plan + valeur */}
        {isTrial ? (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
            style={{ background: '#241D0A', borderColor: '#EAB3084D' }}
          >
            <Crown className="h-3.5 w-3.5 text-[#EAB308]" strokeWidth={1.5} />
            <span className="text-[11px] font-bold text-[#EAB308]">Essai</span>
            <span className="h-3 w-px" style={{ background: '#EAB3084D' }} />
            <span className="text-[11px] font-bold text-[#EAB308]">{trialDaysLeft}j</span>
          </div>
        ) : plan === 'SOLO' ? (
          <button
            onClick={() => setWalletOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border active:scale-95 transition-transform"
            style={{ background: planUi.badgeBg, borderColor: planUi.borderColor }}
          >
            <PlanIcon className="h-3.5 w-3.5" style={{ color: planUi.color }} strokeWidth={1.5} />
            <span className="text-[11px] font-bold" style={{ color: planUi.color }}>{planUi.label}</span>
            <span className="h-3 w-px" style={{ background: planUi.borderColor }} />
            <Coins className="h-3 w-3" style={{ color: planUi.color }} strokeWidth={1.5} />
            <span className="text-[11px] font-bold" style={{ color: planUi.color }}>{badgeValue}</span>
          </button>
        ) : (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
            style={{ background: planUi.badgeBg, borderColor: planUi.borderColor }}
          >
            <PlanIcon className="h-3.5 w-3.5" style={{ color: planUi.color }} strokeWidth={1.5} />
            <span className="text-[11px] font-bold" style={{ color: planUi.color }}>{planUi.label}</span>
            <span className="h-3 w-px" style={{ background: planUi.borderColor }} />
            <span className="text-[11px] font-bold" style={{ color: planUi.color }}>∞</span>
          </div>
        )}
      </div>

      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
    </header>
  )
}

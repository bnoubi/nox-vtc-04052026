"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ShieldCheck, Loader2, CheckCircle2, Crown, Coins } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"
import { usePromo } from "@/lib/hooks/usePromo"
import type { Plan } from "./data"

type PayState = "idle" | "loading"

const PLAN_DETAILS = {
  DUO: {
    name: "Pro",
    subtitle: "L'offre Binôme",
    price: "4,99",
    bulletPoints: [
      { text: "Signature Entreprise incluse", highlight: true },
      { text: "Max 2 Chauffeurs / Max 2 Véhicules", highlight: false },
      { text: "Documents illimités", highlight: false },
      { text: "Support prioritaire", highlight: false },
    ],
  },
  TEAM: {
    name: "Premium",
    subtitle: "L'offre Flotte",
    price: "9,99",
    bulletPoints: [
      { text: "Signature Entreprise incluse", highlight: true },
      { text: "Max 10 Chauffeurs / Max 10 Véhicules", highlight: false },
      { text: "Documents illimités", highlight: false },
      { text: "Support prioritaire", highlight: false },
      { text: "Stats avancées", highlight: false },
      { text: "API & Intégrations", highlight: false },
    ],
  },
} as const

interface SubscriptionDrawerProps {
  open: boolean
  targetPlan: "DUO" | "TEAM" | null
  onClose: () => void
}

const ORIGINAL_PRICES: Record<"DUO" | "TEAM", number> = { DUO: 4.99, TEAM: 9.99 }

export function SubscriptionDrawer({ open, targetPlan, onClose }: SubscriptionDrawerProps) {
  const { userId, tokens } = useNox()
  const { promo } = usePromo()
  const [payState, setPayState] = useState<PayState>("idle")

  const planInfo = targetPlan ? PLAN_DETAILS[targetPlan] : null
  const originalPrice = targetPlan ? ORIGINAL_PRICES[targetPlan] : 0
  const promoPrice = promo.active ? (Math.floor(originalPrice * (1 - promo.percent / 100) * 100) / 100).toFixed(2).replace('.', ',') : null

  async function handlePay() {
    if (payState !== "idle" || !targetPlan || !userId) return

    setPayState("loading")
    try {
      const origin = window.location.origin
      const itemType = targetPlan === "DUO" ? "plan_duo" : "plan_team"
      const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const successUrl = `${origin}/payment/success?type=subscription&plan=${targetPlan}&valid_until=${validUntil}`
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType,
          userId,
          successUrl,
          cancelUrl:  `${origin}/`,
        }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur inconnue")
      window.location.href = data.url
    } catch {
      setPayState("idle")
    }
  }

  async function handlePayPal() {
    if (payState !== "idle" || !targetPlan || !userId) return

    setPayState("loading")
    try {
      const itemType = targetPlan === "DUO" ? "plan_duo" : "plan_team"
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, userId }),
      })
      const data = await res.json() as { approvalUrl?: string; error?: string }
      if (!res.ok || !data.approvalUrl) throw new Error(data.error ?? "Erreur inconnue")
      window.location.href = data.approvalUrl
    } catch {
      setPayState("idle")
    }
  }

  function handleClose() {
    if (payState === "loading") return
    setPayState("idle")
    onClose()
  }

  if (!planInfo) return null

  const isTeamPlan = targetPlan === "TEAM"

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] rounded-t-3xl bg-[#0E0E0E]/95 backdrop-blur-2xl border-t border-[#D4AF37]/25 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-4 shrink-0">
              <div>
                <h2 className="text-base font-bold tracking-wide text-[#D4AF37]">
                  ACTIVER L'OFFRE {planInfo.name}
                </h2>
                <p className="text-[11px] text-[#A1A1AA] mt-0.5">{planInfo.subtitle}</p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 flex items-center justify-center hover:bg-[#D4AF37]/20 transition-colors"
                aria-label="Fermer"
              >
                <X className="h-4 w-4 text-[#D4AF37]" strokeWidth={2.5} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-10">

              {/* Plan Summary Card */}
              <div className={cn(
                "p-5 rounded-2xl border mb-5",
                isTeamPlan
                  ? "bg-gradient-to-br from-[#D4AF37]/15 via-[#D4AF37]/5 to-transparent border-[#D4AF37]/40 shadow-[0_0_30px_rgba(212,175,55,0.1)]"
                  : "bg-[#D4AF37]/10 border-[#D4AF37]/30"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      isTeamPlan ? "bg-[#D4AF37]/20 border border-[#D4AF37]/40" : "bg-[#D4AF37]/15 border border-[#D4AF37]/25"
                    )}>
                      <Crown className={cn("h-6 w-6", isTeamPlan ? "text-[#D4AF37]" : "text-[#D4AF37]/80")} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className={cn(
                        "text-lg font-bold font-heading",
                        isTeamPlan ? "text-[#D4AF37]" : "text-[#D4AF37]/90"
                      )}>
                        {planInfo.name}
                      </p>
                      <p className="text-[10px] text-[#A1A1AA]">{planInfo.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {promo.active && (
                      <p className="text-[11px] text-[#A1A1AA] line-through">{planInfo.price}€</p>
                    )}
                    <div className="flex items-center gap-1.5 justify-end">
                      <p className="text-2xl font-bold text-[#D4AF37]">
                        {promo.active ? `${promoPrice}€` : `${planInfo.price}€`}
                      </p>
                      {promo.active && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                          -{promo.percent}%
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#A1A1AA]">
                      {promo.active ? "Premier mois — puis " + planInfo.price + "€/mois" : "/mois"}
                    </p>
                  </div>
                </div>

                {/* Bullet Points List */}
                <div className="space-y-3">
                  {planInfo.bulletPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        point.highlight
                          ? "bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.4)]"
                          : "bg-[#D4AF37]/15 border border-[#D4AF37]/30"
                      )}>
                        <CheckCircle2 className={cn(
                          "h-3 w-3",
                          point.highlight ? "text-[#0E0E0E]" : "text-[#D4AF37]"
                        )} strokeWidth={2.5} />
                      </div>
                      <span className={cn(
                        "text-[13px] leading-relaxed",
                        point.highlight
                          ? "font-semibold text-[#D4AF37]"
                          : "text-[#F5F5F5]"
                      )}>
                        {point.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Token Reassurance Note */}
              {tokens > 0 && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#1A1A1A]/60 border border-[#D4AF37]/15 mb-5">
                  <Coins className="h-4 w-4 text-[#D4AF37]/60 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                    Vos <span className="text-[#D4AF37] font-semibold">{tokens} jetons</span> actuels seront mis en réserve et conservés précieusement.
                  </p>
                </div>
              )}

              {/* Separator */}
              <div className="h-px bg-[#D4AF37]/10 mb-5" />

              {/* Payment Methods */}
              <p className="text-[10px] uppercase tracking-widest text-[#A1A1AA] font-semibold mb-3">Moyens de paiement</p>

              {/* PayPal Button */}
              <button
                onClick={handlePayPal}
                disabled={payState !== "idle"}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FFC439] hover:bg-[#F0B72A] active:scale-[0.98] transition-all mb-3 disabled:opacity-60"
              >
                {payState === "loading" ? (
                  <Loader2 className="h-5 w-5 text-[#253B80] animate-spin" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-5 w-auto" fill="none">
                      <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944 3.384a.774.774 0 01.763-.648h6.553c2.174 0 3.692.46 4.51 1.369.383.426.625.893.739 1.426.121.563.122 1.24 0 2.073l-.014.08v.628l.455.258a3.04 3.04 0 01.917.788c.36.46.593 1.02.69 1.665.1.662.067 1.43-.096 2.283-.19.979-.504 1.832-.935 2.535-.398.649-.906 1.19-1.509 1.604a5.635 5.635 0 01-1.973.871c-.744.186-1.58.28-2.49.28h-.591c-.423 0-.834.152-1.155.427-.322.28-.534.667-.594 1.088l-.045.259-.748 4.74-.033.188c-.014.084-.037.125-.073.152a.19.19 0 01-.119.042z" fill="#253B80"/>
                      <path d="M19.072 8.367c-.014.09-.03.183-.048.278-.62 3.18-2.742 4.278-5.45 4.278h-1.38a.67.67 0 00-.662.568l-.706 4.478-.2 1.27a.353.353 0 00.348.406h2.449c.29 0 .536-.211.581-.498l.024-.124.46-2.92.03-.16a.586.586 0 01.58-.498h.365c2.364 0 4.215-.96 4.755-3.737.226-1.16.109-2.13-.488-2.81a2.33 2.33 0 00-.658-.531z" fill="#179BD7"/>
                      <path d="M18.172 8.002a5.256 5.256 0 00-.652-.145 8.255 8.255 0 00-1.313-.096h-3.978a.584.584 0 00-.58.498l-.847 5.367-.025.156a.67.67 0 01.662-.568h1.38c2.708 0 4.83-1.099 5.45-4.278.019-.094.034-.186.048-.278a3.443 3.443 0 00-1.045-.451 4.778 4.778 0 00-.1-.005z" fill="#222D65"/>
                    </svg>
                    <span className="text-sm font-bold text-[#253B80]">Payer avec PayPal</span>
                  </>
                )}
              </button>

              {/* Stripe / Cards */}
              <button
                onClick={handlePay}
                disabled={payState !== "idle"}
                className="w-full py-3 rounded-xl bg-[#1A1A1A] border border-[#D4AF37]/25 hover:border-[#D4AF37]/50 active:scale-[0.98] transition-all mb-4 disabled:opacity-60"
              >
                {payState === "loading" ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-[#D4AF37] animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-3 mb-1.5">
                      {/* Visa */}
                      <svg viewBox="0 0 48 32" className="h-6 w-auto">
                        <rect width="48" height="32" rx="4" fill="#fff"/>
                        <path d="M19.5 21h-3l1.9-11.5h3L19.5 21zm12.8-11.2c-.6-.2-1.5-.5-2.7-.5-3 0-5.1 1.6-5.1 3.8 0 1.7 1.5 2.6 2.6 3.1 1.1.6 1.5.9 1.5 1.4 0 .8-.9 1.1-1.7 1.1-1.1 0-1.8-.2-2.7-.6l-.4-.2-.4 2.5c.7.3 1.9.6 3.2.6 3.2 0 5.3-1.6 5.3-3.9 0-1.3-.8-2.3-2.5-3.1-1-.5-1.7-.9-1.7-1.4 0-.5.5-1 1.7-1 1 0 1.7.2 2.2.4l.3.1.4-2.3zM37.8 9.5h-2.3c-.7 0-1.3.2-1.6 1L29.8 21h3.2l.6-1.8h3.9l.4 1.8H41l-2.6-11.5h-.6zM34.3 17l1.2-3.3.2-.6.3 1.5.7 3.3h-2.4v.1zM16.3 9.5L13.4 17l-.3-1.6c-.5-1.8-2.2-3.8-4.1-4.8l2.7 10.3h3.2l4.8-11.4h-3.4z" fill="#1A1F71"/>
                        <path d="M10.4 9.5H5.1l-.1.3c3.8 1 6.3 3.3 7.3 6.1l-1.1-5.4c-.2-.8-.7-1-1.4-1h.6z" fill="#F9A533"/>
                      </svg>
                      {/* Mastercard */}
                      <svg viewBox="0 0 48 32" className="h-6 w-auto">
                        <rect width="48" height="32" rx="4" fill="#fff"/>
                        <circle cx="19" cy="16" r="8" fill="#EB001B"/>
                        <circle cx="29" cy="16" r="8" fill="#F79E1B"/>
                        <path d="M24 10.3a8 8 0 010 11.4 8 8 0 000-11.4z" fill="#FF5F00"/>
                      </svg>
                      {/* Amex */}
                      <svg viewBox="0 0 48 32" className="h-6 w-auto">
                        <rect width="48" height="32" rx="4" fill="#016FD0"/>
                        <text x="24" y="18.5" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="sans-serif">AMEX</text>
                      </svg>
                      {/* Apple Pay */}
                      <div className="flex items-center gap-0.5 bg-black rounded px-1.5 py-0.5 border border-white/20">
                        <svg viewBox="0 0 17 20" className="h-3.5 w-auto" fill="#fff">
                          <path d="M13.1 10.4c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7C4.9 6.7 3.5 7.6 2.7 9c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.2-.9-2.2-3.6zM11 5.1c.7-.8 1.1-2 1-3.1-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.9-1 3 1 .1 2.1-.5 2.8-1.4z"/>
                        </svg>
                        <span className="text-[8px] font-semibold text-white">Pay</span>
                      </div>
                      {/* Google Pay */}
                      <div className="flex items-center gap-0.5 bg-white rounded px-1.5 py-0.5 border border-black/10">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-auto" fill="none">
                          <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z" fill="#4285F4"/>
                        </svg>
                        <span className="text-[8px] font-semibold text-[#3C4043]">Pay</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#F5F5F5]">Payer par carte bancaire</span>
                  </>
                )}
              </button>

              {/* SSL Badge */}
              <div className="flex items-center justify-center gap-2 py-2">
                <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]/60" strokeWidth={1.5} />
                <span className="text-[10px] text-[#A1A1AA]/70">Transactions sécurisées par cryptage SSL</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

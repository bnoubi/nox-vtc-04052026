"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Coins, ShieldCheck, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"
import { getTokenPacksAction, type TokenPackDB } from "@/lib/actions/token-packs"

type PayState = "idle" | "loading"

export function WalletDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId, tokens } = useNox()
  const [packs, setPacks] = useState<TokenPackDB[]>([])
  const [packsLoading, setPacksLoading] = useState(true)
  const [selected, setSelected] = useState<string>("")
  const [payState, setPayState] = useState<PayState>("idle")
  const [paypalState, setPaypalState] = useState<PayState>("idle")

  useEffect(() => {
    getTokenPacksAction().then(data => {
      setPacks(data)
      if (data.length > 0) setSelected(data[1]?.id ?? data[0].id)
      setPacksLoading(false)
    })
  }, [])

  function getPackBadge(pack: TokenPackDB): string | null {
    if (pack.quantite_jetons >= 50) return 'Meilleure offre'
    if (pack.quantite_jetons >= 30) return 'Le plus populaire'
    return null
  }

  function getPackUnit(pack: TokenPackDB): string {
    return (pack.prix_eur / pack.quantite_jetons).toFixed(2).replace('.', ',')
  }

  async function handlePay() {
    if (payState !== "idle" || !userId) return
    const pack = packs.find((p) => p.id === selected)
    if (!pack) return

    setPayState("loading")
    try {
      const origin = window.location.origin
      const before = tokens
      const after = tokens + pack.quantite_jetons
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: pack.id,
          userId,
          successUrl: `${origin}/payment/success?type=token_pack&amount=${pack.quantite_jetons}&before=${before}&after=${after}`,
          cancelUrl: `${origin}/`,
        }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur inconnue")
      window.location.href = data.url
    } catch {
      setPayState("idle")
    }
  }

  async function handlePayPayPal() {
    if (paypalState !== "idle" || !userId) return
    const pack = packs.find((p) => p.id === selected)
    if (!pack) return

    setPaypalState("loading")
    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType: pack.id, userId }),
      })
      const data = await res.json() as { approvalUrl?: string; error?: string }
      if (!res.ok || !data.approvalUrl) throw new Error(data.error ?? "Erreur inconnue")
      window.location.href = data.approvalUrl
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue"
      toast.error(`PayPal - ${msg}`)
      setPaypalState("idle")
    }
  }

  function handleClose() {
    if (payState === "loading" || paypalState === "loading") return
    setPayState("idle")
    setPaypalState("idle")
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] rounded-t-3xl bg-[#0E0E0E]/95 backdrop-blur-2xl border-t border-[#D4AF37]/25 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 shrink-0">
              <div>
                <h2 className="text-base font-bold tracking-wide text-[#D4AF37]">RECHARGER MON WALLET</h2>
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
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-28">

              {/* Pack Cards */}
              <div className="space-y-3 mb-6">
                {packsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 text-[#D4AF37] animate-spin" />
                  </div>
                ) : packs.map((pack) => {
                  const isSelected = selected === pack.id
                  const badge = getPackBadge(pack)
                  const hasBadge = !!badge
                  const unit = getPackUnit(pack)

                  return (
                    <button
                      key={pack.id}
                      onClick={() => setSelected(pack.id)}
                      disabled={payState !== "idle" || paypalState !== "idle"}
                      className={cn(
                        "relative w-full flex items-center gap-3.5 p-4 rounded-2xl border text-left transition-all duration-200 active:scale-[0.98]",
                        isSelected
                          ? "bg-[#D4AF37]/10 border-[#D4AF37]/50 shadow-[0_0_20px_rgba(212,175,55,0.08)]"
                          : "bg-[#1A1A1A]/60 border-[#D4AF37]/15 hover:border-[#D4AF37]/30"
                      )}
                    >
                      {/* Badge */}
                      {hasBadge && (
                        <span className="absolute -top-2.5 left-4 px-2 py-0.5 text-[7px] font-bold uppercase tracking-wider rounded-full bg-[#D4AF37] text-[#0E0E0E] shadow-[0_0_12px_rgba(212,175,55,0.3)]">
                          {badge}
                        </span>
                      )}

                      {/* Token icon */}
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                        isSelected
                          ? "bg-[#D4AF37]/20 border-[#D4AF37]/40"
                          : "bg-[#D4AF37]/8 border-[#D4AF37]/15"
                      )}>
                        <Coins className={cn(
                          "h-5 w-5",
                          isSelected ? "text-[#D4AF37]" : "text-[#D4AF37]/60"
                        )} strokeWidth={1.5} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-bold",
                          isSelected ? "text-[#D4AF37]" : "text-[#F5F5F5]"
                        )}>
                          {pack.nom}
                        </p>
                        <p className="text-[11px] text-[#A1A1AA] mt-0.5">{pack.quantite_jetons} jetons</p>
                        <p className="text-[10px] text-[#D4AF37]/80 font-semibold mt-0.5">
                          soit {unit}&#8364;/doc
                        </p>
                      </div>

                      {/* Price */}
                      <div className="text-right shrink-0">
                        <p className={cn(
                          "text-lg font-bold",
                          isSelected ? "text-[#D4AF37]" : "text-[#F5F5F5]"
                        )}>{pack.prix_eur}&#8364;</p>
                      </div>

                      {/* Selection indicator */}
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                        isSelected ? "border-[#D4AF37] bg-[#D4AF37]" : "border-[#555]"
                      )}>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-[#1A1A1A]" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Separator */}
              <div className="h-px bg-[#D4AF37]/10 mb-5" />

              {/* Payment Methods */}
              <p className="text-[10px] uppercase tracking-widest text-[#A1A1AA] font-semibold mb-3">Moyens de paiement</p>

              {/* PayPal Button */}
              <button
                onClick={handlePayPayPal}
                disabled={paypalState !== "idle"}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FFC439] hover:bg-[#F0B72A] active:scale-[0.98] transition-all mb-3 disabled:opacity-60"
              >
                {paypalState === "loading" ? (
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
                className="w-full py-4 px-4 rounded-xl bg-[#1A1A1A] border border-[#D4AF37]/25 hover:border-[#D4AF37]/50 active:scale-[0.98] transition-all mb-4 disabled:opacity-60"
              >
                {payState === "loading" ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-[#D4AF37] animate-spin" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2.5">
                    <span className="text-sm font-bold text-[#F5F5F5]">Payer par carte bancaire</span>
                    <div className="flex items-center justify-center gap-5 h-8">
                      <svg viewBox="0 0 80 24" className="h-5 w-auto" aria-label="Visa">
                        <text x="40" y="19" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontSize="20" fontWeight="900" fontStyle="italic" fill="#E5E5E5" letterSpacing="-0.5">VISA</text>
                      </svg>
                      <svg viewBox="0 0 40 24" className="h-6 w-auto" aria-label="Mastercard">
                        <circle cx="16" cy="12" r="8" fill="none" stroke="#E5E5E5" strokeWidth="1.4"/>
                        <circle cx="24" cy="12" r="8" fill="none" stroke="#E5E5E5" strokeWidth="1.4"/>
                      </svg>
                      <svg viewBox="0 0 64 24" className="h-5 w-auto" aria-label="American Express">
                        <rect x="0.75" y="0.75" width="62.5" height="22.5" rx="3" fill="none" stroke="#E5E5E5" strokeWidth="1.2"/>
                        <text x="32" y="16.5" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontSize="10" fontWeight="900" fill="#E5E5E5" letterSpacing="0.5">AMEX</text>
                      </svg>
                      <svg viewBox="0 0 72 24" className="h-5 w-auto" aria-label="Apple Pay">
                        <g fill="#E5E5E5">
                          <path d="M14 7.5c-.6.7-1.5 1.3-2.4 1.2-.1-.9.4-1.9 1-2.5.6-.7 1.5-1.2 2.3-1.3.1.9-.3 1.9-.9 2.6zm.9.9c-1.3-.1-2.4.7-3.1.7-.7 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.4 2.5-.4 6.2 1.1 8.2.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7s1.6.7 2.7.7c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.1 0-2 1.6-3 1.7-3-1-1.4-2.4-1.5-3.1-1.6z"/>
                          <text x="24" y="17" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="500">Pay</text>
                        </g>
                      </svg>
                      <svg viewBox="0 0 72 24" className="h-5 w-auto" aria-label="Google Pay">
                        <g fill="#E5E5E5">
                          <path d="M11.5 11v2.6h3.8c-.1.9-.5 1.7-1.2 2.2-.6.5-1.5.8-2.6.8-2 0-3.8-1.4-4.4-3.3-.2-.6-.2-1.2 0-1.8.6-1.9 2.4-3.3 4.4-3.3 1.1 0 2.1.4 2.9 1.1l2-2c-1.3-1.2-3-1.9-4.9-1.9-2.7 0-5.1 1.6-6.2 3.9-.9 1.9-.9 4.1 0 6 1.1 2.3 3.5 3.9 6.2 3.9 1.9 0 3.5-.6 4.6-1.7 1.3-1.2 2-3 2-5.1 0-.5-.1-1-.1-1.4h-6.5z"/>
                          <text x="24" y="17" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="500">Pay</text>
                        </g>
                      </svg>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mt-0.5">
                      <Lock className="h-3 w-3 text-[#A1A1AA]" strokeWidth={2} />
                      <span className="text-xs text-[#A1A1AA]">Paiement securise</span>
                    </div>
                  </div>
                )}
              </button>

              {/* SSL Badge */}
              <div className="flex items-center justify-center gap-2 py-2">
                <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]/60" strokeWidth={1.5} />
                <span className="text-[10px] text-[#A1A1AA]/70">Transactions securisees par cryptage SSL</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Crown, Coins, Sparkles } from "lucide-react"
import { usePromoModal } from "@/lib/hooks/usePromoModal"
import { useNox } from "./nox-context"
import { SubscriptionDrawer } from "./subscription-drawer"
import { WalletDrawer } from "./wallet-drawer"

export function PromoModal() {
  const { shouldShow, scenario, promo, dismiss } = usePromoModal()
  const { plan, tokens } = useNox()
  const [subDrawerOpen,    setSubDrawerOpen]    = useState(false)
  const [walletDrawerOpen, setWalletDrawerOpen] = useState(false)

  const targetPlan = plan === 'SOLO' ? 'DUO' : 'TEAM'

  function handleCTA() {
    dismiss()
    if (scenario === 'upgrade') {
      setSubDrawerOpen(true)
    } else {
      setWalletDrawerOpen(true)
    }
  }

  return (
    <>
      <AnimatePresence>
        {shouldShow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={dismiss}
            />

            {/* Bottom-sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#0E0E0E]/95 backdrop-blur-2xl border-t border-[#D4AF37]/25 shadow-[0_-10px_40px_rgba(0,0,0,0.6)]"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                    {scenario === 'upgrade'
                      ? <Crown className="h-5 w-5 text-[#D4AF37]" strokeWidth={1.5} />
                      : <Coins className="h-5 w-5 text-[#D4AF37]" strokeWidth={1.5} />
                    }
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#A1A1AA] font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-[#D4AF37]" />
                      Offre limitée
                      {scenario === 'upgrade' && promo.percent > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#D4AF37] font-bold text-[10px]">
                          -{promo.percent}%
                        </span>
                      )}
                    </p>
                    <h2 className="text-base font-bold text-[#D4AF37] mt-0.5">
                      {scenario === 'upgrade'
                        ? plan === 'SOLO' ? 'Passez en Pro' : 'Passez en Premium'
                        : 'Rechargez vos jetons'
                      }
                    </h2>
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="w-8 h-8 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 flex items-center justify-center hover:bg-[#D4AF37]/20 transition-colors shrink-0"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4 text-[#D4AF37]" strokeWidth={2.5} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 pb-8 space-y-4">
                {scenario === 'upgrade' ? (
                  <>
                    <p className="text-[13px] text-[#A1A1AA] leading-relaxed">
                      {plan === 'SOLO'
                        ? "Gérez 2 chauffeurs, 2 véhicules et profitez de documents illimités avec l'offre Pro."
                        : "Gérez jusqu'à 10 chauffeurs, accédez aux stats avancées et à l'API avec l'offre Premium."
                      }
                      {promo.percent > 0 && (
                        <span className="text-[#D4AF37] font-semibold">
                          {" "}Profitez de {promo.percent}% de réduction ce mois-ci.
                        </span>
                      )}
                    </p>
                    <button
                      onClick={handleCTA}
                      className="w-full py-3.5 rounded-2xl bg-[#D4AF37] text-[#0E0E0E] text-[14px] font-bold tracking-wide hover:bg-[#C4A030] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <Crown className="h-4 w-4" strokeWidth={2} />
                      Découvrir l&apos;offre {plan === 'SOLO' ? 'Pro' : 'Premium'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-[#A1A1AA] leading-relaxed">
                      Votre solde est bas ({tokens} {tokens === 1 ? 'jeton' : 'jetons'}). Chaque jeton vous permet de générer des bons de commande et des factures. Rechargez maintenant pour continuer sans interruption.
                    </p>
                    <button
                      onClick={handleCTA}
                      className="w-full py-3.5 rounded-2xl bg-[#D4AF37] text-[#0E0E0E] text-[14px] font-bold tracking-wide hover:bg-[#C4A030] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <Coins className="h-4 w-4" strokeWidth={2} />
                      Recharger mes jetons
                    </button>
                  </>
                )}

                <button
                  onClick={dismiss}
                  className="w-full py-2 text-[12px] text-[#555] hover:text-[#888] transition-colors"
                >
                  Me le rappeler plus tard
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SubscriptionDrawer
        open={subDrawerOpen}
        targetPlan={targetPlan}
        onClose={() => setSubDrawerOpen(false)}
        mode="discover"
      />
      <WalletDrawer
        open={walletDrawerOpen}
        onClose={() => setWalletDrawerOpen(false)}
      />
    </>
  )
}

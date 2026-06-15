"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Shield, Crown } from "lucide-react"
import { getPlan } from "@/lib/config/prices"

function fmtPrice(n: number) {
  return n.toFixed(2).replace('.', ',') + '€/mois'
}

const PRO_PRICE_LABEL = fmtPrice(getPlan('plan_duo')?.price ?? 4.99)
const PREMIUM_PRICE_LABEL = fmtPrice(getPlan('plan_team')?.price ?? 9.99)

interface LimitAlertModalProps {
  open: boolean
  onClose: () => void
  /** "chauffeur" | "véhicule" */
  resourceLabel: string
  onManageOffer: () => void
  customMessage?: string
  customTitle?: string
  onUpgradePro?: () => void
  onUpgradePremium?: () => void
}

export function LimitAlertModal({ open, onClose, resourceLabel, onManageOffer, customMessage, customTitle, onUpgradePro, onUpgradePremium }: LimitAlertModalProps) {
  const hasDualButtons = onUpgradePro && onUpgradePremium
  const displayMessage = customMessage?.replace(/^🔒\s*/, "") ?? `Vous avez atteint la limite d'ajout de ${resourceLabel} pour votre offre actuelle. Passez à une offre supérieure pour continuer.`

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100]"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

          {/* Alert box -- positioned bottom center for thumb accessibility */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="absolute bottom-0 left-0 right-0 mx-auto mb-10 w-[calc(100%-2rem)] max-w-md rounded-2xl bg-[#0A0A0A] border border-[#D4AF37]/50 shadow-[0_8px_40px_rgba(0,0,0,0.9),0_0_30px_rgba(212,175,55,0.2)] p-5 pb-safe"
          >
            {/* Close X - top right */}
            <button
              onClick={onClose}
              className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex items-center justify-center hover:bg-[#D4AF37]/25 active:scale-[0.95] transition-all"
              aria-label="Fermer"
            >
              <X className="h-4 w-4 text-[#D4AF37]" strokeWidth={2.5} />
            </button>

            {/* Shield Icon — masqué quand customTitle contient déjà un emoji */}
            {!customTitle && (
              <div className="flex justify-center mb-4 mt-1">
                <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#D4AF37]/25 to-[#D4AF37]/5 border border-[#D4AF37]/40 flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.25)]">
                  <Shield className="h-5 w-5 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
              </div>
            )}

            {/* Title */}
            <p className="text-sm font-bold text-[#D4AF37] text-center tracking-wider uppercase mb-2 pr-10">
              {customTitle ?? "Limite Atteinte"}
            </p>

            {/* Message */}
            <p className="text-[12px] text-[#A1A1AA] text-center leading-relaxed px-2">
              {displayMessage}
            </p>

            {/* CTA Buttons */}
            {hasDualButtons ? (
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { onClose(); onUpgradePro() }}
                  className="flex-1 py-2.5 min-h-[56px] rounded-xl bg-[#2A2A2A] border border-[#D4AF37] flex flex-col items-center justify-center gap-0.5 hover:bg-[#333] active:scale-[0.98] transition-all"
                >
                  <Crown className="h-3.5 w-3.5 text-[#D4AF37]" strokeWidth={2} />
                  <span className="text-xs font-bold text-[#D4AF37] tracking-wider uppercase">Pro</span>
                  <span className="text-[10px] text-[#D4AF37]/70">{PRO_PRICE_LABEL}</span>
                </button>
                <button
                  onClick={() => { onClose(); onUpgradePremium() }}
                  className="flex-1 py-2.5 min-h-[56px] rounded-xl bg-[#D4AF37] flex flex-col items-center justify-center gap-0.5 hover:bg-[#E5C44D] active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(212,175,55,0.35)]"
                >
                  <Crown className="h-3.5 w-3.5 text-[#1A1A1A]" strokeWidth={2} />
                  <span className="text-xs font-bold text-[#1A1A1A] tracking-wider uppercase">Premium</span>
                  <span className="text-[10px] text-[#1A1A1A]/70">{PREMIUM_PRICE_LABEL}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  onClose()
                  onManageOffer()
                }}
                className="w-full mt-5 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8962E] text-[#0A0A0A] text-xs font-bold tracking-[0.15em] uppercase hover:from-[#E5C44D] hover:to-[#D4AF37] active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(212,175,55,0.35)]"
              >
                Mon Abonnement
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

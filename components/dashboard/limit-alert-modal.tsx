"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Crown } from "lucide-react"

interface LimitAlertModalProps {
  open: boolean
  onClose: () => void
  /** "chauffeur" | "véhicule" */
  resourceLabel: string
  onManageOffer: () => void
}

export function LimitAlertModal({ open, onClose, resourceLabel, onManageOffer }: LimitAlertModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60]"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

          {/* Alert box -- positioned at top for visibility above nav bar */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-[#0E0E0E] border border-[#D4AF37]/40 shadow-[0_8px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(212,175,55,0.15)] p-6"
          >
            {/* Close X */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 min-h-[44px] min-w-[44px] -mt-1 -mr-1 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 flex items-center justify-center hover:bg-[#D4AF37]/20 active:scale-[0.95] transition-all"
              aria-label="Fermer"
            >
              <X className="h-4 w-4 text-[#D4AF37]" strokeWidth={2.5} />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-b from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/30 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                <Crown className="h-6 w-6 text-[#D4AF37]" strokeWidth={1.5} />
              </div>
            </div>

            {/* Message */}
            <p className="text-base font-semibold text-[#F5F5F5] text-center leading-snug">
              Limite atteinte
            </p>
            <p className="text-[13px] text-[#A1A1AA] text-center mt-2 leading-relaxed">
              {`Vous avez atteint la limite d'ajout de ${resourceLabel} pour votre offre actuelle. Passez à une offre supérieure pour débloquer plus de places.`}
            </p>

            {/* CTA */}
            <button
              onClick={() => {
                onClose()
                onManageOffer()
              }}
              className="w-full mt-5 py-3.5 min-h-[48px] rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8962E] text-[#0E0E0E] text-sm font-bold tracking-wider uppercase hover:from-[#E5C44D] hover:to-[#D4AF37] active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(212,175,55,0.3)]"
            >
              Mon Abonnement
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

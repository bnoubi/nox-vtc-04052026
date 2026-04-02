"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Shield } from "lucide-react"

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

            {/* Shield Icon */}
            <div className="flex justify-center mb-4 mt-1">
              <div className="w-12 h-12 rounded-full bg-gradient-to-b from-[#D4AF37]/25 to-[#D4AF37]/5 border border-[#D4AF37]/40 flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.25)]">
                <Shield className="h-5 w-5 text-[#D4AF37]" strokeWidth={1.5} />
              </div>
            </div>

            {/* Title */}
            <p className="text-sm font-bold text-[#D4AF37] text-center tracking-wider uppercase mb-2">
              Limite Atteinte
            </p>

            {/* Message */}
            <p className="text-[12px] text-[#A1A1AA] text-center leading-relaxed px-2">
              {`Vous avez atteint la limite d'ajout de ${resourceLabel} pour votre offre actuelle. Passez à une offre supérieure pour continuer.`}
            </p>

            {/* CTA Button */}
            <button
              onClick={() => {
                onClose()
                onManageOffer()
              }}
              className="w-full mt-5 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8962E] text-[#0A0A0A] text-xs font-bold tracking-[0.15em] uppercase hover:from-[#E5C44D] hover:to-[#D4AF37] active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(212,175,55,0.35)]"
            >
              Mon Abonnement
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

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
          className="fixed inset-0 z-50"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          {/* Alert box -- fixed center */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-3rem)] max-w-xs rounded-2xl bg-[#141414]/95 backdrop-blur-xl border border-[#D4AF37]/30 shadow-2xl shadow-black/60 p-5"
          >
            {/* Close X */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 flex items-center justify-center hover:bg-[#D4AF37]/20 transition-colors"
              aria-label="Fermer"
            >
              <X className="h-3.5 w-3.5 text-[#D4AF37]" strokeWidth={2.5} />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-3">
              <div className="w-11 h-11 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center">
                <Crown className="h-5 w-5 text-[#D4AF37]" strokeWidth={1.5} />
              </div>
            </div>

            {/* Message */}
            <p className="text-sm font-semibold text-[#F5F5F5] text-center leading-snug">
              {`Limite d\u2019ajout de ${resourceLabel} atteinte.`}
            </p>
            <p className="text-xs text-[#A1A1AA] text-center mt-1">
              Passez à une offre supérieure pour continuer.
            </p>

            {/* CTA */}
            <button
              onClick={() => {
                onClose()
                onManageOffer()
              }}
              className="w-full mt-4 py-2.5 rounded-xl bg-[#D4AF37] text-[#1A1A1A] text-xs font-bold tracking-wide uppercase hover:bg-[#E5C44D] active:scale-[0.97] transition-all"
            >
              Gérer mon offre
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Coins, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"

interface TokenCostModalProps {
  open: boolean
  onClose: () => void
  documentType: "facture" | "bc"
  documentNumber: string
  tokensRemaining: number
}

export function TokenCostModal({ open, onClose, documentType, documentNumber, tokensRemaining }: TokenCostModalProps) {
  const label = documentType === "bc" ? "Bon de réservation" : "Facture"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl bg-onyx-card border-t border-onyx-border/50 px-6 pb-10 pt-5"
          >
            <div className="w-10 h-1 bg-onyx-border/50 rounded-full mx-auto mb-6" />

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center">
                <Coins className="h-8 w-8 text-gold" strokeWidth={1.5} />
              </div>

              <div>
                <p className="text-lg font-bold text-foreground">1 jeton utilisé</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {label}{" "}
                  <span className="text-foreground font-medium">{documentNumber}</span>{" "}
                  généré avec succès
                </p>
              </div>

              <div className="w-full rounded-xl bg-secondary/40 border border-onyx-border/30 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Solde restant</span>
                <span className={cn(
                  "text-xl font-bold tabular-nums",
                  tokensRemaining === 0 ? "text-red-400" : tokensRemaining <= 2 ? "text-orange-400" : "text-gold"
                )}>
                  {tokensRemaining}
                  <span className="text-xs font-medium ml-1 opacity-70">jetons</span>
                </span>
              </div>

              {tokensRemaining > 0 && tokensRemaining <= 2 && (
                <p className="text-[11px] text-orange-400 font-medium -mt-1">
                  Solde faible — pensez à recharger
                </p>
              )}
              {tokensRemaining === 0 && (
                <p className="text-[11px] text-red-400 font-medium -mt-1">
                  Solde épuisé — rechargez pour continuer
                </p>
              )}

              <div className="mx-5 mb-4 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gold/5 border border-gold/20">
                <Receipt className="h-4 w-4 text-gold shrink-0" strokeWidth={1.5} />
                <p className="text-[12px] text-muted-foreground leading-snug">
                  Document disponible dans <span className="text-gold font-medium">Réservations & Factures</span>
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/10 to-[#D4AF37]/20 border border-gold/40 text-sm font-bold text-gold hover:border-gold/60 active:scale-[0.98] transition-all mt-1"
              >
                Compris !
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePlan, type Plan } from "./plan-context"
import { GoldConfetti } from "./gold-confetti"

const PLANS = [
  {
    id: "SOLO" as Plan,
    name: "SOLO",
    subtitle: "L\u2019offre Ind\u00e9pendant",
    price: "Gratuit",
    capacity: "Max 1 Chauffeur / Max 1 V\u00e9hicule",
    features: ["Signature Entreprise incluse", "Paiement \u00e0 l\u2019usage (jetons)"],
  },
  {
    id: "DUO" as Plan,
    name: "DUO",
    subtitle: "L\u2019offre Bin\u00f4me",
    price: "4,99\u20ac",
    priceSuffix: "/mois",
    capacity: "Max 2 Chauffeurs / Max 2 V\u00e9hicules",
    features: ["Signature Entreprise incluse", "Documents ILLIMIT\u00c9S"],
  },
  {
    id: "TEAM" as Plan,
    name: "TEAM",
    subtitle: "L\u2019offre Flotte",
    price: "9,99\u20ac",
    priceSuffix: "/mois",
    capacity: "Max 10 Chauffeurs / Max 10 V\u00e9hicules",
    features: ["Signature Entreprise incluse", "Documents ILLIMIT\u00c9S", "API & Int\u00e9grations", "Statistiques avanc\u00e9es"],
  },
]

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
}

export function UpgradeModal({ open, onClose, title, subtitle }: UpgradeModalProps) {
  const { plan, upgrade } = usePlan()
  const [showConfetti, setShowConfetti] = useState(false)

  function handleChoose(target: Plan) {
    if (target === plan) return
    setShowConfetti(true)
    setTimeout(() => {
      upgrade(target)
      onClose()
    }, 350)
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
          <GoldConfetti trigger={showConfetti} />

          {/* Backdrop with blur */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

          {/* Modal - centered with fixed positioning */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] max-h-[90vh] rounded-3xl bg-onyx-card/95 backdrop-blur-xl border border-gold/25 shadow-[0_0_60px_rgba(212,175,55,0.08)] flex flex-col overflow-hidden"
          >
            {/* Gold close button */}
            <button
              onClick={onClose}
              className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center hover:bg-gold/20 active:scale-90 transition-all"
              aria-label="Fermer"
            >
              <X className="h-4 w-4 text-gold" strokeWidth={2.5} />
            </button>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Header */}
              <div className="px-5 pt-5 pb-3 text-center">
                <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center mx-auto mb-3">
                  <Crown className="h-5.5 w-5.5 text-gold" strokeWidth={1.5} />
                </div>
                <p className="text-base font-bold text-foreground tracking-tight">{title || "Choisissez votre offre"}</p>
                {subtitle && <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>}
              </div>

              {/* Plan Cards */}
              <div className="px-4 space-y-2.5 pb-[50px]">
                {PLANS.map((p) => {
                  const isCurrent = p.id === plan
                  const isTeam = p.id === "TEAM"
                  const isDuo = p.id === "DUO"
                  const isUpgrade = !isCurrent && (
                    (plan === "SOLO") ||
                    (plan === "DUO" && p.id === "TEAM")
                  )

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "rounded-2xl border p-4 transition-all",
                        isCurrent
                          ? "bg-gold/[0.06] border-gold/40"
                          : isTeam
                            ? "bg-gradient-to-br from-gold/[0.07] to-transparent border-gold/30"
                            : "bg-onyx-card/60 border-gold/15"
                      )}
                    >
                      {/* Title row */}
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className={cn(
                            "text-[13px] font-bold tracking-wide",
                            isTeam ? "gold-gradient-text" : isDuo ? "text-gold" : "text-foreground"
                          )}>
                            {p.name}
                          </h3>
                          {isCurrent && (
                            <span className="px-1.5 py-px text-[7px] font-bold rounded bg-gold/20 text-gold border border-gold/30 uppercase tracking-wider">Actif</span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            "text-[13px] font-bold",
                            isTeam || isDuo ? "text-gold" : "text-foreground"
                          )}>
                            {p.price}
                          </span>
                          {p.priceSuffix && (
                            <span className="text-[9px] text-muted-foreground">{p.priceSuffix}</span>
                          )}
                        </div>
                      </div>

                      {/* Subtitle */}
                      <p className="text-[9px] text-muted-foreground/70 italic mb-1.5">{p.subtitle}</p>

                      {/* Capacity - single compact line */}
                      <p className={cn(
                        "text-[9px] font-semibold mb-2",
                        isTeam ? "text-gold/70" : isDuo ? "text-gold/60" : "text-muted-foreground/80"
                      )}>
                        {p.capacity}
                      </p>

                      {/* Features */}
                      <div className="space-y-1">
                        {p.features.map((f) => (
                          <div key={f} className="flex items-center gap-1.5">
                            <Check className={cn(
                              "h-2.5 w-2.5 shrink-0",
                              isTeam ? "text-gold" : isDuo ? "text-gold/60" : "text-muted-foreground/50"
                            )} strokeWidth={2.5} />
                            <span className={cn(
                              "text-[10px]",
                              f.includes("ILLIMIT") ? "font-semibold text-gold" : "text-muted-foreground"
                            )}>
                              {f}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Action button - always visible for upgrades */}
                      {isUpgrade && (
                        <button
                          onClick={() => handleChoose(p.id)}
                          className={cn(
                            "w-full mt-3 py-2.5 rounded-xl text-[11px] font-bold active:scale-[0.97] transition-all",
                            isTeam
                              ? "bg-gold text-primary-foreground gold-glow hover:bg-gold-light"
                              : "bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25"
                          )}
                        >
                          Choisir cette offre
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

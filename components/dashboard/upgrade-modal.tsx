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
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            className="fixed z-50 w-[calc(100%-2rem)] max-w-[420px] max-h-[90vh] rounded-3xl bg-onyx-card border border-gold/20 shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center hover:bg-gold/20 active:scale-95 transition-all"
            >
              <X className="h-4 w-4 text-gold" strokeWidth={2} />
            </button>

            {/* Header */}
            <div className="shrink-0 px-5 pt-5 pb-3 text-center">
              <div className="w-11 h-11 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-2.5">
                <Crown className="h-5 w-5 text-gold" strokeWidth={1.5} />
              </div>
              <p className="text-base font-bold text-foreground">{title || "Choisissez votre offre"}</p>
              {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
            </div>

            {/* Scrollable cards */}
            <div className="flex-1 overflow-y-auto px-4 pb-5">
              <div className="space-y-2.5">
                {PLANS.map((p) => {
                  const isCurrent = p.id === plan
                  const isTeam = p.id === "TEAM"
                  const isDuo = p.id === "DUO"
                  const isUpgrade = !isCurrent && (
                    (plan === "SOLO") ||
                    (plan === "DUO" && p.id === "TEAM")
                  )
                  const isDowngrade = !isCurrent && !isUpgrade

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "rounded-2xl border p-4 transition-all",
                        isCurrent
                          ? isTeam
                            ? "bg-gradient-to-br from-gold/12 via-gold/5 to-transparent border-gold/40"
                            : isDuo
                              ? "bg-gold/8 border-gold/30"
                              : "bg-onyx-card border-gold/25"
                          : isTeam
                            ? "bg-gradient-to-br from-gold/8 to-transparent border-gold/30"
                            : "bg-onyx-card/70 border-onyx-border/30"
                      )}
                    >
                      {/* Title row */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className={cn(
                            "text-sm font-bold",
                            isTeam ? "gold-gradient-text" : isDuo ? "text-gold" : "text-foreground"
                          )}>
                            {p.name}
                          </h3>
                          <span className="text-[9px] text-muted-foreground italic">{p.subtitle}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 text-[7px] font-bold rounded bg-gold/20 text-gold border border-gold/30 uppercase tracking-wide">Actif</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={cn("text-sm font-bold", isTeam ? "text-gold" : isDuo ? "text-gold" : "text-foreground")}>{p.price}</span>
                          {"priceSuffix" in p && p.priceSuffix && (
                            <span className="text-[9px] text-muted-foreground">{p.priceSuffix}</span>
                          )}
                        </div>
                      </div>

                      {/* Capacity - single line */}
                      <p className={cn(
                        "text-[10px] font-semibold mb-2",
                        isTeam ? "text-gold/80" : isDuo ? "text-gold/70" : "text-muted-foreground"
                      )}>
                        {p.capacity}
                      </p>

                      {/* Features */}
                      <div className="space-y-1">
                        {p.features.map((f) => (
                          <div key={f} className="flex items-center gap-1.5">
                            <Check className={cn(
                              "h-3 w-3 shrink-0",
                              isTeam ? "text-gold" : isDuo ? "text-gold/70" : "text-muted-foreground/60"
                            )} strokeWidth={2} />
                            <span className={cn(
                              "text-[10px]",
                              f.includes("ILLIMIT") ? "font-semibold text-gold" : "text-muted-foreground"
                            )}>
                              {f}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Action button */}
                      {isUpgrade && (
                        <button
                          onClick={() => handleChoose(p.id)}
                          className={cn(
                            "w-full mt-3 py-2.5 rounded-xl text-xs font-bold active:scale-[0.97] transition-all",
                            isTeam
                              ? "bg-gold text-primary-foreground gold-glow hover:bg-gold-light"
                              : "bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25"
                          )}
                        >
                          Choisir cette offre
                        </button>
                      )}
                      {isDowngrade && !isCurrent && (
                        <div className="w-full mt-2 text-center">
                          <span className="text-[9px] text-muted-foreground/40">--</span>
                        </div>
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

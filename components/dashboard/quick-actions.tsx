"use client"

import React, { useState } from "react"
import { FileText, Receipt, Car, UserPlus, UserRoundPlus, Lock, Crown, X, Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { AddClientModal } from "./add-client-modal"
import { AddDriverModal } from "./add-driver-modal"
import { AddVehicleFlow } from "./add-vehicle-modal"
import { CreateBCFlow } from "./create-bc"
import { CreateInvoiceFlow } from "./create-invoice"
import { usePlan, PLAN_LIMITS } from "./plan-context"

interface QuickActionProps {
  icon: React.ReactNode
  label: string
  locked?: boolean
  onClick?: () => void
  onLockedClick?: () => void
}

function QuickActionTile({ icon, label, locked, onClick, onLockedClick }: QuickActionProps) {
  return (
    <button
      onClick={locked ? onLockedClick : onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border transition-all duration-200",
        locked
          ? "bg-onyx-card/50 border-onyx-border/50 opacity-60"
          : "bg-onyx-card border-gold/20 hover:border-gold/40 hover:gold-glow-sm active:scale-[0.98]",
      )}
    >
      {locked && (
        <div className="absolute top-1.5 right-1.5">
          <Lock className="h-3 w-3 text-gold/70" strokeWidth={1.5} />
        </div>
      )}

      <div
        className={cn("p-2 rounded-lg", locked ? "bg-onyx-border/30" : "bg-gold/10")}
      >
        <span className={cn(locked ? "text-muted-foreground" : "text-gold")}>
          {React.cloneElement(icon as React.ReactElement, {
            className: "h-4 w-4",
          })}
        </span>
      </div>

      <span
        className={cn(
          "text-[10px] font-medium leading-tight text-center px-1",
          locked ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {label}
      </span>
    </button>
  )
}

/* ── Upgrade Modal (3-column comparatif) ── */
function UpgradeModal({ open, onClose, onUpgrade }: { open: boolean; onClose: () => void; onUpgrade: (target: "DUO" | "TEAM") => void }) {
  const plans = [
    {
      id: "SOLO" as const,
      name: "SOLO",
      subtitle: "L\u2019offre Ind\u00e9pendant",
      price: "0",
      features: ["1 Chauffeur", "1 V\u00e9hicule", "Signature Entreprise", "Paiement \u00e0 l\u2019usage"],
      current: true,
    },
    {
      id: "DUO" as const,
      name: "DUO",
      subtitle: "L\u2019offre Bin\u00f4me",
      price: "4,99",
      features: ["2 Chauffeurs", "2 V\u00e9hicules", "Signature Entreprise", "Docs ILLIMIT\u00c9S"],
      current: false,
    },
    {
      id: "TEAM" as const,
      name: "TEAM",
      subtitle: "L\u2019offre Flotte",
      price: "9,99",
      features: ["10 Chauffeurs", "10 V\u00e9hicules", "Signature Entreprise", "Docs ILLIMIT\u00c9S", "API & Stats"],
      current: false,
    },
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md max-h-[90vh] rounded-3xl bg-onyx-card border border-gold/20 shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
          >
            {/* Header - fixed */}
            <div className="shrink-0 px-4 pt-4 pb-2">
              <button onClick={onClose} className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
                <X className="h-3.5 w-3.5 text-foreground" strokeWidth={2} />
              </button>
              <p className="text-sm font-bold text-foreground text-center">Choisissez votre offre</p>
              <p className="text-[10px] text-muted-foreground text-center mt-0.5">Toutes les offres incluent la Signature Entreprise</p>
            </div>

            {/* Cards - scrollable if needed */}
            <div className="flex-1 overflow-y-auto px-3 pb-4">
              <div className="flex gap-2 h-full">
                {plans.map((p) => {
                  const isTeam = p.id === "TEAM"
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex-1 flex flex-col rounded-2xl border p-2.5",
                        isTeam
                          ? "bg-gradient-to-b from-gold/10 to-transparent border-gold/40"
                          : p.current
                            ? "bg-onyx-card/60 border-onyx-border/30"
                            : "bg-onyx-card/80 border-gold/20"
                      )}
                    >
                      {/* Top content */}
                      <div className="flex-1">
                        <div className="text-center mb-2">
                          <p className={cn("text-xs font-bold", isTeam ? "gold-gradient-text" : p.id === "DUO" ? "text-gold" : "text-foreground")}>{p.name}</p>
                          <p className="text-[8px] text-muted-foreground leading-tight mt-0.5">{p.subtitle}</p>
                        </div>

                        <div className="text-center mb-2">
                          <span className={cn("text-base font-bold", isTeam ? "text-gold" : "text-foreground")}>{p.price}&#8364;</span>
                          {p.price !== "0" && <span className="text-[8px] text-muted-foreground">/mois</span>}
                        </div>

                        <div className="space-y-1">
                          {p.features.map((f) => (
                            <div key={f} className="flex items-start gap-1">
                              <Check className={cn("h-2.5 w-2.5 shrink-0 mt-0.5", isTeam ? "text-gold" : p.id === "DUO" ? "text-gold/70" : "text-muted-foreground")} strokeWidth={2.5} />
                              <span className={cn("text-[9px] leading-tight", f.includes("ILLIMIT") ? "font-semibold text-gold" : "text-muted-foreground")}>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Button - always at bottom */}
                      <div className="shrink-0 pt-3">
                        {p.current ? (
                          <div className="w-full py-2 rounded-xl bg-onyx-border/20 text-center">
                            <span className="text-[10px] font-medium text-muted-foreground">Actuel</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => { onUpgrade(p.id as "DUO" | "TEAM"); onClose() }}
                            className={cn(
                              "w-full py-2 rounded-xl text-[10px] font-bold active:scale-[0.97] transition-all",
                              isTeam
                                ? "bg-gold text-primary-foreground gold-glow"
                                : "bg-gold/15 border border-gold/30 text-gold"
                            )}
                          >
                            Choisir
                          </button>
                        )}
                      </div>
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

export function QuickActions() {
  const [showClientModal, setShowClientModal] = useState(false)
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [showVehicleFlow, setShowVehicleFlow] = useState(false)
  const [showBCFlow, setShowBCFlow] = useState(false)
  const [showInvoiceFlow, setShowInvoiceFlow] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const { plan, driverCount, vehicleCount, upgrade } = usePlan()
  const limits = PLAN_LIMITS[plan]
  const driversFull = driverCount >= limits.drivers
  const vehiclesFull = vehicleCount >= limits.vehicles

  return (
    <section className="px-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">
        Actions Rapides
      </h2>
      <div className="grid grid-cols-3 gap-2.5">
        <QuickActionTile
          icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
          label="+ Bon de Commande"
          onClick={() => setShowBCFlow(true)}
        />
        <QuickActionTile
          icon={<Receipt className="h-5 w-5" strokeWidth={1.5} />}
          label="+ Facture"
          onClick={() => setShowInvoiceFlow(true)}
        />
        <QuickActionTile
          icon={<UserRoundPlus className="h-5 w-5" strokeWidth={1.5} />}
          label="+ Client"
          onClick={() => setShowClientModal(true)}
        />
        <QuickActionTile
          icon={<Car className="h-5 w-5" strokeWidth={1.5} />}
          label="+ Véhicule"
          locked={vehiclesFull}
          onClick={() => setShowVehicleFlow(true)}
          onLockedClick={() => setShowUpgrade(true)}
        />
        <QuickActionTile
          icon={<UserPlus className="h-5 w-5" strokeWidth={1.5} />}
          label="+ Chauffeur"
          locked={driversFull}
          onClick={() => setShowDriverModal(true)}
          onLockedClick={() => setShowUpgrade(true)}
        />
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={(target: "DUO" | "TEAM") => upgrade(target)}
      />
      <AddClientModal
        open={showClientModal}
        onClose={() => setShowClientModal(false)}
      />
      <AddDriverModal
        open={showDriverModal}
        onClose={() => setShowDriverModal(false)}
      />
      <AddVehicleFlow
        open={showVehicleFlow}
        onClose={() => setShowVehicleFlow(false)}
      />
      <CreateBCFlow
        open={showBCFlow}
        onClose={() => setShowBCFlow(false)}
      />
      <CreateInvoiceFlow
        open={showInvoiceFlow}
        onClose={() => setShowInvoiceFlow(false)}
      />
    </section>
  )
}

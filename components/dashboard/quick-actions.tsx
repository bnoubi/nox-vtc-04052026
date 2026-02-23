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
      subtitle: "L'offre Independant",
      price: "0",
      features: ["1 Chauffeur", "1 Vehicule", "Signature Entreprise", "Paiement a l'usage"],
      current: true,
    },
    {
      id: "DUO" as const,
      name: "DUO",
      subtitle: "L'offre Binome",
      price: "4,99",
      features: ["2 Chauffeurs", "2 Vehicules", "Signature Entreprise", "Docs ILLIMITES"],
      current: false,
    },
    {
      id: "TEAM" as const,
      name: "TEAM",
      subtitle: "L'offre Flotte",
      price: "9,99",
      features: ["10 Chauffeurs", "10 Vehicules", "Signature Entreprise", "Docs ILLIMITES", "API & Stats"],
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-md max-h-[85vh] rounded-t-3xl sm:rounded-3xl bg-onyx-card border border-gold/20 px-3 pt-3 pb-4 shadow-2xl shadow-black/50 flex flex-col"
          >
            <button onClick={onClose} className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <X className="h-3.5 w-3.5 text-foreground" strokeWidth={2} />
            </button>

            <div className="text-center mb-2.5 shrink-0">
              <p className="text-[13px] font-bold text-foreground">Choisissez votre offre</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Toutes les offres incluent la Signature Entreprise</p>
            </div>

            <div className="flex gap-1.5 min-h-0 flex-1">
              {plans.map((p) => {
                const isTeam = p.id === "TEAM"
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex-1 flex flex-col justify-between rounded-2xl border p-2",
                      isTeam
                        ? "bg-gradient-to-b from-gold/10 to-transparent border-gold/40"
                        : p.current
                          ? "bg-onyx-card/60 border-onyx-border/30"
                          : "bg-onyx-card/80 border-gold/20"
                    )}
                  >
                    <div>
                      <div className="text-center mb-1.5">
                        <p className={cn("text-[11px] font-bold", isTeam ? "gold-gradient-text" : p.id === "DUO" ? "text-gold" : "text-foreground")}>{p.name}</p>
                        <p className="text-[7px] text-muted-foreground leading-tight mt-0.5">{p.subtitle}</p>
                      </div>

                      <div className="text-center mb-1.5">
                        <span className={cn("text-sm font-bold", isTeam ? "text-gold" : "text-foreground")}>{p.price}&#8364;</span>
                        {p.price !== "0" && <span className="text-[7px] text-muted-foreground">/mois</span>}
                      </div>

                      <div className="space-y-0.5">
                        {p.features.map((f) => (
                          <div key={f} className="flex items-start gap-1">
                            <Check className={cn("h-2.5 w-2.5 shrink-0 mt-px", isTeam ? "text-gold" : p.id === "DUO" ? "text-gold/70" : "text-muted-foreground")} strokeWidth={2.5} />
                            <span className={cn("text-[8px] leading-tight", f.includes("ILLIMITES") ? "font-semibold text-gold" : "text-muted-foreground")}>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2">
                      {p.current ? (
                        <div className="w-full py-1.5 rounded-lg bg-onyx-border/20 text-center">
                          <span className="text-[9px] font-medium text-muted-foreground">Actuel</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => { onUpgrade(p.id as "DUO" | "TEAM"); onClose() }}
                          className={cn(
                            "w-full py-1.5 rounded-lg text-[9px] font-bold active:scale-[0.97] transition-all",
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

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

/* ── Upgrade Modal (detailed comparatif) ── */
function UpgradeModal({ open, onClose, onUpgrade }: { open: boolean; onClose: () => void; onUpgrade: (target: "PRO" | "GOLD") => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="relative w-full max-w-sm rounded-3xl bg-onyx-card border border-gold/20 p-5 shadow-2xl shadow-black/50 max-h-[85vh] overflow-y-auto"
          >
            <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
              <X className="h-4 w-4 text-foreground" strokeWidth={2} />
            </button>

            {/* Header */}
            <div className="text-center mb-4 pt-1">
              <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-3">
                <Lock className="h-5 w-5 text-gold" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-bold text-foreground">Limite SOLO atteinte</p>
              <p className="text-[11px] text-muted-foreground mt-1">Choisissez une offre pour continuer.</p>
            </div>

            {/* PRO Card */}
            <div className="p-4 rounded-2xl bg-onyx-card/80 border border-gold/20 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-sm font-bold text-gold">PRO</h4>
                  <p className="text-[10px] text-gold/60 italic">L&apos;offre Duo</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-gold">4,99&#8364;</span>
                  <span className="text-[10px] text-muted-foreground">/mois</span>
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                {["2 Chauffeurs / Vehicules", "Documents ILLIMITES"].map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-gold shrink-0" strokeWidth={2} />
                    <span className={cn("text-[11px]", f.includes("ILLIMITES") ? "font-semibold text-gold" : "text-muted-foreground")}>{f}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { onUpgrade("PRO"); onClose() }}
                className="w-full py-2.5 rounded-xl bg-gold/15 border border-gold/30 text-gold text-xs font-bold hover:bg-gold/25 active:scale-[0.97] transition-all"
              >
                Choisir cette offre
              </button>
            </div>

            {/* GOLD Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-gold/10 via-gold/5 to-transparent border border-gold/40 gold-glow-sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-sm font-bold gold-gradient-text">GOLD</h4>
                  <p className="text-[10px] text-gold/60 italic">L&apos;offre Flotte</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-gold">9,99&#8364;</span>
                  <span className="text-[10px] text-muted-foreground">/mois</span>
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                {["10 Chauffeurs / Vehicules", "Documents ILLIMITES", "Signature Entreprise", "API & Integrations", "Statistiques avancees"].map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-gold shrink-0" strokeWidth={2} />
                    <span className={cn("text-[11px]", f.includes("ILLIMITES") ? "font-semibold text-gold" : "text-foreground")}>{f}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { onUpgrade("GOLD"); onClose() }}
                className="w-full py-2.5 rounded-xl bg-gold text-primary-foreground text-xs font-bold hover:bg-gold-light active:scale-[0.97] transition-all gold-glow"
              >
                Choisir cette offre
              </button>
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
        onUpgrade={(target) => upgrade(target)}
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

"use client"

import React, { useState } from "react"
import { FileText, Receipt, Car, UserPlus, UserRoundPlus, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { AddClientModal } from "./add-client-modal"
import { AddDriverModal } from "./add-driver-modal"
import { AddVehicleFlow } from "./add-vehicle-modal"
import { CreateBCFlow } from "./create-bc"
import { CreateInvoiceFlow } from "./create-invoice"
import { usePlan, PLAN_LIMITS } from "./plan-context"
import { UpgradeModal } from "./upgrade-modal"

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
        title="Limite atteinte"
        subtitle="Passez \u00e0 une offre sup\u00e9rieure pour d\u00e9bloquer plus de capacit\u00e9."
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

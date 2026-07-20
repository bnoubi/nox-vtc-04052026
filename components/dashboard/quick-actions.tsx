"use client"

import React, { useState } from "react"
import { FileText, Receipt, Car, UserPlus, UserRoundPlus, Lock, LifeBuoy } from "lucide-react"
import { cn } from "@/lib/utils"
import { AddClientModal } from "./add-client-modal"
import { DriverDrawer } from "./driver-drawer"
import { VehicleDrawer } from "./vehicle-drawer"
import { CreateBCFlow } from "./create-bc"
import { CreateInvoiceFlow } from "./create-invoice"
import { SupportTicketModal } from "./support-ticket-modal"
import { useNox } from "./nox-context"
import { getPlanLimits } from "@/lib/plans"
import { useNav } from "./nav-context"
import { LimitAlertModal } from "./limit-alert-modal"
import { SubscriptionDrawer } from "./subscription-drawer"

interface QuickActionProps {
  icon: React.ReactNode
  label: string
  subtitle?: string
  locked?: boolean
  onClick?: () => void
  onLockedClick?: () => void
}

function QuickActionTile({ icon, label, subtitle, locked, onClick, onLockedClick }: QuickActionProps) {
  return (
    <button
      onClick={locked ? onLockedClick : onClick}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border transition-all duration-200",
        locked
          ? "bg-onyx-card border-onyx-border/60 cursor-pointer"
          : "bg-onyx-card border-gold/20 hover:border-gold/40 hover:gold-glow-sm active:scale-[0.98]",
      )}
    >
      {locked && (
        <div className="absolute top-1.5 right-1.5">
          <Lock className="h-3 w-3 text-zinc-500" strokeWidth={1.5} />
        </div>
      )}

      <div
        className={cn("p-2 rounded-lg", locked ? "bg-zinc-800/60" : "bg-gold/10")}
      >
        <span className={cn(locked ? "text-zinc-400" : "text-gold")}>
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
            className: "h-4 w-4",
          })}
        </span>
      </div>

      <div className="flex flex-col items-center gap-0.5 px-1">
        <span
          className={cn(
            "text-[10px] font-medium leading-tight text-center",
            locked ? "text-zinc-400" : "text-foreground",
          )}
        >
          {label}
        </span>
        {subtitle && (
          <span className="text-[9px] text-muted-foreground/60 leading-tight text-center">
            {subtitle}
          </span>
        )}
      </div>
    </button>
  )
}

export function QuickActions() {
  const [showClientModal, setShowClientModal] = useState(false)
  const [showDriverDrawer, setShowDriverDrawer] = useState(false)
  const [showVehicleDrawer, setShowVehicleDrawer] = useState(false)
  const [showBCFlow, setShowBCFlow] = useState(false)
  const [showInvoiceFlow, setShowInvoiceFlow] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [limitAlert, setLimitAlert] = useState<{ open: boolean; label: string }>({ open: false, label: "" })
  const [showSubDrawer, setShowSubDrawer] = useState(false)
  const [subDrawerPlan, setSubDrawerPlan] = useState<"DUO" | "TEAM">("DUO")
  const { plan, driverCount, vehicleCount, addDriver, addVehicle } = useNox()
  const { navigateToSubscription, navigateToRecurring } = useNav()
  const limits = getPlanLimits(plan)
  const driversFull = driverCount >= limits.drivers
  const vehiclesFull = vehicleCount >= limits.vehicles

  function handleQuickDriverSave(data: any) {
    const newDriver = {
      id: '',
      name: `${data.prenom} ${data.nom}`.trim(),
      initials: ((data.prenom?.[0] || '') + (data.nom?.[0] || '')).toUpperCase(),
      online: false,
      carteProNumber: data.cartePro || '',
      carteProExpiration: data.expirationCarte || '',
      apacNumber: data.apacNumber || '',
      apacExpiration: data.apacExpiration || '',
      permisNumber: data.permisNumber || '',
      permisExpiration: data.permisExpiration || '',
      rcProNumber: data.rcProNumber || '',
      rcProExpiration: data.rcProExpiration || '',
      phone: data.phone || '',
      email: data.email || ''
    }
    addDriver(newDriver)
    setShowDriverDrawer(false)
  }

  function handleQuickVehicleSave(data: any) {
    const newVehicle = {
      id: '',
      marque: data.brand || '',
      modele: data.model || '',
      immatriculation: data.plate || '',
      inService: true,
      date_mise_en_circulation: data.datePremiereImmat || '',
      type_energie: data.motorType || 'essence',
      category: data.category || 'berline',
      color: data.color === 'custom' ? (data.customColor || '') : (data.color || ''),
      assuranceTransportExpiration: data.assuranceTransportExpiration || '',
      controleTechniqueExpiration: data.expirationCT || ''
    }
    addVehicle(newVehicle)
    setShowVehicleDrawer(false)
  }

  return (
    <section className="px-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">
        Actions Rapides
      </h2>
      <div className="grid grid-cols-3 gap-2.5">
        <QuickActionTile
          icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
          label="Réservation"
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
          onClick={() => setShowVehicleDrawer(true)}
          onLockedClick={() => setLimitAlert({ open: true, label: "véhicule" })}
        />
        <QuickActionTile
          icon={<UserPlus className="h-5 w-5" strokeWidth={1.5} />}
          label="+ Chauffeur"
          locked={driversFull}
          onClick={() => setShowDriverDrawer(true)}
          onLockedClick={() => setLimitAlert({ open: true, label: "chauffeur" })}
        />
        <QuickActionTile
          icon={<LifeBuoy className="h-5 w-5" strokeWidth={1.5} />}
          label="Support"
          onClick={() => setShowSupportModal(true)}
        />
      </div>

      <AddClientModal
        open={showClientModal}
        onClose={() => setShowClientModal(false)}
      />
      <DriverDrawer
        open={showDriverDrawer}
        driver={null}
        onClose={() => setShowDriverDrawer(false)}
        onSave={handleQuickDriverSave}
      />
      <VehicleDrawer
        open={showVehicleDrawer}
        vehicle={null}
        onClose={() => setShowVehicleDrawer(false)}
        onSave={handleQuickVehicleSave}
      />
      <CreateBCFlow
        open={showBCFlow}
        onClose={() => setShowBCFlow(false)}
        onNavigateToRecurring={navigateToRecurring}
      />
      <CreateInvoiceFlow
        open={showInvoiceFlow}
        onClose={() => setShowInvoiceFlow(false)}
      />
      <LimitAlertModal
        open={limitAlert.open}
        onClose={() => setLimitAlert({ open: false, label: "" })}
        resourceLabel={limitAlert.label}
        onManageOffer={navigateToSubscription}
        onUpgradePro={() => { setLimitAlert({ open: false, label: "" }); setSubDrawerPlan("DUO"); setShowSubDrawer(true) }}
        onUpgradePremium={() => { setLimitAlert({ open: false, label: "" }); setSubDrawerPlan("TEAM"); setShowSubDrawer(true) }}
      />
      <SubscriptionDrawer
        open={showSubDrawer}
        targetPlan={subDrawerPlan}
        onClose={() => setShowSubDrawer(false)}
      />
      <SupportTicketModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </section>
  )
}

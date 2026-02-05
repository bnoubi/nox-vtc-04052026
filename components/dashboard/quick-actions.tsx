"use client"

import React from "react"

import { FileText, Receipt, Car, UserPlus, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickActionProps {
  icon: React.ReactNode
  label: string
  disabled?: boolean
  onClick?: () => void
}

function QuickActionTile({ icon, label, disabled, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl border transition-all duration-200",
        disabled
          ? "bg-onyx-card/50 border-onyx-border/50 opacity-60 cursor-not-allowed"
          : "bg-onyx-card border-gold/20 hover:border-gold/40 hover:gold-glow-sm active:scale-[0.98]"
      )}
    >
      {/* Lock icon for disabled tiles */}
      {disabled && (
        <div className="absolute top-2 right-2">
          <Lock className="h-3.5 w-3.5 text-gold/70" strokeWidth={1.5} />
        </div>
      )}
      
      <div className={cn(
        "p-3 rounded-xl",
        disabled ? "bg-onyx-border/30" : "bg-gold/10"
      )}>
        <span className={cn(
          disabled ? "text-muted-foreground" : "text-gold"
        )}>
          {icon}
        </span>
      </div>
      
      <span className={cn(
        "text-xs font-medium",
        disabled ? "text-muted-foreground" : "text-foreground"
      )}>
        {label}
      </span>
    </button>
  )
}

export function QuickActions() {
  const actions = [
    {
      icon: <FileText className="h-5 w-5" strokeWidth={1.5} />,
      label: "+ Bon Commande",
      disabled: false,
    },
    {
      icon: <Receipt className="h-5 w-5" strokeWidth={1.5} />,
      label: "+ Facture",
      disabled: false,
    },
    {
      icon: <Car className="h-5 w-5" strokeWidth={1.5} />,
      label: "+ Véhicule",
      disabled: true,
    },
    {
      icon: <UserPlus className="h-5 w-5" strokeWidth={1.5} />,
      label: "+ Chauffeur",
      disabled: true,
    },
  ]

  return (
    <section className="px-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Actions Rapides</h2>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <QuickActionTile
            key={action.label}
            icon={action.icon}
            label={action.label}
            disabled={action.disabled}
          />
        ))}
      </div>
    </section>
  )
}

"use client"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type ComplianceStatus = "ok" | "warning" | "expired"

interface ComplianceDotProps {
  status: ComplianceStatus
  className?: string
}

const STATUS_CONFIG = {
  ok: {
    color: "bg-emerald-500",
    glow: "shadow-[0_0_8px_rgba(16,185,129,0.6)]",
    label: "En conformité",
    pulse: false,
  },
  warning: {
    color: "bg-amber-500",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.6)]",
    label: "Expiration proche",
    pulse: true,
  },
  expired: {
    color: "bg-rose-500",
    glow: "shadow-[0_0_8px_rgba(244,63,94,0.6)]",
    label: "Document expiré",
    pulse: true,
  },
}

export function ComplianceDot({ status, className }: ComplianceDotProps) {
  const config = STATUS_CONFIG[status]

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "w-[10px] h-[10px] rounded-full shrink-0",
              config.color,
              config.glow,
              config.pulse && "animate-pulse",
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent
          side="left"
          className="bg-[#1A1A1A]/95 backdrop-blur-sm border border-[#D4AF37]/30 text-[11px] font-medium text-[#F5F5F5] px-2.5 py-1.5 rounded-lg"
        >
          {config.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Helper function to calculate compliance status from dates
export function getDriverComplianceStatus(carteProExpiration: string): ComplianceStatus {
  const today = new Date()
  const expDate = new Date(carteProExpiration)
  const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil < 0) return "expired"
  if (daysUntil < 30) return "warning"
  return "ok"
}

export function getVehicleComplianceStatus(
  assuranceExpiration: string,
  controleTechniqueExpiration: string
): ComplianceStatus {
  const today = new Date()
  const assuranceDate = new Date(assuranceExpiration)
  const ctDate = new Date(controleTechniqueExpiration)
  
  const assuranceDays = Math.ceil((assuranceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const ctDays = Math.ceil((ctDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // Check if any is expired
  if (assuranceDays < 0 || ctDays < 0) return "expired"
  // Check if any is expiring within 30 days
  if (assuranceDays < 30 || ctDays < 30) return "warning"
  return "ok"
}

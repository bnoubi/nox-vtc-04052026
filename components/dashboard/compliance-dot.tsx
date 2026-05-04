"use client"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type ComplianceStatus = "ok" | "warning" | "expired" | "neutral"

interface ComplianceDotProps {
  status: ComplianceStatus
  className?: string
}

const STATUS_CONFIG = {
  neutral: {
    color: "bg-slate-400",
    glow: "shadow-none",
    label: "Aucune date saisie",
    pulse: false,
  },
  ok: {
    color: "bg-emerald-500",
    glow: "shadow-[0_0_8px_rgba(16,185,129,0.6)]",
    label: "En conformité",
    pulse: false,
  },
  warning: {
    color: "bg-amber-500",
    glow: "shadow-[0_0_8px_rgba(245,158,11,0.6)]",
    label: "Expiration proche (≤ 30 j)",
    pulse: true,
  },
  expired: {
    color: "bg-rose-500",
    glow: "shadow-[0_0_8px_rgba(244,63,94,0.6)]",
    label: "Date expirée",
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

// ─── Helpers ────────────────────────────────────────────────────────────────
//
// RÈGLE MÉTIER (outil d'anticipation, PAS de conformité) :
//
//  ⚪ GRIS   → aucune date saisie pour ce profil
//  🔴 ROUGE  → au moins une date saisie ET déjà expirée (< aujourd'hui)
//  🟠 ORANGE → au moins une date saisie ET expire dans ≤ 30 jours (aucune expirée)
//  🟢 VERT   → au moins une date saisie ET toutes > 30 jours
//
// null / "" / undefined  →  date non renseignée → IGNORÉE (jamais rouge)
// ────────────────────────────────────────────────────────────────────────────

/** Filtre et parse une liste de valeurs de dates brutes.
 *  Retourne uniquement les Date valides (null/vide ignorés). */
function parseDates(rawDates: (string | undefined | null)[]): Date[] {
  return rawDates
    .filter((s): s is string => !!s && s.trim() !== "")
    .map((s) => new Date(s))
    .filter((d) => !isNaN(d.getTime()))
}

export function getDriverComplianceStatus(
  carteProExpiration: string | undefined | null,
  apacExpiration?: string | undefined | null,
  rcProExpiration?: string | undefined | null,
  permisExpiration?: string | undefined | null
): ComplianceStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dates = parseDates([
    carteProExpiration,
    permisExpiration,
    apacExpiration,
    rcProExpiration,
  ])

  // Aucune date saisie → gris neutre
  if (dates.length === 0) return "neutral"

  let hasExpired = false
  let hasWarning = false

  for (const d of dates) {
    const daysUntil = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) { hasExpired = true; break }   // priorité max → sortie rapide
    if (daysUntil <= 30) hasWarning = true
  }

  if (hasExpired) return "expired"
  if (hasWarning) return "warning"
  return "ok"
}

export function getVehicleComplianceStatus(
  assuranceTransportExpiration: string | undefined | null,
  controleTechniqueExpiration: string | undefined | null
): ComplianceStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dates = parseDates([
    assuranceTransportExpiration,
    controleTechniqueExpiration,
  ])

  // Aucune date saisie → gris neutre
  if (dates.length === 0) return "neutral"

  let hasExpired = false
  let hasWarning = false

  for (const d of dates) {
    const daysUntil = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) { hasExpired = true; break }
    if (daysUntil <= 30) hasWarning = true
  }

  if (hasExpired) return "expired"
  if (hasWarning) return "warning"
  return "ok"
}

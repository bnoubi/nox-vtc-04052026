"use client"

import { MapPin, Navigation, CalendarOff, Phone } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"
import type { BCStatus } from "./data"

const STATUS_CONFIG: Partial<Record<BCStatus, { label: string; className: string }>> = {
  confirme: {
    label: "Confirmé",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  en_attente: {
    label: "En attente",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  en_cours: {
    label: "En cours",
    className: "bg-gold/10 text-gold border-gold/20",
  },
}

function StatusBadge({ status }: { status: BCStatus }) {
  const config = STATUS_CONFIG[status]
  if (!config) return null
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-[10px] font-medium rounded-full border shrink-0",
        config.className
      )}
    >
      {config.label}
    </span>
  )
}

function formatTripDateTime(date?: string, time?: string): string | null {
  if (!date) return null
  const d = new Date(`${date}T${time ?? "00:00"}`)
  if (isNaN(d.getTime())) return null
  const dateStr = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const capitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
  return time ? `${capitalized} · ${time.replace(":", "h")}` : capitalized
}

function formatAmount(amount: number): string {
  return (
    amount.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  )
}

function formatPassengers(passengers?: number, luggage?: number): string | null {
  const parts: string[] = []
  if (passengers && passengers > 0) {
    parts.push(`${passengers} passager${passengers > 1 ? "s" : ""}`)
  }
  if (luggage && luggage > 0) {
    parts.push(`${luggage} bagage${luggage > 1 ? "s" : ""}`)
  }
  return parts.length > 0 ? parts.join(" · ") : null
}

export function UpcomingTrips() {
  const { bcs } = useNox()

  const upcomingTrips = bcs
    .filter((bc) => bc.status === "en_attente" || bc.status === "confirme")
    .sort((a, b) => {
      const da = a.trajet?.date
        ? `${a.trajet.date}T${a.trajet.time ?? "00:00"}`
        : "9999-12-31T23:59"
      const db = b.trajet?.date
        ? `${b.trajet.date}T${b.trajet.time ?? "00:00"}`
        : "9999-12-31T23:59"
      return da.localeCompare(db)
    })
    .slice(0, 3)

  return (
    <section className="px-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Prochaines Courses</h2>
      </div>

      {upcomingTrips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-2xl bg-onyx-card border border-onyx-border/40">
          <CalendarOff className="h-8 w-8 text-muted-foreground/30 mb-3" strokeWidth={1} />
          <p className="text-sm font-medium text-muted-foreground">Aucune course prévue</p>
          <p className="text-xs text-muted-foreground/60 mt-1 text-center">
            Créez un bon de réservation pour planifier vos courses
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingTrips.map((bc) => {
            const tripDateTime = formatTripDateTime(bc.trajet?.date, bc.trajet?.time)
            const distanceParts: string[] = []
            if (bc.trajet?.distance && bc.trajet.distance > 0)
              distanceParts.push(`${bc.trajet.distance} km`)
            if (bc.trajet?.duree) distanceParts.push(bc.trajet.duree)
            const distanceDuration = distanceParts.length > 0 ? distanceParts.join(" · ") : null
            const passengersText = formatPassengers(bc.trajet?.passengers, bc.trajet?.luggage)
            const hasFooter = bc.amount > 0 || distanceDuration !== null || passengersText !== null

            return (
              <div
                key={bc.id}
                className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/20 transition-colors"
              >
                {/* Date/heure */}
                {tripDateTime && (
                  <p className="text-[11px] font-medium text-gold mb-2">{tripDateTime}</p>
                )}

                {/* Client + badge statut */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-foreground">{bc.client}</span>
                    {bc.clientPhone && (
                      <a
                        href={`tel:${bc.clientPhone}`}
                        className="flex items-center gap-1 mt-0.5"
                      >
                        <Phone className="h-3 w-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
                        <span className="text-[11px] text-muted-foreground">{bc.clientPhone}</span>
                      </a>
                    )}
                  </div>
                  <StatusBadge status={bc.status} />
                </div>

                {/* Adresses départ → arrivée */}
                {bc.trajet && (
                  <div className="space-y-1.5">
                    {bc.trajet.depart && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gold mt-0.5 shrink-0" strokeWidth={1.5} />
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {bc.trajet.depart}
                        </span>
                      </div>
                    )}
                    {bc.trajet.arrivee && (
                      <div className="flex items-start gap-2">
                        <Navigation className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {bc.trajet.arrivee}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Montant · Distance · Passagers */}
                {hasFooter && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2.5 mt-2.5 border-t border-onyx-border/30">
                    {bc.amount > 0 && (
                      <span className="text-xs font-semibold text-foreground">
                        {formatAmount(bc.amount)}
                      </span>
                    )}
                    {distanceDuration && (
                      <span className="text-xs text-muted-foreground">{distanceDuration}</span>
                    )}
                    {passengersText && (
                      <span className="text-xs text-muted-foreground">{passengersText}</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

"use client"

import { MapPin, Navigation, CalendarOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"

function StatusBadge({ status }: { status: "confirmed" | "pending" | "in-progress" }) {
  const statusConfig = {
    confirmed: {
      label: "Confirmé",
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    pending: {
      label: "En attente",
      className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    "in-progress": {
      label: "En cours",
      className: "bg-gold/10 text-gold border-gold/20",
    },
  }

  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "px-2 py-0.5 text-[10px] font-medium rounded-full border",
        config.className
      )}
    >
      {config.label}
    </span>
  )
}

export function UpcomingTrips() {
  // Les courses à venir proviennent des BCs confirmés dans le store utilisateur
  const { bcs } = useNox()

  // Filtrer les BCs signés (= courses confirmées)
  const upcomingTrips = bcs
    .filter((bc) => bc.status === "signe")
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
          {upcomingTrips.map((bc) => (
            <div
              key={bc.id}
              className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{bc.client}</span>
                </div>
                <StatusBadge status="confirmed" />
              </div>

              {bc.trajet && (
                <div className="space-y-2">
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
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

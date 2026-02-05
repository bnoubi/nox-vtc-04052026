"use client"

import { MapPin, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"

interface Trip {
  id: string
  time: string
  clientName: string
  clientTitle: "Mme" | "M."
  pickup: string
  dropoff: string
  status: "confirmed" | "pending" | "in-progress"
}

const trips: Trip[] = [
  {
    id: "1",
    time: "14:30",
    clientName: "Laurent",
    clientTitle: "M.",
    pickup: "8 Rue de Rivoli, Paris 1er",
    dropoff: "Aéroport CDG, Terminal 2E",
    status: "confirmed",
  },
  {
    id: "2",
    time: "18:00",
    clientName: "Beaumont",
    clientTitle: "Mme",
    pickup: "Le Bristol Paris",
    dropoff: "Opéra Garnier",
    status: "pending",
  },
]

function StatusBadge({ status }: { status: Trip["status"] }) {
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

function TripCard({ trip }: { trip: Trip }) {
  return (
    <div className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/20 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gold">{trip.time}</span>
          <span className="text-sm font-medium text-foreground">
            {trip.clientTitle} {trip.clientName}
          </span>
        </div>
        <StatusBadge status={trip.status} />
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-gold mt-0.5 shrink-0" strokeWidth={1.5} />
          <span className="text-xs text-muted-foreground line-clamp-1">
            {trip.pickup}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Navigation className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
          <span className="text-xs text-muted-foreground line-clamp-1">
            {trip.dropoff}
          </span>
        </div>
      </div>
    </div>
  )
}

export function UpcomingTrips() {
  return (
    <section className="px-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Upcoming Trips</h2>
        <button className="text-xs text-gold font-medium hover:text-gold-light transition-colors">
          View All
        </button>
      </div>
      <div className="space-y-3">
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </section>
  )
}

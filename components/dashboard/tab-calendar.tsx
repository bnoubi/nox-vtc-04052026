"use client"

import { useMemo, useState } from "react"
import { Clock, MapPin, Navigation, Plus, User } from "lucide-react"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8)

interface CalendarTrip {
  id: string
  hour: number
  minute: number
  clientTitle: "M." | "Mme"
  clientName: string
  pickup: string
  dropoff: string
  status: "confirmed" | "pending" | "completed"
}

const tripsByDay: Record<number, CalendarTrip[]> = {
  0: [
    {
      id: "m1",
      hour: 9,
      minute: 30,
      clientTitle: "M.",
      clientName: "Laurent",
      pickup: "8 Rue de Rivoli, Paris 1er",
      dropoff: "Aeroport CDG, Terminal 2E",
      status: "confirmed",
    },
    {
      id: "m2",
      hour: 14,
      minute: 0,
      clientTitle: "Mme",
      clientName: "Beaumont",
      pickup: "Le Bristol Paris",
      dropoff: "Opera Garnier",
      status: "confirmed",
    },
    {
      id: "m3",
      hour: 18,
      minute: 30,
      clientTitle: "M.",
      clientName: "Moreau",
      pickup: "Gare de Lyon",
      dropoff: "Hotel Plaza Athenee",
      status: "pending",
    },
  ],
  1: [
    {
      id: "t1",
      hour: 8,
      minute: 0,
      clientTitle: "Mme",
      clientName: "Dubois",
      pickup: "16 Av. Montaigne",
      dropoff: "Aeroport Orly, Terminal Sud",
      status: "confirmed",
    },
    {
      id: "t2",
      hour: 11,
      minute: 30,
      clientTitle: "M.",
      clientName: "Petit",
      pickup: "Gare du Nord",
      dropoff: "La Defense, Tour Total",
      status: "pending",
    },
  ],
  2: [
    {
      id: "w1",
      hour: 10,
      minute: 0,
      clientTitle: "M.",
      clientName: "Garcia",
      pickup: "Hotel Ritz Paris",
      dropoff: "Chateau de Versailles",
      status: "confirmed",
    },
  ],
  3: [],
  4: [
    {
      id: "f1",
      hour: 7,
      minute: 30,
      clientTitle: "Mme",
      clientName: "Martin",
      pickup: "Residence Neuilly",
      dropoff: "Aeroport CDG, Terminal 1",
      status: "confirmed",
    },
    {
      id: "f2",
      hour: 16,
      minute: 0,
      clientTitle: "M.",
      clientName: "Bernard",
      pickup: "Palais des Congres",
      dropoff: "Four Seasons George V",
      status: "confirmed",
    },
    {
      id: "f3",
      hour: 20,
      minute: 0,
      clientTitle: "Mme",
      clientName: "Leroy",
      pickup: "Restaurant Le Cinq",
      dropoff: "7 Rue de Passy, Paris 16e",
      status: "pending",
    },
  ],
  5: [],
  6: [],
}

const statusConfig = {
  confirmed: { label: "Confirme", dotColor: "bg-emerald-400" },
  pending: { label: "En attente", dotColor: "bg-amber-400" },
  completed: { label: "Termine", dotColor: "bg-muted-foreground" },
}

function getDaysOfWeek(): { label: string; date: number; month: string; isToday: boolean; fullDate: string }[] {
  const today = new Date(2026, 1, 7) // Feb 7, 2026 (Saturday)
  const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
  const monthLabels = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"]
  const startOfWeek = new Date(today)
  const dayOfWeek = today.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  startOfWeek.setDate(today.getDate() + diff)

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    return {
      label: dayLabels[date.getDay()],
      date: date.getDate(),
      month: monthLabels[date.getMonth()],
      isToday: date.toDateString() === today.toDateString(),
      fullDate: date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    }
  })
}

export function CalendarTab() {
  const days = useMemo(() => getDaysOfWeek(), [])
  const todayIndex = useMemo(() => days.findIndex((d) => d.isToday), [days])
  const [selectedDay, setSelectedDay] = useState(todayIndex >= 0 ? todayIndex : 0)

  const selectedTrips = tripsByDay[selectedDay] || []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-foreground">Calendrier</h1>
          <span className="text-xs text-muted-foreground">{days[selectedDay]?.month} 2026</span>
        </div>
        <p className="text-[11px] text-muted-foreground capitalize mb-3">{days[selectedDay]?.fullDate}</p>
      </div>

      {/* Day Selector */}
      <div className="px-4 pb-4">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
          {days.map((day, i) => {
            const tripCount = (tripsByDay[i] || []).length
            return (
              <button
                key={`${day.label}-${day.date}`}
                onClick={() => setSelectedDay(i)}
                className={cn(
                  "flex flex-col items-center min-w-[44px] py-2 px-1.5 rounded-2xl border transition-all duration-200",
                  selectedDay === i
                    ? "bg-gold/15 border-gold/40 gold-glow-sm"
                    : "bg-onyx-card border-onyx-border/50 hover:border-onyx-border",
                )}
              >
                <span className={cn(
                  "text-[9px] font-medium uppercase tracking-wide mb-0.5",
                  selectedDay === i ? "text-gold" : "text-muted-foreground",
                )}>
                  {day.label}
                </span>
                <span className={cn(
                  "text-sm font-bold leading-tight",
                  selectedDay === i ? "text-gold" : "text-foreground",
                )}>
                  {day.date}
                </span>
                {tripCount > 0 && (
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full mt-1",
                    selectedDay === i ? "bg-gold" : "bg-muted-foreground/50",
                  )} />
                )}
                {day.isToday && selectedDay !== i && (
                  <div className="w-1 h-1 rounded-full bg-gold mt-1" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-onyx-card border border-onyx-border/50">
          <Clock className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
          <span className="text-[11px] text-muted-foreground">
            {selectedTrips.length === 0
              ? "Aucune course programmee"
              : `${selectedTrips.length} course${selectedTrips.length > 1 ? "s" : ""} programmee${selectedTrips.length > 1 ? "s" : ""}`
            }
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="relative">
          {HOURS.map((hour, hourIdx) => {
            const trip = selectedTrips.find((t) => t.hour === hour)
            const isLast = hourIdx === HOURS.length - 1

            return (
              <div key={hour} className="flex gap-3 min-h-[56px]">
                {/* Time label */}
                <div className="w-11 shrink-0 text-right pr-1 pt-0.5">
                  <span className={cn(
                    "text-[11px] font-medium tabular-nums",
                    trip ? "text-gold" : "text-muted-foreground/60",
                  )}>
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>

                {/* Line + dot */}
                <div className="flex flex-col items-center shrink-0 w-3">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full border-2 shrink-0 mt-0.5",
                    trip ? "bg-gold border-gold" : "bg-transparent border-onyx-border/60",
                  )} />
                  {!isLast && (
                    <div className={cn(
                      "w-px flex-1",
                      trip ? "bg-gold/30" : "bg-onyx-border/30",
                    )} />
                  )}
                </div>

                {/* Trip card or empty space */}
                <div className="flex-1 pb-2 min-h-[48px]">
                  {trip ? (
                    <div className="p-3 rounded-2xl bg-onyx-card border border-gold/20 hover:border-gold/40 transition-colors">
                      {/* Top row: time + client + status */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gold tabular-nums">
                            {String(trip.hour).padStart(2, "0")}:{String(trip.minute).padStart(2, "0")}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-xs font-medium text-foreground">
                              {trip.clientTitle} {trip.clientName}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={cn("w-1.5 h-1.5 rounded-full", statusConfig[trip.status].dotColor)} />
                          <span className="text-[9px] text-muted-foreground">{statusConfig[trip.status].label}</span>
                        </div>
                      </div>
                      {/* Addresses */}
                      <div className="space-y-1.5 pl-0.5">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                          <span className="text-[11px] text-muted-foreground leading-snug">{trip.pickup}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Navigation className="h-3 w-3 text-gold shrink-0 mt-0.5" strokeWidth={1.5} />
                          <span className="text-[11px] text-muted-foreground leading-snug">{trip.dropoff}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating add button */}
      <button className="fixed bottom-28 right-5 z-30 w-12 h-12 rounded-full bg-gold flex items-center justify-center gold-glow active:scale-95 transition-transform">
        <Plus className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
      </button>
    </div>
  )
}

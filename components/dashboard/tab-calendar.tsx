"use client"

import { useMemo, useRef, useState } from "react"
import { MapPin, Navigation, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 08:00 - 22:00

interface CalendarTrip {
  id: string
  hour: number
  minute: number
  duration: number // in hours
  clientTitle: "M." | "Mme"
  clientName: string
  pickup: string
  dropoff: string
}

const weekTrips: CalendarTrip[] = [
  {
    id: "1",
    hour: 9,
    minute: 30,
    duration: 1,
    clientTitle: "M.",
    clientName: "Laurent",
    pickup: "8 Rue de Rivoli, Paris 1er",
    dropoff: "Aéroport CDG, Terminal 2E",
  },
  {
    id: "2",
    hour: 14,
    minute: 0,
    duration: 1,
    clientTitle: "Mme",
    clientName: "Beaumont",
    pickup: "Le Bristol Paris",
    dropoff: "Opéra Garnier",
  },
  {
    id: "3",
    hour: 18,
    minute: 30,
    duration: 1,
    clientTitle: "M.",
    clientName: "Moreau",
    pickup: "Gare de Lyon",
    dropoff: "Hôtel Plaza Athénée",
  },
]

function getDaysOfWeek(): { label: string; day: string; date: number; isToday: boolean }[] {
  const today = new Date()
  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
  const startOfWeek = new Date(today)
  const dayOfWeek = today.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  startOfWeek.setDate(today.getDate() + diff)

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    return {
      label: dayNames[date.getDay()],
      day: dayNames[date.getDay()],
      date: date.getDate(),
      isToday: date.toDateString() === today.toDateString(),
    }
  })
}

export function CalendarTab() {
  const days = useMemo(() => getDaysOfWeek(), [])
  const initialIndex = days.findIndex((d) => d.isToday)
  const [selectedDay, setSelectedDay] = useState(initialIndex >= 0 ? initialIndex : 0)
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col h-full">
      {/* Day Selector */}
      <div className="px-4 pt-2 pb-4">
        <h1 className="text-lg font-bold text-foreground mb-3">Calendrier</h1>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {days.map((day, i) => (
            <button
              key={day.label + day.date}
              onClick={() => setSelectedDay(i)}
              className={cn(
                "flex flex-col items-center min-w-[48px] py-2.5 px-2 rounded-2xl border transition-all duration-200",
                selectedDay === i
                  ? "bg-gold/15 border-gold/40 gold-glow-sm"
                  : "bg-onyx-card border-onyx-border/50 hover:border-onyx-border",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-medium mb-1",
                  selectedDay === i ? "text-gold" : "text-muted-foreground",
                )}
              >
                {day.label}
              </span>
              <span
                className={cn(
                  "text-sm font-bold",
                  selectedDay === i ? "text-gold" : "text-foreground",
                )}
              >
                {day.date}
              </span>
              {day.isToday && (
                <div className="w-1 h-1 rounded-full bg-gold mt-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pb-8"
      >
        <div className="relative">
          {HOURS.map((hour) => {
            const trip = weekTrips.find((t) => t.hour === hour)
            return (
              <div key={hour} className="flex gap-3 min-h-[60px]">
                {/* Time label */}
                <div className="w-12 shrink-0 text-right pr-2 pt-0.5">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>

                {/* Line + dot */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full border-2 shrink-0",
                      trip ? "bg-gold border-gold" : "bg-onyx-card border-onyx-border",
                    )}
                  />
                  <div className="w-px flex-1 bg-onyx-border/50" />
                </div>

                {/* Trip card or empty */}
                <div className="flex-1 pb-3">
                  {trip ? (
                    <div className="p-3 rounded-2xl bg-onyx-card border border-gold/20 hover:border-gold/40 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-gold">
                          {String(trip.hour).padStart(2, "0")}:{String(trip.minute).padStart(2, "0")}
                        </span>
                        <span className="text-xs font-medium text-foreground">
                          {trip.clientTitle} {trip.clientName}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-gold shrink-0" strokeWidth={1.5} />
                          <span className="text-[11px] text-muted-foreground truncate">
                            {trip.pickup}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Navigation className="h-3 w-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
                          <span className="text-[11px] text-muted-foreground truncate">
                            {trip.dropoff}
                          </span>
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
      <button className="fixed bottom-24 right-5 z-30 w-12 h-12 rounded-full bg-gold flex items-center justify-center gold-glow active:scale-95 transition-transform">
        <Plus className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
      </button>
    </div>
  )
}

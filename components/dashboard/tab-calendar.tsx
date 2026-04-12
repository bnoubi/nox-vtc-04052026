"use client"

import { useMemo, useState } from "react"
import { Clock, MapPin, Navigation, Plus, CalendarOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { CreateBCFlow } from "./create-bc"

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8)

// Calendrier vide — les événements viendront des BCs utilisateur (futur)
// Aucune donnée fictive : chaque utilisateur part d'un calendrier vide.

const statusConfig = {
  confirmed: { label: "Confirmé", dotColor: "bg-emerald-400" },
  pending: { label: "En attente", dotColor: "bg-amber-400" },
  completed: { label: "Terminé", dotColor: "bg-muted-foreground" },
}

function getDaysOfWeek(): { label: string; date: number; month: string; isToday: boolean; fullDate: string }[] {
  // Utilise la date réelle — plus de date hardcodée
  const today = new Date()
  const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]
  const monthLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
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
  const [showBCFlow, setShowBCFlow] = useState(false)

  // Aucune course fictive — calendrier vide pour tout nouveau compte
  const selectedTrips: never[] = []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-bold text-foreground">Calendrier</h1>
          <span className="text-xs text-muted-foreground">{days[selectedDay]?.month} {new Date().getFullYear()}</span>
        </div>
        <p className="text-[11px] text-muted-foreground capitalize mb-3">{days[selectedDay]?.fullDate}</p>
      </div>

      {/* Day Selector */}
      <div className="px-4 pb-4">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
          {days.map((day, i) => (
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
              {day.isToday && selectedDay !== i && (
                <div className="w-1 h-1 rounded-full bg-gold mt-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-onyx-card border border-onyx-border/50">
          <Clock className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
          <span className="text-[11px] text-muted-foreground">
            Aucune course programmée
          </span>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
        <CalendarOff className="h-12 w-12 text-muted-foreground/20 mb-4" strokeWidth={1} />
        <p className="text-sm font-medium text-muted-foreground">Calendrier vide</p>
        <p className="text-xs text-muted-foreground/60 mt-1 text-center max-w-[200px]">
          Ajoutez un bon de réservation pour voir vos courses ici
        </p>
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setShowBCFlow(true)}
        className="fixed bottom-28 right-5 z-30 w-12 h-12 rounded-full bg-gold flex items-center justify-center gold-glow active:scale-95 transition-transform"
      >
        <Plus className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
      </button>

      <CreateBCFlow open={showBCFlow} onClose={() => setShowBCFlow(false)} />
    </div>
  )
}

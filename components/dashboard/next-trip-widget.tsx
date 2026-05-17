"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock } from "lucide-react"
import { useNox } from "./nox-context"

const THIRTY_MIN_MS = 30 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000
const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000
const FORTY_EIGHT_H_MS = 48 * 60 * 60 * 1000

function formatCountdown(diffMs: number, tripDate: Date, tripTime?: string): string {
  if (diffMs <= 0) return "En cours"
  if (diffMs < ONE_HOUR_MS) {
    const mins = Math.floor(diffMs / 60000)
    return `Dans ${mins} min`
  }
  if (diffMs < TWENTY_FOUR_H_MS) {
    const totalMin = Math.floor(diffMs / 60000)
    const hours = Math.floor(totalMin / 60)
    const mins = totalMin % 60
    return mins > 0 ? `Dans ${hours}h${String(mins).padStart(2, "0")}` : `Dans ${hours}h`
  }
  if (diffMs < FORTY_EIGHT_H_MS) {
    const timeStr = tripTime ? tripTime.replace(":", "h") : ""
    return timeStr ? `Demain à ${timeStr}` : "Demain"
  }
  const dateStr = tripDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
  return dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
}

function formatTripDate(date: string, time?: string): string {
  const d = new Date(`${date}T${time ?? "00:00"}`)
  if (isNaN(d.getTime())) return date
  const dateStr = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const capitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
  return time ? `${capitalized} · ${time.replace(":", "h")}` : capitalized
}

export function NextTripWidget() {
  const { bcs } = useNox()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const nextTrip = useMemo(() => {
    return bcs
      .filter((bc) => {
        if (bc.status !== "confirme" && bc.status !== "en_attente") return false
        if (!bc.trajet?.date) return false
        const tripMs = new Date(`${bc.trajet.date}T${bc.trajet.time ?? "00:00"}`).getTime()
        return tripMs > now - THIRTY_MIN_MS
      })
      .sort((a, b) => {
        const ta = `${a.trajet?.date ?? "9999-12-31"}T${a.trajet?.time ?? "00:00"}`
        const tb = `${b.trajet?.date ?? "9999-12-31"}T${b.trajet?.time ?? "00:00"}`
        return ta.localeCompare(tb)
      })[0] ?? null
  }, [bcs, now])

  if (!nextTrip) return null

  const tripDate = new Date(`${nextTrip.trajet!.date}T${nextTrip.trajet?.time ?? "00:00"}`)
  const diffMs = tripDate.getTime() - now
  const countdown = formatCountdown(diffMs, tripDate, nextTrip.trajet?.time)
  const dateLabel = formatTripDate(nextTrip.trajet!.date!, nextTrip.trajet?.time)

  return (
    <section className="px-4">
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
        <Clock className="h-5 w-5 text-amber-400 shrink-0" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Prochaine course
            </span>
            <span className="text-sm font-bold text-amber-400 shrink-0">{countdown}</span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate">{nextTrip.client}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{dateLabel}</p>
        </div>
      </div>
    </section>
  )
}

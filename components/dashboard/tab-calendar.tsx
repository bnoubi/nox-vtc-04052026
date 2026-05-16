"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Clock, Plus, ChevronLeft, ChevronRight, X, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"
import { useNav } from "./nav-context"
import { CreateBCFlow } from "./create-bc"
import type { BCDocument, BCStatus } from "./data"

const STATUS_LABEL: Partial<Record<BCStatus, string>> = {
  brouillon: "Brouillon",
  en_attente: "En attente",
  confirme: "Confirmé",
  en_cours: "En cours",
  termine: "Terminé",
  annule_client: "Annulé client",
  annule_chauffeur: "Annulé chauffeur",
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
const MONTH_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getWeekDays(weekOffset: number) {
  const today = new Date()
  const dow = today.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const start = new Date(today)
  start.setDate(today.getDate() + diff + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return {
      label: DAY_LABELS[i],
      date: d.getDate(),
      month: MONTH_SHORT[d.getMonth()],
      isToday: d.toDateString() === today.toDateString(),
      iso: isoDate(d),
      fullDate: d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    }
  })
}

function getMonthData(monthOffset: number) {
  const today = new Date()
  const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const year = d.getFullYear()
  const month = d.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayRaw = new Date(year, month, 1).getDay()
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1
  return { year, month, daysInMonth, firstDay, label: `${MONTH_NAMES[month]} ${year}` }
}

function BCDetailSheet({ bc, onClose, onViewDetail }: { bc: BCDocument; onClose: () => void; onViewDetail: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        className="relative bg-onyx-card rounded-t-2xl p-5 pb-10 max-h-[80vh] overflow-y-auto"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-foreground">BC {bc.number}</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-onyx-border/30">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-3">
          <SheetRow label="Client" value={bc.client} />
          {bc.trajet?.depart && <SheetRow label="Départ" value={bc.trajet.depart} />}
          {bc.trajet?.arrivee && <SheetRow label="Arrivée" value={bc.trajet.arrivee} />}
          {bc.trajet?.time && <SheetRow label="Heure" value={bc.trajet.time.replace(":", "h")} />}
          <SheetRow label="Montant TTC" value={`${bc.amount.toFixed(2)} €`} />
          <SheetRow label="Statut" value={STATUS_LABEL[bc.status] ?? String(bc.status)} />
        </div>
        <button
          onClick={onViewDetail}
          className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold/10 border border-gold/30 text-gold text-sm font-semibold active:bg-gold/20"
        >
          <ExternalLink className="h-4 w-4" />
          Voir le détail
        </button>
      </motion.div>
    </motion.div>
  )
}

function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right">{value}</span>
    </div>
  )
}

function DayBCsSheet({ date, bcs, onClose, onSelectBC }: { date: string; bcs: BCDocument[]; onClose: () => void; onSelectBC: (bc: BCDocument) => void }) {
  const label = new Date(date + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        className="relative bg-onyx-card rounded-t-2xl p-5 pb-10 max-h-[70vh] overflow-y-auto"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-foreground capitalize">{label}</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-onyx-border/30">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-2">
          {bcs.map((bc) => (
            <button
              key={bc.id}
              onClick={() => onSelectBC(bc)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-onyx-bg border border-onyx-border/50 active:bg-onyx-border/30 text-left"
            >
              {bc.trajet?.time && (
                <span className="text-xs font-bold text-gold shrink-0 min-w-[36px]">{bc.trajet.time.replace(":", "h")}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{bc.client}</p>
                <p className="text-[11px] text-muted-foreground">{bc.amount.toFixed(2)} €</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

export function CalendarTab() {
  const { bcs } = useNox()
  const { switchTab, navigateToBC } = useNav()
  const today = new Date()
  const todayDow = today.getDay()
  const initDayIdx = todayDow === 0 ? 6 : todayDow - 1

  const [view, setView] = useState<"week" | "month">("week")
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDayIdx, setSelectedDayIdx] = useState(initDayIdx)
  const [viewingBC, setViewingBC] = useState<BCDocument | null>(null)
  const [daySheetDate, setDaySheetDate] = useState<string | null>(null)
  const [showBCFlow, setShowBCFlow] = useState(false)

  const calendarBcs = useMemo(
    () => bcs.filter((bc) =>
      bc.status !== "annule_client" &&
      bc.status !== "annule_chauffeur" &&
      bc.trajet?.date &&
      !bc.number?.startsWith("DRAFT")
    ),
    [bcs]
  )

  const bcsByDate = useMemo(() => {
    const map = new Map<string, BCDocument[]>()
    for (const bc of calendarBcs) {
      const date = bc.trajet!.date!
      if (!map.has(date)) map.set(date, [])
      map.get(date)!.push(bc)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.trajet?.time ?? "00:00").localeCompare(b.trajet?.time ?? "00:00"))
    }
    return map
  }, [calendarBcs])

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])
  const monthData = useMemo(() => getMonthData(monthOffset), [monthOffset])

  const selectedDay = weekDays[selectedDayIdx]
  const dayBcs = selectedDay ? (bcsByDate.get(selectedDay.iso) ?? []) : []

  const weekLabel = useMemo(() => {
    const first = weekDays[0], last = weekDays[6]
    return `${first.date} – ${last.date} ${last.month}`
  }, [weekDays])

  function handleViewDetail(bc: BCDocument) {
    setViewingBC(null)
    setDaySheetDate(null)
    navigateToBC(bc.id)
    switchTab("documents")
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-2 pb-3">
        <h1 className="text-lg font-bold text-foreground mb-2">Calendrier</h1>
        <div className="flex gap-1 p-0.5 rounded-xl bg-onyx-card border border-onyx-border/50 w-fit">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1 rounded-[9px] text-xs font-semibold transition-all duration-150",
                view === v ? "bg-gold text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {v === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>

      {view === "week" ? (
        <>
          {/* Week navigation */}
          <div className="px-4 flex items-center justify-between mb-2">
            <button onClick={() => setWeekOffset((o) => o - 1)} className="p-1.5 rounded-lg hover:bg-onyx-card">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-xs text-muted-foreground">{weekLabel}</span>
            <button onClick={() => setWeekOffset((o) => o + 1)} className="p-1.5 rounded-lg hover:bg-onyx-card">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Day selector */}
          <div className="px-4 pb-4">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
              {weekDays.map((day, i) => {
                const hasBcs = (bcsByDate.get(day.iso)?.length ?? 0) > 0
                return (
                  <button
                    key={day.iso}
                    onClick={() => setSelectedDayIdx(i)}
                    className={cn(
                      "flex flex-col items-center min-w-[44px] py-2 px-1.5 rounded-2xl border transition-all duration-200",
                      selectedDayIdx === i
                        ? "bg-gold/15 border-gold/40 gold-glow-sm"
                        : "bg-onyx-card border-onyx-border/50 hover:border-onyx-border",
                    )}
                  >
                    <span className={cn("text-[9px] font-medium uppercase tracking-wide mb-0.5", selectedDayIdx === i ? "text-gold" : "text-muted-foreground")}>
                      {day.label}
                    </span>
                    <span className={cn("text-sm font-bold leading-tight", selectedDayIdx === i ? "text-gold" : "text-foreground")}>
                      {day.date}
                    </span>
                    {hasBcs ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1" />
                    ) : day.isToday && selectedDayIdx !== i ? (
                      <div className="w-1 h-1 rounded-full bg-muted-foreground mt-1" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Day summary */}
          <div className="px-4 mb-3">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-onyx-card border border-onyx-border/50">
              <Clock className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
              <span className="text-[11px] text-muted-foreground capitalize">
                {selectedDay?.fullDate} · {dayBcs.length > 0 ? `${dayBcs.length} course${dayBcs.length > 1 ? "s" : ""}` : "Aucune course"}
              </span>
            </div>
          </div>

          {/* BC list */}
          <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-24">
            {dayBcs.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Aucune course ce jour</p>
              </div>
            ) : (
              dayBcs.map((bc) => (
                <button
                  key={bc.id}
                  onClick={() => setViewingBC(bc)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-onyx-card border border-onyx-border/50 active:bg-onyx-border/20 text-left"
                >
                  {bc.trajet?.time && (
                    <span className="text-sm font-bold text-gold shrink-0 min-w-[42px]">{bc.trajet.time.replace(":", "h")}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{bc.client}</p>
                    <p className="text-[11px] text-muted-foreground">{bc.amount.toFixed(2)} €</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Month navigation */}
          <div className="px-4 flex items-center justify-between mb-3">
            <button onClick={() => setMonthOffset((o) => o - 1)} className="p-1.5 rounded-lg hover:bg-onyx-card">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground">{monthData.label}</span>
            <button onClick={() => setMonthOffset((o) => o + 1)} className="p-1.5 rounded-lg hover:bg-onyx-card">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Day headers */}
          <div className="px-4 grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map((l) => (
              <div key={l} className="text-[9px] text-center text-muted-foreground font-medium uppercase">{l}</div>
            ))}
          </div>

          {/* Month grid */}
          <div className="px-4 grid grid-cols-7 gap-1 overflow-y-auto pb-24">
            {Array.from({ length: monthData.firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: monthData.daysInMonth }, (_, i) => {
              const day = i + 1
              const iso = `${monthData.year}-${String(monthData.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              const dayBcsList = bcsByDate.get(iso) ?? []
              const isToday = iso === isoDate(new Date())
              return (
                <button
                  key={iso}
                  onClick={() => { if (dayBcsList.length > 0) setDaySheetDate(iso) }}
                  className={cn(
                    "flex flex-col items-center py-2 rounded-xl border transition-all",
                    isToday ? "border-gold/30 bg-gold/5" : "border-transparent",
                    dayBcsList.length > 0 ? "active:bg-onyx-card" : "cursor-default"
                  )}
                >
                  <span className={cn("text-sm font-semibold", isToday ? "text-gold" : "text-foreground")}>{day}</span>
                  {dayBcsList.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-gold mt-0.5" />}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowBCFlow(true)}
        className="fixed bottom-28 right-5 z-30 w-12 h-12 rounded-full bg-gold flex items-center justify-center gold-glow active:scale-95 transition-transform"
      >
        <Plus className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
      </button>

      <AnimatePresence>
        {viewingBC && (
          <BCDetailSheet
            key="bc-detail"
            bc={viewingBC}
            onClose={() => setViewingBC(null)}
            onViewDetail={() => handleViewDetail(viewingBC)}
          />
        )}
        {daySheetDate && !viewingBC && (
          <DayBCsSheet
            key="day-bcs"
            date={daySheetDate}
            bcs={bcsByDate.get(daySheetDate) ?? []}
            onClose={() => setDaySheetDate(null)}
            onSelectBC={(bc) => setViewingBC(bc)}
          />
        )}
      </AnimatePresence>

      <CreateBCFlow open={showBCFlow} onClose={() => setShowBCFlow(false)} />
    </div>
  )
}

"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"

function ScrollColumn({ items, initialIndex, onSelect }: {
  items: string[]
  initialIndex: number
  onSelect: (i: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const ITEM_H = 44
  const current = useRef(initialIndex)
  const [displayIdx, setDisplayIdx] = useState(initialIndex)

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = initialIndex * ITEM_H
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    if (!ref.current) return
    const idx = Math.round(ref.current.scrollTop / ITEM_H)
    const clamped = Math.max(0, Math.min(items.length - 1, idx))
    if (clamped !== current.current) {
      current.current = clamped
      setDisplayIdx(clamped)
      onSelect(clamped)
    }
  }

  return (
    <div className="relative flex-1 overflow-hidden" style={{ minWidth: 44 }}>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 bg-white/5 rounded-lg pointer-events-none z-10" />
      <div ref={ref} onScroll={onScroll} className="h-[220px] overflow-y-scroll snap-y snap-mandatory" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
        <div style={{ height: ITEM_H * 2 }} />
        {items.map((item, i) => (
          <div key={i} style={{ height: ITEM_H }}
            className={cn("flex items-center justify-center text-sm snap-center px-1 cursor-pointer transition-colors duration-100 select-none",
              i === displayIdx ? "text-amber-400 font-semibold" : "text-muted-foreground/50")}
            onClick={() => {
              current.current = i; setDisplayIdx(i); onSelect(i)
              ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" })
            }}>
            {item}
          </div>
        ))}
        <div style={{ height: ITEM_H * 2 }} />
      </div>
    </div>
  )
}

export function DateTimePickerSheet({ open, initialDate, initialTime, onClose, onConfirm, pastOnly }: {
  open: boolean
  initialDate: string
  initialTime: string
  onClose: () => void
  onConfirm: (date: string, time: string) => void
  pastOnly?: boolean
}) {
  const dayItems = useMemo(() => {
    const items: { label: string; value: string }[] = []
    const today = new Date(); today.setHours(0, 0, 0, 0)
    for (let i = 0; i < 90; i++) {
      const d = new Date(today)
      if (pastOnly) {
        d.setDate(today.getDate() - i)
      } else {
        d.setDate(today.getDate() + i)
      }
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      let label: string
      if (i === 0) label = "Aujourd'hui"
      else if (i === 1) label = pastOnly ? "Hier" : "Demain"
      else {
        const w = d.toLocaleDateString("fr-FR", { weekday: "short" })
        const wd = w.charAt(0).toUpperCase() + w.slice(1)
        const mo = d.toLocaleDateString("fr-FR", { month: "short" })
        label = `${wd} ${d.getDate()} ${mo}`
      }
      items.push({ label, value })
    }
    return items
  }, [pastOnly])

  const hourItems = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")), [])
  const minItems = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))

  const initDay = useMemo(() => { const i = dayItems.findIndex(d => d.value === initialDate); return i >= 0 ? i : 0 }, [initialDate, dayItems])
  const initHour = useMemo(() => { if (!initialTime) return 8; return Math.max(0, Math.min(23, parseInt(initialTime.split(":")[0] || "8", 10))) }, [initialTime])
  const initMin = useMemo(() => {
    if (!initialTime) return 0
    const m = parseInt(initialTime.split(":")[1] || "0", 10)
    const rounded = Math.round(m / 5) * 5 % 60
    const idx = minItems.indexOf(String(rounded).padStart(2, "0"))
    return Math.max(0, idx)
  }, [initialTime, minItems])

  const [dayIdx, setDayIdx] = useState(initDay)
  const [hourIdx, setHourIdx] = useState(initHour)
  const [minIdx, setMinIdx] = useState(initMin)

  useEffect(() => {
    if (!open) return
    setDayIdx(initDay); setHourIdx(initHour); setMinIdx(initMin)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] bg-black/60 flex items-end justify-center" onClick={onClose}>
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="w-full max-w-md bg-[#1a1a1a] rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3" />
            <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground/60 pt-3 pb-1 px-5">
              Choisir la date et l'heure
            </p>
            <div className="grid grid-cols-3 px-4 mb-1">
              {["Jour", "Heure", "Min"].map(h => (
                <p key={h} className="text-center text-[10px] text-muted-foreground/50 uppercase tracking-wider">{h}</p>
              ))}
            </div>
            <div className="flex gap-1 px-2 pb-2">
              <ScrollColumn key={`day-${String(open)}`} items={dayItems.map(d => d.label)} initialIndex={dayIdx} onSelect={setDayIdx} />
              <ScrollColumn key={`h-${String(open)}`} items={hourItems} initialIndex={hourIdx} onSelect={setHourIdx} />
              <ScrollColumn key={`m-${String(open)}`} items={minItems} initialIndex={minIdx} onSelect={setMinIdx} />
            </div>
            <div className="flex gap-3 px-4 pb-6 pt-1">
              <button onClick={onClose}
                className="flex-1 py-3.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-muted-foreground font-semibold">
                Annuler
              </button>
              <button onClick={() => {
                const date = dayItems[dayIdx]?.value ?? ""
                const time = `${hourItems[hourIdx]}:${minItems[minIdx]}`
                onConfirm(date, time)
              }} className="flex-1 py-3.5 rounded-xl bg-gold text-black text-sm font-bold">
                OK
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

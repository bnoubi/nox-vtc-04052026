'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface SupportStatsData {
  kpi: {
    total: number
    open: number
    in_progress: number
    resolved: number
    closed: number
    urgent: number
    stale_open: number
  }
  avgResponseHours: number | null
  byCategory: { category: string; count: number }[]
  byWeek: { week: string; count: number }[]
  topUsers: { user_id: string; name: string; email: string; count: number }[]
}

function formatHours(h: number): string {
  if (h >= 48) return `${Math.round(h / 24)} jours`
  const hours = Math.floor(h)
  const mins = Math.round((h - hours) * 60)
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}min`
}

const card = (bg: string, border: string) => ({
  backgroundColor: bg,
  borderColor: border,
})

const CHART_COLORS = {
  stroke: 'rgba(197,160,89,0.08)',
  axis: 'rgba(255,255,255,0.35)',
  grid: 'rgba(255,255,255,0.06)',
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 text-xs" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)', color: 'var(--admin-foreground)' }}>
      <p className="font-medium mb-0.5">{label}</p>
      <p style={{ color: '#C5A059' }}>{payload[0].value} ticket{payload[0].value > 1 ? 's' : ''}</p>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: number | string
  sub?: string
  alert?: boolean
  gold?: boolean
}

function KpiCard({ label, value, sub, alert, gold }: KpiCardProps) {
  const base = 'rounded-xl border p-4 space-y-1'
  if (alert) return (
    <div className={`${base} border-red-500/30`} style={{ backgroundColor: 'rgba(239,68,68,0.08)' }}>
      <div className="flex items-center gap-1.5">
        <AlertTriangle size={13} className="text-red-400 shrink-0" />
        <p className="text-xs font-medium text-red-400">{label}</p>
      </div>
      <p className="text-2xl font-bold text-red-400">{value}</p>
      {sub && <p className="text-[10px] text-red-400/60">{sub}</p>}
    </div>
  )
  if (gold) return (
    <div className={base} style={{ backgroundColor: 'rgba(197,160,89,0.08)', borderColor: 'rgba(197,160,89,0.25)' }}>
      <div className="flex items-center gap-1.5">
        <Clock size={13} style={{ color: '#C5A059' }} className="shrink-0" />
        <p className="text-xs font-medium" style={{ color: '#C5A059' }}>{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{ color: '#C5A059' }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: 'rgba(197,160,89,0.6)' }}>{sub}</p>}
    </div>
  )
  return (
    <div className={base} style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
      <p className="text-xs font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: 'var(--admin-foreground)' }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: 'var(--admin-muted-foreground)' }}>{sub}</p>}
    </div>
  )
}

export function SupportStats({ data }: { data: SupportStatsData }) {
  const [open, setOpen] = useState(true)
  const { kpi, avgResponseHours, byCategory, byWeek, topUsers } = data

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-[var(--admin-active-bg)]"
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--admin-foreground)' }}>
          Statistiques des tickets
        </span>
        {open ? <ChevronUp size={16} style={{ color: 'var(--admin-muted-foreground)' }} /> : <ChevronDown size={16} style={{ color: 'var(--admin-muted-foreground)' }} />}
      </button>

      {open && (
        <div className="border-t px-5 pb-5 pt-4 space-y-6" style={{ borderColor: 'var(--admin-border)' }}>

          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total" value={kpi.total} sub="tous statuts" />
            <KpiCard label="En attente" value={kpi.open} />
            <KpiCard label="En cours" value={kpi.in_progress} />
            <KpiCard label="Résolus" value={kpi.resolved} />
            <KpiCard label="Fermés" value={kpi.closed} />
            <KpiCard
              label="Urgents"
              value={kpi.urgent}
              alert={kpi.urgent > 0}
            />
            <KpiCard
              label="+48h sans réponse"
              value={kpi.stale_open}
              alert={kpi.stale_open > 0}
              sub="tickets ouverts"
            />
            <KpiCard
              label="Tps de réponse moyen"
              value={avgResponseHours !== null ? formatHours(avgResponseHours) : '—'}
              sub={avgResponseHours !== null ? 'sur tickets résolus' : 'aucun ticket résolu'}
              gold
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Bar chart : par catégorie */}
            <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--admin-muted-foreground)' }}>
                Tickets par catégorie
              </p>
              {byCategory.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--admin-muted-foreground)' }}>Aucune donnée</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, byCategory.length * 36)}>
                  <BarChart data={byCategory} layout="vertical" margin={{ left: 4, right: 20, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: CHART_COLORS.axis }} width={110} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(197,160,89,0.06)' }} />
                    <Bar dataKey="count" fill="#C5A059" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Line chart : évolution */}
            <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--admin-muted-foreground)' }}>
                Évolution des tickets (8 dernières semaines)
              </p>
              {byWeek.every(w => w.count === 0) ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--admin-muted-foreground)' }}>Aucune donnée</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={byWeek} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: CHART_COLORS.axis }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.axis }} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(197,160,89,0.2)', strokeWidth: 1 }} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#C5A059"
                      strokeWidth={2}
                      dot={{ fill: '#C5A059', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#C5A059' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top abonnés */}
          {topUsers.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--admin-background)', borderColor: 'var(--admin-border)' }}>
              <p className="text-xs font-semibold px-4 py-3 border-b" style={{ color: 'var(--admin-muted-foreground)', borderColor: 'var(--admin-border)' }}>
                Top 5 abonnés (par nombre de tickets)
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {topUsers.map((u, i) => (
                    <tr key={u.user_id} style={{ borderBottom: i < topUsers.length - 1 ? '1px solid var(--admin-border)' : undefined }}>
                      <td className="px-4 py-2.5 w-8 text-xs font-bold" style={{ color: 'var(--admin-muted-foreground)' }}>
                        #{i + 1}
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="text-sm font-medium" style={{ color: 'var(--admin-foreground)' }}>{u.name}</p>
                        <p className="text-xs" style={{ color: 'var(--admin-muted-foreground)' }}>{u.email}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm font-bold" style={{ color: '#C5A059' }}>{u.count}</span>
                        <span className="text-xs ml-1" style={{ color: 'var(--admin-muted-foreground)' }}>ticket{u.count > 1 ? 's' : ''}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

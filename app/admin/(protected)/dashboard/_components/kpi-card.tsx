import { type LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  icon: LucideIcon
  current: number | null
  previous: number | null
  format?: 'number' | 'currency'
}

function formatValue(value: number, format: 'number' | 'currency'): string {
  if (format === 'currency') {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
  }
  return new Intl.NumberFormat('fr-FR').format(value)
}

function Variation({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null

  if (previous === 0) {
    if (current === 0) return <span style={{ color: 'var(--admin-muted-foreground)' }} className="text-xs">Stable</span>
    return <span style={{ color: 'var(--admin-success)' }} className="text-xs font-medium">+{current} nouveau{current > 1 ? 'x' : ''}</span>
  }

  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return <span style={{ color: 'var(--admin-muted-foreground)' }} className="text-xs">Stable</span>

  return (
    <span
      className="text-xs font-medium"
      style={{ color: pct > 0 ? 'var(--admin-success)' : 'var(--admin-destructive)' }}
    >
      {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}% vs mois dernier
    </span>
  )
}

export function KpiCard({ label, icon: Icon, current, previous, format = 'number' }: KpiCardProps) {
  const unavailable = current === null

  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: 'var(--admin-muted-foreground)' }}>
          {label}
        </span>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'var(--admin-active-bg)', color: 'var(--admin-primary)' }}
        >
          <Icon size={18} />
        </div>
      </div>

      {unavailable ? (
        <p className="text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>
          Données indisponibles
        </p>
      ) : (
        <>
          <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--admin-foreground)' }}>
            {formatValue(current, format)}
          </p>
          <Variation current={current} previous={previous} />
        </>
      )}
    </div>
  )
}

export function KpiCardSkeleton() {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3 animate-pulse"
      style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded" style={{ backgroundColor: 'var(--admin-border)' }} />
        <div className="w-9 h-9 rounded-lg" style={{ backgroundColor: 'var(--admin-border)' }} />
      </div>
      <div className="h-9 w-20 rounded" style={{ backgroundColor: 'var(--admin-border)' }} />
      <div className="h-4 w-36 rounded" style={{ backgroundColor: 'var(--admin-border)' }} />
    </div>
  )
}

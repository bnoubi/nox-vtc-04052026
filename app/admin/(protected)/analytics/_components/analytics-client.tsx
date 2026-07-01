'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Euro, Users, AlertTriangle, TrendingUp, BarChart2, Ticket, Zap, UserX } from 'lucide-react'
import type { AnalyticsData } from '@/app/admin/analytics-data'

// ─── Auto-refresh ─────────────────────────────────────────────────────────────

function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, router])
  return null
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-5 ${className}`}
      style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
    >
      {children}
    </div>
  )
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} style={{ color: 'var(--admin-primary)' }} />
      <h3 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--admin-muted-foreground)' }}>
        {label}
      </h3>
    </div>
  )
}

function KpiTile({
  label, value, sub, badge,
}: {
  label: string
  value: string
  sub?: string
  badge?: { text: string; variant: 'red' | 'orange' | 'green' }
}) {
  const badgeColor = {
    red: '#ef4444',
    orange: '#f97316',
    green: 'var(--admin-success)',
  }
  return (
    <Card>
      <p className="text-sm font-medium mb-2" style={{ color: 'var(--admin-muted-foreground)' }}>{label}</p>
      <p className="text-3xl font-bold tracking-tight" style={{ color: 'var(--admin-foreground)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>{sub}</p>}
      {badge && (
        <span
          className="inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: badgeColor[badge.variant] }}
        >
          {badge.text}
        </span>
      )}
    </Card>
  )
}

function ProgressBar({ value, max, color = 'var(--admin-primary)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--admin-border)' }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs w-8 text-right" style={{ color: 'var(--admin-muted-foreground)' }}>{pct}%</span>
    </div>
  )
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr>
        {cols.map(c => (
          <th key={c} className="text-left text-xs font-semibold pb-2 pr-4"
            style={{ color: 'var(--admin-muted-foreground)', borderBottom: '1px solid var(--admin-border)' }}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const fetchedAt = new Date(data.fetchedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  const mrrFormatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(data.mrr)

  const totalPlans = data.planDistribution.reduce((s, p) => s + p.count, 0)
  const planColors: Record<string, string> = { solo: '#6B7280', duo: '#3B82F6', team: '#C5A059' }

  // Status labels
  const statusLabel: Record<string, string> = {
    suspended: 'Suspendu',
    deleted: 'Supprimé',
    pending_deletion: 'En attente suppression',
  }

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={60_000} />

      {/* ── SECTION 1 : KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiTile
          label="MRR actuel"
          value={mrrFormatted}
          sub="abonnements actifs payants"
        />
        <KpiTile
          label="Abonnés actifs + essai"
          value={new Intl.NumberFormat('fr-FR').format(data.totalActiveSubscribers)}
          sub={`${data.conversion.paidSubscribers} payants`}
        />
        <KpiTile
          label="Pending deletion"
          value={String(data.pendingDeletionCount)}
          sub="comptes en attente de suppression"
          badge={data.pendingDeletionCount > 0 ? { text: `${data.pendingDeletionCount} compte${data.pendingDeletionCount > 1 ? 's' : ''}`, variant: 'red' } : undefined}
        />
        <KpiTile
          label="Taux de conversion"
          value={`${data.conversion.rate}%`}
          sub={`${data.conversion.paidSubscribers} / ${data.conversion.totalAccounts} comptes`}
        />
      </div>

      {/* ── SECTION 2 : Répartition plans ────────────────────────────────── */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {data.planDistribution.map(p => (
            <Card key={p.plan}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold" style={{ color: 'var(--admin-foreground)' }}>{p.label}</span>
                <span className="text-2xl font-bold" style={{ color: planColors[p.plan] ?? 'var(--admin-primary)' }}>
                  {p.count}
                </span>
              </div>
              <ProgressBar value={p.count} max={totalPlans} color={planColors[p.plan] ?? 'var(--admin-primary)'} />
              <p className="text-xs mt-2" style={{ color: 'var(--admin-muted-foreground)' }}>
                abonné{p.count > 1 ? 's' : ''} · {totalPlans > 0 ? Math.round((p.count / totalPlans) * 100) : 0}% du total
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* ── SECTION 3 : Évolution (2 colonnes) ───────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Inscriptions */}
        <Card>
          <SectionTitle icon={Users} label="Inscriptions par mois" />
          <table className="w-full text-sm">
            <TableHeader cols={['Mois', 'Nouveaux inscrits']} />
            <tbody>
              {data.inscriptionsByMonth.map(row => (
                <tr key={row.month}>
                  <td className="py-1.5 pr-4 capitalize" style={{ color: 'var(--admin-foreground)' }}>{row.month}</td>
                  <td className="py-1.5 font-semibold" style={{ color: 'var(--admin-foreground)' }}>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Achats jetons */}
        <Card>
          <SectionTitle icon={Zap} label="Achats de jetons par mois" />
          <table className="w-full text-sm">
            <TableHeader cols={['Mois', 'Achats', 'Montant TTC']} />
            <tbody>
              {data.tokenPurchasesByMonth.map(row => (
                <tr key={row.month}>
                  <td className="py-1.5 pr-4 capitalize" style={{ color: 'var(--admin-foreground)' }}>{row.month}</td>
                  <td className="py-1.5 pr-4" style={{ color: 'var(--admin-foreground)' }}>{row.count}</td>
                  <td className="py-1.5 font-semibold" style={{ color: 'var(--admin-foreground)' }}>
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(row.amount ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ── SECTION 4 : Support ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Par statut + délai */}
        <Card>
          <SectionTitle icon={Ticket} label="Tickets de support — statuts" />
          <div className="space-y-3 text-sm">
            {([
              ['open', 'Ouverts', data.ticketStats.byStatus.open],
              ['in_progress', 'En cours', data.ticketStats.byStatus.in_progress],
              ['closed', 'Fermés', data.ticketStats.byStatus.closed],
            ] as [string, string, number][]).map(([key, label, count]) => (
              <div key={key} className="flex items-center justify-between">
                <span style={{ color: 'var(--admin-muted-foreground)' }}>{label}</span>
                <span className="font-semibold" style={{ color: 'var(--admin-foreground)' }}>{count}</span>
              </div>
            ))}
            <div className="pt-2 border-t" style={{ borderColor: 'var(--admin-border)' }}>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--admin-muted-foreground)' }}>Délai moyen résolution</span>
                <span className="font-semibold" style={{ color: 'var(--admin-foreground)' }}>
                  {data.ticketStats.avgResolutionDays !== null
                    ? `${data.ticketStats.avgResolutionDays}j`
                    : '—'}
                </span>
              </div>
            </div>
            {data.ticketStats.overdueCount > 0 && (
              <div
                className="flex items-center gap-2 mt-3 rounded-lg px-3 py-2 text-sm font-medium"
                style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
              >
                <AlertTriangle size={15} />
                {data.ticketStats.overdueCount} ticket{data.ticketStats.overdueCount > 1 ? 's' : ''} sans résolution depuis &gt; 7 jours
              </div>
            )}
          </div>
        </Card>

        {/* Par priorité */}
        <Card>
          <SectionTitle icon={BarChart2} label="Tickets de support — priorités" />
          <div className="space-y-3 text-sm">
            {([
              ['high',   'Haute',   data.ticketStats.byPriority.high,   '#ef4444'],
              ['normal', 'Normale', data.ticketStats.byPriority.normal, '#f97316'],
              ['low',    'Basse',   data.ticketStats.byPriority.low,    '#6B7280'],
            ] as [string, string, number, string][]).map(([key, label, count, color]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: 'var(--admin-muted-foreground)' }}>{label}</span>
                  <span className="font-semibold" style={{ color: 'var(--admin-foreground)' }}>{count}</span>
                </div>
                <ProgressBar
                  value={count}
                  max={data.ticketStats.byPriority.high + data.ticketStats.byPriority.normal + data.ticketStats.byPriority.low}
                  color={color}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── SECTION 5 : Alertes & attention ──────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top 5 consommateurs */}
        <Card>
          <SectionTitle icon={TrendingUp} label="Top 5 consommateurs de jetons" />
          {data.topConsumers.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>Aucune donnée</p>
          ) : (
            <table className="w-full text-sm">
              <TableHeader cols={['Utilisateur', 'Jetons consommés']} />
              <tbody>
                {data.topConsumers.map((u, i) => (
                  <tr key={u.email}>
                    <td className="py-1.5 pr-4 truncate max-w-[200px]" style={{ color: 'var(--admin-foreground)' }}>
                      <span className="text-xs mr-2" style={{ color: 'var(--admin-muted-foreground)' }}>#{i + 1}</span>
                      {u.email}
                    </td>
                    <td className="py-1.5 font-semibold" style={{ color: 'var(--admin-primary)' }}>
                      {new Intl.NumberFormat('fr-FR').format(u.consumed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Comptes suspendus + pending deletion */}
        <div className="space-y-4">
          <Card>
            <SectionTitle icon={UserX} label="Comptes suspendus / supprimés ce mois" />
            {data.accountStatusThisMonth.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--admin-muted-foreground)' }}>Aucun ce mois</p>
            ) : (
              <div className="space-y-2 text-sm">
                {data.accountStatusThisMonth.map(row => (
                  <div key={row.status} className="flex items-center justify-between">
                    <span style={{ color: 'var(--admin-muted-foreground)' }}>
                      {statusLabel[row.status] ?? row.status}
                    </span>
                    <span className="font-semibold" style={{ color: 'var(--admin-foreground)' }}>{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {data.pendingDeletionCount > 0 && (
            <div
              className="rounded-xl border p-4 flex items-start gap-3"
              style={{ backgroundColor: '#f9731610', borderColor: '#f97316' }}
            >
              <AlertTriangle size={18} style={{ color: '#f97316', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="font-semibold text-sm" style={{ color: '#f97316' }}>
                  {data.pendingDeletionCount} compte{data.pendingDeletionCount > 1 ? 's' : ''} en attente de suppression
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--admin-muted-foreground)' }}>
                  Ces comptes seront supprimés définitivement à l'expiration du délai RGPD (30 jours).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-right" style={{ color: 'var(--admin-muted-foreground)' }}>
        Dernière mise à jour : {fetchedAt} · Actualisation automatique toutes les 60 s
      </p>
    </div>
  )
}

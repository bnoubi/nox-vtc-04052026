import { Suspense } from 'react'
import { getAdminAnalytics, type AnalyticsData } from '@/app/admin/analytics-data'
import { AutoRefresh } from '../dashboard/_components/auto-refresh'
import { AnalyticsClient } from './_components/analytics-client'

async function AnalyticsLoader() {
  const data: AnalyticsData = await getAdminAnalytics()
  return <AnalyticsClient data={data} />
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-5 h-28"
            style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }} />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-5 h-40"
          style={{ backgroundColor: 'var(--admin-card)', borderColor: 'var(--admin-border)' }} />
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={60_000} />

      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-foreground)' }}>
          Analytics
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
          Métriques business en temps réel
        </p>
      </div>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsLoader />
      </Suspense>
    </div>
  )
}

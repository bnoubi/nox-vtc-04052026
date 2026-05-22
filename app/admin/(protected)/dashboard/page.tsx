import { Suspense } from 'react'
import {
  Users, Clock, UserX, Zap, TrendingDown, Euro, FileText, UserPlus,
} from 'lucide-react'
import { getAdminKPIs, type AdminKPIs } from '@/app/admin/actions'
import { KpiCard, KpiCardSkeleton } from './_components/kpi-card'
import { AutoRefresh } from './_components/auto-refresh'

// ─── Grille squelette (affiché pendant le chargement serveur) ─────────────────

function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => <KpiCardSkeleton key={i} />)}
    </div>
  )
}

// ─── Grille KPI (données réelles) ─────────────────────────────────────────────

function KpiGrid({ data }: { data: AdminKPIs }) {
  const fetchedAt = new Date(data.fetchedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Abonnés actifs"
          icon={Users}
          current={data.abonnesActifs.current}
          previous={data.abonnesActifs.previous}
        />
        <KpiCard
          label="Période d'essai"
          icon={Clock}
          current={data.abonnesEssai.current}
          previous={data.abonnesEssai.previous}
        />
        <KpiCard
          label="Expirés ce mois"
          icon={UserX}
          current={data.abonnesExpires.current}
          previous={data.abonnesExpires.previous}
        />
        <KpiCard
          label="Jetons vendus ce mois"
          icon={Zap}
          current={data.jetonsVendus.current}
          previous={data.jetonsVendus.previous}
        />
        <KpiCard
          label="Jetons consommés ce mois"
          icon={TrendingDown}
          current={data.jetonsConsommes.current}
          previous={data.jetonsConsommes.previous}
        />
        <KpiCard
          label="Revenus du mois"
          icon={Euro}
          current={data.revenus.current}
          previous={data.revenus.previous}
          format="currency"
        />
        <KpiCard
          label="BCs générés ce mois"
          icon={FileText}
          current={data.bcsCount.current}
          previous={data.bcsCount.previous}
        />
        <KpiCard
          label="Nouveaux inscrits ce mois"
          icon={UserPlus}
          current={data.nouveauxInscrits.current}
          previous={data.nouveauxInscrits.previous}
        />
      </div>
      <p className="text-xs text-right" style={{ color: 'var(--admin-muted-foreground)' }}>
        Dernière mise à jour : {fetchedAt} · Actualisation automatique toutes les 60 s
      </p>
    </div>
  )
}

// ─── Composant async interne (déclenche le fetch côté serveur) ─────────────────

async function KpiDataLoader() {
  const data = await getAdminKPIs()
  return <KpiGrid data={data} />
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={60_000} />

      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-foreground)' }}>
          Tableau de bord
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
          Vue d'ensemble de l'activité NoX VTC
        </p>
      </div>

      <Suspense fallback={<KpiGridSkeleton />}>
        <KpiDataLoader />
      </Suspense>
    </div>
  )
}

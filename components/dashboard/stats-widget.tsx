"use client"

import dynamic from "next/dynamic"

const RevenueChart = dynamic(
  () => import("./charts").then((mod) => mod.RevenueChart),
  { ssr: false, loading: () => <div className="w-full h-full bg-onyx-border/20 rounded animate-pulse" /> }
)

const CancellationChart = dynamic(
  () => import("./charts").then((mod) => mod.CancellationChart),
  { ssr: false, loading: () => <div className="w-full h-full bg-onyx-border/20 rounded-full animate-pulse" /> }
)

const revenueData = [
  { day: "Mon", amount: 1200 },
  { day: "Tue", amount: 1800 },
  { day: "Wed", amount: 1400 },
  { day: "Thu", amount: 2200 },
  { day: "Fri", amount: 1900 },
  { day: "Sat", amount: 2800 },
  { day: "Sun", amount: 2400 },
]

const cancellationData = [
  { name: "Client", value: 45, color: "#C5A059" },
  { name: "Chauffeur", value: 25, color: "#666666" },
  { name: "Météo", value: 15, color: "#444444" },
  { name: "Autre", value: 15, color: "#333333" },
]

export function StatsWidget() {
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.amount, 0)
  const avgRevenue = Math.round(totalRevenue / revenueData.length)

  return (
    <section className="px-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Statistiques</h2>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Revenue Chart */}
        <div className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Chiffre d{"'"}Affaires</span>
            <span className="text-xs font-medium text-emerald-400">+12%</span>
          </div>
          <p className="text-lg font-bold text-foreground mb-2">
            {new Intl.NumberFormat("fr-FR").format(avgRevenue)}€
            <span className="text-xs text-muted-foreground font-normal ml-1">/jour</span>
          </p>
          <div className="h-16 -mx-2">
            <RevenueChart data={revenueData} />
          </div>
        </div>

        {/* Cancellation Motifs */}
        <div className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Annulations</span>
            <span className="text-xs font-medium text-muted-foreground">Ce mois</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-16 w-16">
              <CancellationChart data={cancellationData} />
            </div>
            <div className="flex flex-col gap-1">
              {cancellationData.slice(0, 3).map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

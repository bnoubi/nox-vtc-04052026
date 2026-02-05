"use client"

import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

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
  { name: "Driver", value: 25, color: "#666666" },
  { name: "Weather", value: 15, color: "#444444" },
  { name: "Other", value: 15, color: "#333333" },
]

export function StatsWidget() {
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.amount, 0)
  const avgRevenue = Math.round(totalRevenue / revenueData.length)

  return (
    <section className="px-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Statistics</h2>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Revenue Chart */}
        <div className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Revenue</span>
            <span className="text-xs font-medium text-emerald-400">+12%</span>
          </div>
          <p className="text-lg font-bold text-foreground mb-2">
            {new Intl.NumberFormat("fr-FR").format(avgRevenue)}€
            <span className="text-xs text-muted-foreground font-normal ml-1">/day</span>
          </p>
          <div className="h-16 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C5A059" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#C5A059" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#C5A059"
                  strokeWidth={1.5}
                  fill="url(#goldGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cancellation Motifs */}
        <div className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Cancellations</span>
            <span className="text-xs font-medium text-muted-foreground">This month</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-16 w-16">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cancellationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={18}
                    outerRadius={30}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {cancellationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
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

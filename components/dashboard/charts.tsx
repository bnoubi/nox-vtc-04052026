"use client"

import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

interface RevenueChartProps {
  data: { day: string; amount: number }[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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
  )
}

interface CancellationChartProps {
  data: { name: string; value: number; color: string }[]
}

export function CancellationChart({ data }: CancellationChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={18}
          outerRadius={30}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}

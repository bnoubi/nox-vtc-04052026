"use client"

import { DashboardHeader } from "./header"
import { GuardianScore } from "./guardian-score"
import { QuickActions } from "./quick-actions"
import { UpcomingTrips } from "./upcoming-trips"
import { StatsWidget } from "./stats-widget"

export function DashboardTab() {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <DashboardHeader />
      <div className="space-y-6 pt-2 pb-8">
        <GuardianScore />
        <QuickActions />
        <UpcomingTrips />
        <StatsWidget />
      </div>
    </div>
  )
}

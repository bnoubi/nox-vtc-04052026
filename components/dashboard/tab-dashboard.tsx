"use client"

import { DashboardHeader } from "./header"
import { GuardianScore } from "./guardian-score"
import { QuickActions } from "./quick-actions"
import { UpcomingTrips } from "./upcoming-trips"
import { StatsWidget } from "./stats-widget"
import { NextTripWidget } from "./next-trip-widget"
import { TokenCard } from "./token-card"
import { useNav } from "./nav-context"
import { useNox } from "./nox-context"

export function DashboardTab() {
  const { navigateToEntity } = useNav()
  const { plan } = useNox()

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <DashboardHeader />
      <div className="space-y-6 pt-2 pb-8">
        <GuardianScore onNavigateToEntity={navigateToEntity} />
        <QuickActions />
        <NextTripWidget />
        <UpcomingTrips />
        <StatsWidget />
        {plan === "SOLO" && <TokenCard />}
      </div>
    </div>
  )
}

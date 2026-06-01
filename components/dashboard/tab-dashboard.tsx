"use client"

import { useEffect } from "react"
import { DashboardHeader } from "./header"
import { GuardianScore } from "./guardian-score"
import { QuickActions } from "./quick-actions"
import { UpcomingTrips } from "./upcoming-trips"
import { StatsWidget } from "./stats-widget"
import { NextTripWidget } from "./next-trip-widget"
import { TokenCard } from "./token-card"
import { TripRequestsWidget } from "./trip-requests-widget"
import { useNav } from "./nav-context"
import { useNox } from "./nox-context"

export function DashboardTab() {
  const { navigateToEntity } = useNav()
  const { plan, tripRequests, loadTripRequests } = useNox()

  useEffect(() => {
    void loadTripRequests()
  }, [loadTripRequests])

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <DashboardHeader />
      <div className="space-y-6 pt-2 pb-8">
        <GuardianScore onNavigateToEntity={navigateToEntity} />
        <QuickActions />
        <NextTripWidget />
        <UpcomingTrips />
        {tripRequests.length > 0 && <TripRequestsWidget />}
        <StatsWidget />
        {plan === "SOLO" && <TokenCard />}
      </div>
    </div>
  )
}

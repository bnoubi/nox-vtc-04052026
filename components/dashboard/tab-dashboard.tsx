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
  const { navigateToEntity, navigateToSubscription } = useNav()
  const { plan, tripRequests, loadTripRequests, subscriptionStatus, trialEndsAt } = useNox()

  const isTrial = subscriptionStatus === "trial"
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil(
        (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : 0

  useEffect(() => {
    void loadTripRequests()
  }, [loadTripRequests])

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <DashboardHeader />
      <div className="space-y-6 pt-2 pb-8">
        <GuardianScore onNavigateToEntity={navigateToEntity} />
        {isTrial && trialDaysLeft <= 3 && (
          <div className="mx-4 mb-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-amber-400">
                Votre essai se termine dans {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Choisissez votre offre pour continuer
              </p>
            </div>
            <button
              onClick={() => navigateToSubscription()}
              className="px-3 py-1.5 rounded-xl bg-gold text-black text-[11px] font-bold shrink-0"
            >
              Voir les offres
            </button>
          </div>
        )}
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

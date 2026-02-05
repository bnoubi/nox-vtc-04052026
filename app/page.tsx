import { DashboardHeader } from "@/components/dashboard/header"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { UpcomingTrips } from "@/components/dashboard/upcoming-trips"
import { StatsWidget } from "@/components/dashboard/stats-widget"
import { BottomNav } from "@/components/dashboard/bottom-nav"
import { SecurityBadge } from "@/components/dashboard/security-badge"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background pb-36">
      {/* Subtle gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-gold/[0.02] to-transparent pointer-events-none" />
      
      <div className="relative max-w-md mx-auto">
        {/* Header */}
        <DashboardHeader />

        {/* Content */}
        <div className="space-y-6 pt-2">
          {/* Quick Actions */}
          <QuickActions />

          {/* Upcoming Trips */}
          <UpcomingTrips />

          {/* Stats */}
          <StatsWidget />
        </div>
      </div>

      {/* Security Badge */}
      <SecurityBadge />

      {/* Bottom Navigation */}
      <BottomNav />
    </main>
  )
}

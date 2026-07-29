import { SubscriptionsTable } from './_components/subscriptions-table'
import { SubscriptionPlansManager } from './_components/subscription-plans-manager'

export default function SubscriptionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-foreground)' }}>
          Abonnements
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
          Gestion des abonnements actifs sur NoX VTC
        </p>
      </div>
      <SubscriptionPlansManager />
      <SubscriptionsTable />
    </div>
  )
}

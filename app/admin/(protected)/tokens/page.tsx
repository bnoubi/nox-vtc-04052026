import { TokensTable } from './_components/tokens-table'

export default function TokensPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-foreground)' }}>
          Jetons
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
          Soldes et transactions de jetons des abonnés
        </p>
      </div>
      <TokensTable />
    </div>
  )
}

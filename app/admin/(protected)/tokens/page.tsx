import { TokensTable } from './_components/tokens-table'
import { TokenPacksManager } from './_components/token-packs-manager'

export default function TokensPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-foreground)' }}>
          Jetons
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
          Soldes et transactions de jetons des abonnes
        </p>
      </div>
      <TokenPacksManager />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--admin-muted-foreground)' }}>
          Soldes par abonne
        </p>
        <TokensTable />
      </div>
    </div>
  )
}

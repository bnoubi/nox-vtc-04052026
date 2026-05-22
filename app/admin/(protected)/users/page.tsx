import { UsersTable } from './_components/users-table'

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-foreground)' }}>
          Utilisateurs
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
          Gestion des comptes chauffeurs inscrits sur NoX VTC
        </p>
      </div>
      <UsersTable />
    </div>
  )
}

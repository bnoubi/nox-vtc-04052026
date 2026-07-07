import { verifyAdminPermission } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { TeamClient } from './_components/team-client'

export default async function TeamPage() {
  const auth = await verifyAdminPermission('admins.read')
  if (!auth.authorized) redirect('/admin/dashboard')

  const isSuperAdmin = auth.permissions.includes('*')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--admin-foreground)' }}>
          Équipe Admin
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--admin-muted-foreground)' }}>
          Gestion des accès au back-office NoX VTC
        </p>
      </div>
      <TeamClient isSuperAdmin={isSuperAdmin} />
    </div>
  )
}

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminThemeProvider } from '@/lib/theme/admin-theme-context'
import { AdminShell } from './_components/admin-shell'
import '../admin-globals.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Garde de sécurité (défense en profondeur — le middleware est la 1ère ligne)
  if (!user) {
    redirect('/admin/login?error=unauthorized')
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Vérifie la présence dans user_roles — tous rôles acceptés (admin, super_admin, support, finance)
  const { data: role } = await adminClient
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!role) {
    // Journalise la tentative (admin_id = ID de l'acteur non-admin, contrainte NOT NULL oblige)
    await adminClient.from('admin_logs').insert({
      admin_id: user.id,
      action: 'unauthorized_access_attempt',
      new_values: { user_id: user.id, reason: 'not_admin' },
    })
    redirect('/admin/login?error=unauthorized')
  }

  let initialTheme: 'dark' | 'light' = 'dark'
  const { data: prefs } = await supabase
    .from('admin_preferences')
    .select('theme')
    .eq('user_id', user.id)
    .maybeSingle()
  if (prefs?.theme === 'light' || prefs?.theme === 'dark') {
    initialTheme = prefs.theme as 'dark' | 'light'
  }

  const { count: openTicketCount } = await adminClient
    .from('support_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')

  const email = user.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <AdminThemeProvider initialTheme={initialTheme}>
      <AdminShell userEmail={email} userInitials={initials} openTicketCount={openTicketCount ?? 0}>
        {children}
      </AdminShell>
    </AdminThemeProvider>
  )
}

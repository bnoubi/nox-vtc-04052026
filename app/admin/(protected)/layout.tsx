import { createClient } from '@/lib/supabase/server'
import { AdminThemeProvider } from '@/lib/theme/admin-theme-context'
import { AdminShell } from './_components/admin-shell'
import '../admin-globals.css'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let initialTheme: 'dark' | 'light' = 'dark'
  if (user) {
    const { data: prefs } = await supabase
      .from('admin_preferences')
      .select('theme')
      .eq('user_id', user.id)
      .maybeSingle()
    if (prefs?.theme === 'light' || prefs?.theme === 'dark') {
      initialTheme = prefs.theme as 'dark' | 'light'
    }
  }

  const email = user?.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <AdminThemeProvider initialTheme={initialTheme}>
      <AdminShell userEmail={email} userInitials={initials}>
        {children}
      </AdminShell>
    </AdminThemeProvider>
  )
}

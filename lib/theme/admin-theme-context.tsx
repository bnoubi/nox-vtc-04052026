'use client'

import { createContext, useContext, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AdminTheme = 'dark' | 'light'

interface AdminThemeContextType {
  theme: AdminTheme
  toggleTheme: () => Promise<void>
}

const AdminThemeContext = createContext<AdminThemeContextType>({
  theme: 'dark',
  toggleTheme: async () => {},
})

export function AdminThemeProvider({
  children,
  initialTheme = 'dark',
}: {
  children: React.ReactNode
  initialTheme?: AdminTheme
}) {
  const [theme, setTheme] = useState<AdminTheme>(initialTheme)

  async function toggleTheme() {
    const newTheme: AdminTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('admin_preferences')
        .upsert({ user_id: user.id, theme: newTheme }, { onConflict: 'user_id' })
    }
  }

  return (
    <AdminThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </AdminThemeContext.Provider>
  )
}

export function useAdminTheme() {
  return useContext(AdminThemeContext)
}

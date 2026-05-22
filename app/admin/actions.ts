'use server'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'

export async function checkAdminRole(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log('[checkAdminRole] UID récupéré:', user?.id ?? 'null (non authentifié)')

  if (!user) return false

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const { data: adminRoles } = await supabaseAdmin
    .from('admin_roles')
    .select('id')
    .in('code', ['admin', 'super_admin'])

  if (!adminRoles?.length) return false

  const adminRoleIds = adminRoles.map((r: { id: string }) => r.id)

  const { data: userRole, error: userRoleError } = await supabaseAdmin
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .in('admin_role_id', adminRoleIds)
    .limit(1)
    .maybeSingle()

  console.log('[checkAdminRole] Résultat requête user_roles:', { userRole, error: userRoleError })

  return !!userRole
}

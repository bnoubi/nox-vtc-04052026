import { createClient } from '@supabase/supabase-js'
import { createClient as createSsrClient } from '@/lib/supabase/server'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type AdminPermissionCheck =
  | { authorized: true; adminId: string; permissions: string[] }
  | { authorized: false; status: 401 | 403 }

/**
 * Vérifie que l'utilisateur courant a un rôle admin ET, si fournie,
 * la permission précise requise.
 *
 * Logique :
 * - permissions contient '*' → super_admin, toujours autorisé
 * - requiredPermission absent → juste vérifier la présence d'un rôle
 * - requiredPermission présent → doit être dans le tableau permissions
 */
export async function verifyAdminPermission(
  requiredPermission?: string
): Promise<AdminPermissionCheck> {
  const supabase = await createSsrClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authorized: false, status: 401 }

  const db = createAdminClient()
  const { data: roleData } = await db
    .from('user_roles')
    .select('admin_roles!admin_role_id(permissions)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!roleData) return { authorized: false, status: 403 }

  // PostgREST retourne le join comme un objet (many→one) mais le type générique
  // inféré est un tableau — on passe par unknown pour typer manuellement.
  const raw = roleData as unknown as { admin_roles: { permissions: string[] } | null }
  const permissions: string[] = raw.admin_roles?.permissions ?? []

  if (
    requiredPermission &&
    !permissions.includes('*') &&
    !permissions.includes(requiredPermission)
  ) {
    return { authorized: false, status: 403 }
  }

  return { authorized: true, adminId: user.id, permissions }
}

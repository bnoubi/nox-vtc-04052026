import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { getAdminKPIs } from '@/app/admin/actions'

export async function GET() {
  // Vérifie que le demandeur est bien un admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const adminDb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
  const { data: adminRoles } = await adminDb.from('admin_roles').select('id').in('code', ['admin', 'super_admin'])
  if (!adminRoles?.length) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const ids = adminRoles.map((r: { id: string }) => r.id)
  const { data: role } = await adminDb.from('user_roles').select('id').eq('user_id', user.id).in('admin_role_id', ids).limit(1).maybeSingle()
  if (!role) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const kpis = await getAdminKPIs()
  return NextResponse.json(kpis)
}

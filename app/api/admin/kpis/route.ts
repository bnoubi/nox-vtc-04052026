import { NextResponse } from 'next/server'
import { verifyAdminPermission } from '@/lib/supabase/admin'
import { getAdminKPIs } from '@/app/admin/actions'

export async function GET() {
  const auth = await verifyAdminPermission('analytics.read')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const kpis = await getAdminKPIs()
  return NextResponse.json(kpis)
}

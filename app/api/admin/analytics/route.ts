import { NextResponse } from 'next/server'
import { verifyAdminPermission } from '@/lib/supabase/admin'
import { getAdminAnalytics } from '@/app/admin/analytics-data'

export async function GET() {
  const auth = await verifyAdminPermission('analytics.read')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorisé' }, { status: auth.status })

  const data = await getAdminAnalytics()
  return NextResponse.json(data)
}

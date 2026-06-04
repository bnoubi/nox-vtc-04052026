import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { trip_id: string; status: 'completed' | 'missed'; notification_id?: string }
  if (!body.trip_id || !body.status) {
    return NextResponse.json({ error: 'Missing trip_id or status' }, { status: 400 })
  }

  const admin = adminClient()

  // Verify trip belongs to this user via contract
  const { data: trip } = await admin
    .from('recurring_trips')
    .select('id, contract_id, recurring_contracts!inner(user_id)')
    .eq('id', body.trip_id)
    .single()

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const contractRaw = trip.recurring_contracts as unknown
  const contract = (Array.isArray(contractRaw) ? contractRaw[0] : contractRaw) as { user_id: string }
  if (contract.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await admin.from('recurring_trips').update({ status: body.status }).eq('id', body.trip_id)

  if (body.notification_id) {
    await admin.from('notifications').update({ read: true }).eq('id', body.notification_id)
  }

  return NextResponse.json({ success: true })
}

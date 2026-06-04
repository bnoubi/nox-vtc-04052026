import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const AUTH = process.env.CRON_SECRET ?? 'nox-cron-f90c40da4c8f9f905b8f510945b30018'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${AUTH}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = adminClient()
  const now = new Date()
  const in30min = new Date(now.getTime() + 30 * 60 * 1000)
  const in35min = new Date(now.getTime() + 35 * 60 * 1000)

  const todayStr = now.toISOString().split('T')[0]
  const in30Time = in30min.toTimeString().substring(0, 5)
  const in35Time = in35min.toTimeString().substring(0, 5)

  try {
    const { data: trips } = await adminSupabase
      .from('recurring_trips')
      .select(`
        *,
        recurring_contracts!inner(
          label, user_id, departure, arrival, numero
        )
      `)
      .eq('status', 'upcoming')
      .eq('trip_date', todayStr)
      .gte('trip_time', in30Time)
      .lte('trip_time', in35Time)
      .is('completion_notified_at', null)

    if (!trips || trips.length === 0) {
      return NextResponse.json({ success: true, notified: 0 })
    }

    for (const trip of trips) {
      const contract = trip.recurring_contracts as {
        label: string; user_id: string; departure: string; arrival: string; numero: string
      }

      await adminSupabase.from('notifications').insert({
        user_id: contract.user_id,
        type: 'trip_reminder',
        title: '🚗 Course dans 30 minutes',
        message: `${contract.departure} → ${contract.arrival} à ${(trip.trip_time as string).substring(0, 5)}`,
        data: { trip_id: trip.id, contract_id: trip.contract_id },
        read: false,
      })

      await adminSupabase
        .from('recurring_trips')
        .update({ completion_notified_at: now.toISOString() })
        .eq('id', trip.id)
    }

    return NextResponse.json({ success: true, notified: trips.length })
  } catch (err) {
    console.error('[cron/trip-reminders]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

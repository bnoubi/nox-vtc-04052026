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
  const secret = req.headers.get('x-cron-secret')
  const bearer = req.headers.get('authorization')
  if (secret !== AUTH && bearer !== `Bearer ${AUTH}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = adminClient()

    const { data, error } = await supabase
      .from('trip_requests')
      .delete()
      .or(`status.eq.expired,and(status.eq.pending,expires_at.lt.${new Date().toISOString()})`)
      .select('id')

    if (error) throw error

    const deleted = data?.length ?? 0
    console.log(`[cron/cleanup-trip-requests] ${deleted} lignes supprimées`)

    return NextResponse.json({ success: true, deleted })
  } catch (err) {
    console.error('[cron/cleanup-trip-requests]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

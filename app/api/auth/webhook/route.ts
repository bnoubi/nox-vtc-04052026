import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const webhookSecret = request.headers.get('x-webhook-secret')
  if (webhookSecret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json()
  const { type, record } = payload

  if (type !== 'INSERT' && type !== 'UPDATE') {
    return NextResponse.json({ ok: true })
  }

  const userId = record?.id
  if (!userId) {
    return NextResponse.json({ ok: true })
  }

  const emailConfirmedAt = record?.email_confirmed_at
  if (!emailConfirmedAt) {
    return NextResponse.json({ ok: true })
  }

  const adminClient = createAdminClient()

  const { data: existingSub } = await adminClient
    .from('subscriptions')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingSub) {
    return NextResponse.json({ ok: true, message: 'Subscription already exists' })
  }

  await adminClient
    .from('wallets')
    .upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })

  const { error } = await adminClient
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan: 'TEAM',
      target_plan: 'solo',
      status: 'trial',
      trial_started_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    })

  if (error) {
    console.error('[Webhook] Erreur création trial:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[Webhook] Trial TEAM créé pour:', userId)
  return NextResponse.json({ ok: true, userId })
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { capturePayPalOrder } from '@/lib/paypal/client'
import { createServerClient } from '@supabase/ssr'

const TOKEN_AMOUNTS: Record<string, number> = {
  pack_decouverte: 5,
  pack_privilege:  15,
  pack_prestige:   25,
}

const schema = z.object({
  orderID:  z.string().min(1),
  itemType: z.enum(['pack_decouverte', 'pack_privilege', 'pack_prestige', 'plan_duo', 'plan_team']),
  userId:   z.string().uuid(),
})

function makeAdminDb() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

async function processCapture(orderID: string, itemType: string, userId: string) {
  const parsed = schema.safeParse({ orderID, itemType, userId })
  if (!parsed.success) return { error: 'Paramètres invalides', status: 400 }

  try {
    await capturePayPalOrder(orderID)
  } catch (err) {
    console.error('[paypal/capture-order] capture error:', err)
    return { error: 'Erreur lors de la capture du paiement', status: 500 }
  }

  const db     = makeAdminDb()
  const isPack = itemType.startsWith('pack_')

  if (isPack) {
    const tokens = TOKEN_AMOUNTS[itemType]

    const { data: wallet } = await db
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .maybeSingle()

    let walletId: string
    let balanceBefore: number
    let balanceAfter: number

    if (wallet) {
      const w       = wallet as { id: string; balance: number }
      walletId      = w.id
      balanceBefore = w.balance
      balanceAfter  = w.balance + tokens
      await db.from('wallets').update({ balance: balanceAfter }).eq('user_id', userId)
    } else {
      balanceBefore = 0
      balanceAfter  = tokens
      const { data: newWallet } = await db
        .from('wallets')
        .insert({ user_id: userId, balance: tokens })
        .select('id')
        .single()
      walletId = (newWallet as { id: string } | null)?.id ?? ''
    }

    await db.from('token_transactions').insert({
      user_id:       userId,
      type:          'purchase',
      amount:        tokens,
      description:   'Achat pack jetons (PayPal)',
      wallet_id:     walletId || null,
      balance_after: balanceAfter,
    })

    return { redirectUrl: `/payment/success?type=token_pack&amount=${tokens}&before=${balanceBefore}&after=${balanceAfter}` }
  }

  // Subscription
  const plan = itemType === 'plan_duo' ? 'DUO' : 'TEAM'

  const { data: existing } = await db
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    await db
      .from('subscriptions')
      .update({ plan, status: 'active' })
      .eq('id', (existing as { id: string }).id)
  } else {
    await db.from('subscriptions').insert({
      user_id:              userId,
      plan,
      status:               'active',
      current_period_start: new Date().toISOString(),
    })
  }

  await db.from('user_accounts').update({ plan }).eq('id', userId)

  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { redirectUrl: `/payment/success?type=subscription&plan=${plan}&valid_until=${validUntil}` }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orderID  = searchParams.get('token')    ?? ''  // PayPal redirects with ?token=ORDER_ID
  const itemType = searchParams.get('itemType') ?? ''
  const userId   = searchParams.get('userId')   ?? ''

  const result = await processCapture(orderID, itemType, userId)

  if ('error' in result) {
    return NextResponse.redirect(new URL(`/?paypal=error&msg=${encodeURIComponent(result.error ?? '')}`, req.url))
  }

  return NextResponse.redirect(new URL(result.redirectUrl, req.url))
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  const { orderID, itemType, userId } = parsed.data
  const result = await processCapture(orderID, itemType, userId)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true, redirectUrl: result.redirectUrl })
}

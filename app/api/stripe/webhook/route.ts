import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServerClient } from '@supabase/ssr'
import Stripe from 'stripe'

const TOKEN_AMOUNTS: Record<string, number> = {
  [process.env.STRIPE_PRICE_PACK_DECOUVERTE ?? '']: 5,
  [process.env.STRIPE_PRICE_PACK_PRIVILEGE   ?? '']: 15,
  [process.env.STRIPE_PRICE_PACK_PRESTIGE    ?? '']: 25,
}

const PLAN_BY_PRICE: Record<string, string> = {
  [process.env.STRIPE_PRICE_DUO  ?? '']: 'DUO',
  [process.env.STRIPE_PRICE_TEAM ?? '']: 'TEAM',
}

function makeAdminDb() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

async function creditTokens(userId: string, priceId: string) {
  const tokens = TOKEN_AMOUNTS[priceId]
  if (!tokens) {
    console.error('[webhook] unknown priceId for token pack:', priceId)
    return
  }

  const db = makeAdminDb()
  const { data: wallet } = await db.from('wallets').select('id, balance').eq('user_id', userId).maybeSingle()

  let walletId: string
  let balanceAfter: number

  if (wallet) {
    const w = wallet as { id: string; balance: number }
    walletId = w.id
    balanceAfter = w.balance + tokens
    await db.from('wallets').update({ balance: balanceAfter }).eq('user_id', userId)
  } else {
    balanceAfter = tokens
    const { data: newWallet } = await db
      .from('wallets')
      .insert({ user_id: userId, balance: tokens })
      .select('id')
      .single()
    walletId = (newWallet as { id: string } | null)?.id ?? ''
  }

  await db.from('token_transactions').insert({
    user_id:      userId,
    type:         'purchase',
    amount:       tokens,
    description:  'Achat pack jetons',
    wallet_id:    walletId || null,
    balance_after: balanceAfter,
  })
}

async function upsertSubscription(userId: string, priceId: string, status: string, stripeSubId: string) {
  const plan = PLAN_BY_PRICE[priceId] ?? 'SOLO'
  const db = makeAdminDb()

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
      .update({ plan, status, stripe_subscription_id: stripeSubId })
      .eq('id', (existing as { id: string }).id)
  } else {
    await db.from('subscriptions').insert({
      user_id: userId, plan, status, stripe_subscription_id: stripeSubId, started_at: new Date().toISOString(),
    })
  }

  await db.from('user_accounts').update({ plan }).eq('id', userId)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId  = session.metadata?.userId
        const priceId = session.metadata?.priceId

        if (!userId || !priceId) break

        if (session.mode === 'payment') {
          await creditTokens(userId, priceId)
        } else if (session.mode === 'subscription' && session.subscription) {
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id
          await upsertSubscription(userId, priceId, 'active', subId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub     = event.data.object as Stripe.Subscription
        const userId  = sub.metadata?.userId
        const priceId = sub.items.data[0]?.price.id

        if (!userId || !priceId) break
        await upsertSubscription(userId, priceId, sub.status, sub.id)
        break
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (!userId) break

        const db = makeAdminDb()
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
            .update({ status: 'expired', ended_at: new Date().toISOString() })
            .eq('id', (existing as { id: string }).id)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const userId  = invoice.parent?.subscription_details?.metadata?.userId as string | undefined

        if (!userId) break

        const db = makeAdminDb()
        await db.from('user_accounts').update({ account_status: 'suspended' }).eq('id', userId)
        break
      }
    }
  } catch (err) {
    console.error('[webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

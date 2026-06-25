import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServerClient } from '@supabase/ssr'
import Stripe from 'stripe'

const TOKEN_AMOUNTS: Record<string, number> = {
  [process.env.STRIPE_PRICE_PACK_DECOUVERTE ?? '']: 10,
  [process.env.STRIPE_PRICE_PACK_PRIVILEGE   ?? '']: 30,
  [process.env.STRIPE_PRICE_PACK_PRESTIGE    ?? '']: 50,
}

function resolvePlan(priceId: string): string {
  const duo  = process.env.STRIPE_PRICE_DUO  ?? ''
  const team = process.env.STRIPE_PRICE_TEAM ?? ''
  console.log('[webhook] resolvePlan — priceId:', priceId, '| STRIPE_PRICE_DUO:', duo || '(empty)', '| STRIPE_PRICE_TEAM:', team || '(empty)')
  if (duo  && priceId === duo)  return 'DUO'
  if (team && priceId === team) return 'TEAM'
  return 'SOLO'
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
    console.error('[webhook] creditTokens — unknown priceId:', priceId)
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
  const plan = resolvePlan(priceId)
  console.log('[webhook] upsertSubscription — userId:', userId, '| priceId:', priceId, '| plan résolu:', plan, '| status:', status, '| stripeSubId:', stripeSubId)

  const db = makeAdminDb()

  const { data: existing, error: selectError } = await db
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (selectError) {
    console.error('[webhook] upsertSubscription — erreur SELECT subscriptions:', selectError)
  }

  console.log('[webhook] upsertSubscription — subscription existante:', existing ?? 'aucune')

  if (existing) {
    const { error: updateSubError } = await db
      .from('subscriptions')
      .update({ plan, status, stripe_subscription_id: stripeSubId })
      .eq('id', (existing as { id: string }).id)
    if (updateSubError) {
      console.error('[webhook] upsertSubscription — erreur UPDATE subscriptions:', updateSubError)
    } else {
      console.log('[webhook] upsertSubscription — subscriptions mis à jour, id:', (existing as { id: string }).id)
    }
  } else {
    const { error: insertSubError } = await db.from('subscriptions').insert({
      user_id: userId, plan, target_plan: 'solo', status, stripe_subscription_id: stripeSubId, current_period_start: new Date().toISOString(),
    })
    if (insertSubError) {
      console.error('[webhook] upsertSubscription — erreur INSERT subscriptions:', insertSubError)
    } else {
      console.log('[webhook] upsertSubscription — subscription insérée')
    }
  }

  const { error: updateAccountError } = await db.from('user_accounts').update({ plan }).eq('id', userId)
  if (updateAccountError) {
    console.error('[webhook] upsertSubscription — erreur UPDATE user_accounts:', updateAccountError)
  } else {
    console.log('[webhook] upsertSubscription — user_accounts.plan mis à jour → ', plan)
  }
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

  console.log('[webhook] event reçu:', event.type)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId  = session.metadata?.userId
        const priceId = session.metadata?.priceId

        console.log('[webhook] checkout.session.completed — mode:', session.mode, '| userId:', userId, '| priceId:', priceId, '| subscription:', session.subscription ?? 'null')

        if (!userId || !priceId) {
          console.error('[webhook] checkout.session.completed — userId ou priceId manquant dans metadata')
          break
        }

        if (session.mode === 'payment') {
          await creditTokens(userId, priceId)
        } else if (session.mode === 'subscription') {
          if (!session.subscription) {
            console.error('[webhook] checkout.session.completed — session.subscription est null (abonnement non créé ?)')
            break
          }
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

        console.log('[webhook] customer.subscription.updated — userId:', userId, '| priceId:', priceId, '| status:', sub.status)

        if (!userId || !priceId) break
        await upsertSubscription(userId, priceId, sub.status, sub.id)
        break
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId

        console.log('[webhook] customer.subscription.deleted — userId:', userId)

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
          const { error } = await db
            .from('subscriptions')
            .update({ status: 'expired', ended_at: new Date().toISOString() })
            .eq('id', (existing as { id: string }).id)
          if (error) console.error('[webhook] customer.subscription.deleted — erreur UPDATE:', error)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const userId  = invoice.parent?.subscription_details?.metadata?.userId as string | undefined

        console.log('[webhook] invoice.payment_failed — userId:', userId)

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

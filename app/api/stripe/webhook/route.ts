import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServerClient } from '@supabase/ssr'
import Stripe from 'stripe'

// Mapping priceId Stripe → nb de jetons. Deux conventions de noms d'env
// coexistent (lib/config/prices.ts utilise PACK_5/15/25 ; le webhook
// historique utilisait DECOUVERTE/PRIVILEGE/PRESTIGE). On lit les deux,
// chaque variable définie ajoute une entrée — pas de collision sur ''
// puisqu'on ne pousse que des valeurs non-vides.
function buildTokenAmounts(): Record<string, number> {
  const map: Record<string, number> = {}
  const add = (priceId: string | undefined, tokens: number) => {
    if (priceId && priceId.trim()) map[priceId] = tokens
  }
  // Convention historique (legacy)
  add(process.env.STRIPE_PRICE_PACK_DECOUVERTE, 10)
  add(process.env.STRIPE_PRICE_PACK_PRIVILEGE,  30)
  add(process.env.STRIPE_PRICE_PACK_PRESTIGE,   50)
  // Convention actuelle (lib/config/prices.ts)
  add(process.env.STRIPE_PRICE_PACK_5,  10)
  add(process.env.STRIPE_PRICE_PACK_15, 30)
  add(process.env.STRIPE_PRICE_PACK_25, 50)
  return map
}
const TOKEN_AMOUNTS: Record<string, number> = buildTokenAmounts()

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
  // Bloc entier sous try/catch — un crash ici redémarrait PM2 sur chaque
  // checkout token pack (logs vides après "checkout.session.completed").
  // On loggue chaque étape pour qu'un futur incident soit diagnostiquable.
  console.log('[creditTokens] called — userId:', userId, '| priceId:', priceId)
  try {
    const tokens = TOKEN_AMOUNTS[priceId]
    if (!tokens) {
      console.error('[creditTokens] unknown priceId:', priceId,
        '| TOKEN_AMOUNTS keys:', Object.keys(TOKEN_AMOUNTS).length ? Object.keys(TOKEN_AMOUNTS) : '(empty — vérifier STRIPE_PRICE_PACK_* dans .env.local)')
      return
    }
    console.log('[creditTokens] TOKEN_AMOUNTS resolved:', tokens, 'tokens')

    const db = makeAdminDb()
    const { data: wallet, error: walletReadErr } = await db
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .maybeSingle()
    if (walletReadErr) {
      console.error('[creditTokens] wallet SELECT error:', walletReadErr)
      return
    }
    const w = wallet as { id: string; balance: number } | null
    console.log('[creditTokens] wallet fetched:',
      w ? `id=${w.id} balance=${w.balance}` : 'not found')

    let walletId: string | null = null
    let balanceAfter: number

    if (w) {
      walletId = w.id
      balanceAfter = w.balance + tokens
      const { error: updErr } = await db
        .from('wallets')
        .update({ balance: balanceAfter })
        .eq('user_id', userId)
      if (updErr) {
        console.error('[creditTokens] wallet UPDATE error:', updErr)
        return
      }
      console.log('[creditTokens] wallet updated — new balance:', balanceAfter)
    } else {
      balanceAfter = tokens
      // maybeSingle (et non single) : ne throw pas si l'INSERT ne retourne
      // pas de row (RLS, conflit silencieux), on traite l'erreur explicitement.
      const { data: newWallet, error: insErr } = await db
        .from('wallets')
        .insert({ user_id: userId, balance: tokens })
        .select('id')
        .maybeSingle()
      if (insErr) {
        console.error('[creditTokens] wallet INSERT error:', insErr)
        return
      }
      walletId = (newWallet as { id: string } | null)?.id ?? null
      console.log('[creditTokens] wallet created — id:', walletId, '| balance:', balanceAfter)
    }

    const { error: txErr } = await db.from('token_transactions').insert({
      user_id:      userId,
      type:         'purchase',
      amount:       tokens,
      description:  'Achat pack jetons',
      wallet_id:    walletId,
      balance_after: balanceAfter,
    })
    if (txErr) {
      console.error('[creditTokens] token_transactions INSERT error:', txErr)
      return
    }
    console.log('[creditTokens] OK — total balance après crédit:', balanceAfter)
  } catch (err) {
    // Filet final : toute exception non prévue (réseau, JSON, etc.) est
    // capturée ici — le webhook continue son cycle et Stripe ne re-tente pas
    // en boucle après le 200 retourné par le POST handler.
    console.error('[creditTokens] CRASH caught:',
      err instanceof Error ? `${err.message}\n${err.stack}` : err)
  }
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

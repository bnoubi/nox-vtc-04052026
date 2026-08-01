import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServerClient } from '@supabase/ssr'
import Stripe from 'stripe'
import { generateAndStoreSaasInvoice } from '@/lib/saas-invoice-generator'
import { saasInvoiceEmail } from '@/emails/saas-invoice'
import { subscriptionExpiredEmail } from '@/emails/subscription-expired'
import { sendEmail } from '@/lib/email/resend'

// Legacy mapping: price IDs d'env → nb jetons. Deux conventions de noms coexistent
// (PACK_5/15/25 et DECOUVERTE/PRIVILEGE/PRESTIGE). Conservé comme fallback pour les
// sessions créées avant que token_packs ne soit introduit en base.
function buildTokenAmounts(): Record<string, number> {
  const map: Record<string, number> = {}
  const add = (priceId: string | undefined, tokens: number) => {
    if (priceId && priceId.trim()) map[priceId] = tokens
  }
  add(process.env.STRIPE_PRICE_PACK_DECOUVERTE, 10)
  add(process.env.STRIPE_PRICE_PACK_PRIVILEGE,  30)
  add(process.env.STRIPE_PRICE_PACK_PRESTIGE,   50)
  add(process.env.STRIPE_PRICE_PACK_5,  10)
  add(process.env.STRIPE_PRICE_PACK_15, 30)
  add(process.env.STRIPE_PRICE_PACK_25, 50)
  return map
}
const TOKEN_AMOUNTS: Record<string, number> = buildTokenAmounts()

function makeAdminDb() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

async function getTokenPackByItemType(itemType: string): Promise<{ quantite_jetons: number; nom: string } | null> {
  const db = makeAdminDb()
  const { data, error } = await db
    .from('token_packs')
    .select('quantite_jetons, nom')
    .eq('id', itemType)
    .maybeSingle()
  if (error) {
    console.error('[getTokenPackByItemType] DB error:', error)
    return null
  }
  return data
}

async function resolvePlanFromDb(priceId: string): Promise<string> {
  const db = makeAdminDb()
  const { data, error } = await db
    .from('subscription_plans')
    .select('code')
    .eq('stripe_price_id', priceId)
    .eq('active', true)
    .maybeSingle()
  if (error) {
    console.error('[resolvePlanFromDb] DB error:', error)
  }
  if (data?.code) {
    console.log('[webhook] resolvePlanFromDb — priceId:', priceId, '→ plan DB:', data.code)
    return data.code
  }
  // Fallback env vars — couvre DUO/TEAM actuels tant que leur prix n'a pas été modifié
  const duo  = process.env.STRIPE_PRICE_DUO  ?? ''
  const team = process.env.STRIPE_PRICE_TEAM ?? ''
  console.log('[webhook] resolvePlanFromDb — pas de correspondance DB, fallback env | priceId:', priceId, '| STRIPE_PRICE_DUO:', duo || '(empty)', '| STRIPE_PRICE_TEAM:', team || '(empty)')
  if (duo  && priceId === duo)  return 'DUO'
  if (team && priceId === team) return 'TEAM'
  console.error('[CRITICAL] resolvePlanFromDb — aucune correspondance DB ni env pour priceId:', priceId, '— défaut SOLO')
  return 'SOLO'
}

async function creditTokens(userId: string, priceId: string, paymentIntentId: string | null, itemType?: string) {
  // Bloc entier sous try/catch — un crash ici redémarrait PM2 sur chaque
  // checkout token pack (logs vides après "checkout.session.completed").
  console.log('[creditTokens] called — userId:', userId, '| priceId:', priceId, '| paymentIntentId:', paymentIntentId, '| itemType:', itemType ?? '(absent)')
  try {
    let tokens: number | undefined

    // Chemin principal : lookup DB via itemType (UUID stable, résiste aux changements de prix)
    if (itemType) {
      const pack = await getTokenPackByItemType(itemType)
      if (pack) {
        tokens = pack.quantite_jetons
        console.log('[creditTokens] pack DB trouvé — nom:', pack.nom, '| quantite_jetons:', tokens)
      } else {
        console.error('[CRITICAL] creditTokens — itemType présent mais aucun pack trouvé en DB:', itemType, '— tentative fallback TOKEN_AMOUNTS')
      }
    }

    // Fallback : TOKEN_AMOUNTS legacy (price IDs d'env, sessions antérieures à token_packs)
    if (tokens === undefined) {
      tokens = TOKEN_AMOUNTS[priceId]
      if (tokens !== undefined) {
        console.log('[creditTokens] FALLBACK TOKEN_AMOUNTS — priceId:', priceId, '| tokens:', tokens)
      } else {
        console.error('[CRITICAL] creditTokens — pack introuvable en DB et dans TOKEN_AMOUNTS — aucun crédit possible',
          '| userId:', userId, '| priceId:', priceId, '| itemType:', itemType ?? '(absent)',
          '| TOKEN_AMOUNTS keys:', Object.keys(TOKEN_AMOUNTS).length ? Object.keys(TOKEN_AMOUNTS) : '(empty — vérifier STRIPE_PRICE_PACK_* dans .env.local)')
        return
      }
    }

    const db = makeAdminDb()

    // Idempotence : refuse de re-créditer si Stripe rejoue le webhook (retry après timeout)
    if (paymentIntentId) {
      const { data: existingTx, error: dupErr } = await db
        .from('token_transactions')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle()
      if (dupErr) {
        console.error('[creditTokens] idempotence SELECT error:', dupErr)
      } else if (existingTx) {
        console.log('[creditTokens] doublon détecté, ignoré — paymentIntentId:', paymentIntentId)
        return
      }
    }

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
    console.log('[creditTokens] wallet fetched:', w ? `id=${w.id} balance=${w.balance}` : 'not found')

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
      // maybeSingle (pas single) : ne throw pas si l'INSERT ne retourne pas de row (RLS, conflit silencieux)
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
      stripe_payment_intent_id: paymentIntentId,
    })
    if (txErr) {
      console.error('[creditTokens] token_transactions INSERT error:', txErr)
      return
    }
    console.log('[creditTokens] OK — total balance après crédit:', balanceAfter)
  } catch (err) {
    console.error('[creditTokens] CRASH caught:', err instanceof Error ? `${err.message}\n${err.stack}` : err)
  }
}

async function upsertSubscription(userId: string, priceId: string, status: string, stripeSubId: string) {
  const plan = await resolvePlanFromDb(priceId)
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
      .update({ plan, status, stripe_subscription_id: stripeSubId, payment_provider: 'stripe' })
      .eq('id', (existing as { id: string }).id)
    if (updateSubError) {
      console.error('[webhook] upsertSubscription — erreur UPDATE subscriptions:', updateSubError)
    } else {
      console.log('[webhook] upsertSubscription — subscriptions mis à jour, id:', (existing as { id: string }).id)
    }
  } else {
    const { error: insertSubError } = await db.from('subscriptions').insert({
      user_id: userId, plan, target_plan: plan.toLowerCase(), status, stripe_subscription_id: stripeSubId, current_period_start: new Date().toISOString(), payment_provider: 'stripe',
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

async function buildInvoiceDescription(priceId: string, mode: 'payment' | 'subscription', itemType?: string): Promise<string> {
  if (mode === 'payment') {
    // Chemin DB via itemType (UUID stable, résiste aux changements de prix admin)
    if (itemType) {
      const db = makeAdminDb()
      const { data } = await db.from('token_packs').select('nom, quantite_jetons').eq('id', itemType).maybeSingle()
      if (data) return `${data.nom} — ${data.quantite_jetons} jetons`
    }
    // Fallback env vars pour les sessions legacy (Price IDs d'origine)
    const pack5  = process.env.STRIPE_PRICE_PACK_5
    const pack15 = process.env.STRIPE_PRICE_PACK_15
    const pack25 = process.env.STRIPE_PRICE_PACK_25
    const packD  = process.env.STRIPE_PRICE_PACK_DECOUVERTE
    const packP  = process.env.STRIPE_PRICE_PACK_PRIVILEGE
    const packPr = process.env.STRIPE_PRICE_PACK_PRESTIGE
    if ((pack5  && priceId === pack5)  || (packD  && priceId === packD))  return 'Pack Découverte — 10 jetons'
    if ((pack15 && priceId === pack15) || (packP  && priceId === packP))  return 'Pack Privilège — 30 jetons'
    if ((pack25 && priceId === pack25) || (packPr && priceId === packPr)) return 'Pack Prestige — 50 jetons'
    return 'Pack jetons NoX VTC'
  }
  const plan = await resolvePlanFromDb(priceId)
  if (plan === 'DUO') return 'Offre Pro — abonnement mensuel'
  if (plan === 'TEAM') return 'Offre Premium — abonnement mensuel'
  return 'Abonnement NoX VTC'
}

async function handleSaasInvoiceStripe(opts: {
  userId: string
  priceId: string
  mode: 'payment' | 'subscription'
  montantTTC: number
  providerReference: string
  itemType?: string
}) {
  try {
    const { userId, priceId, mode, montantTTC, providerReference, itemType } = opts

    if (montantTTC <= 0) {
      console.log('[saas-invoice] montant 0 — pas de facture générée')
      return
    }

    const db = makeAdminDb()

    const { data: account } = await db
      .from('user_accounts')
      .select('email, full_name, prenom')
      .eq('id', userId)
      .maybeSingle()

    const acc = account as { email: string; full_name: string; prenom: string | null } | null
    const userEmail = acc?.email ?? ''
    const userName  = acc?.full_name ?? 'Client'
    const prenom    = acc?.prenom ?? undefined

    if (!userEmail) {
      console.warn('[saas-invoice] email introuvable pour userId:', userId)
      return
    }

    const description = await buildInvoiceDescription(priceId, mode, itemType)
    const type: 'subscription' | 'token_pack' = mode === 'payment' ? 'token_pack' : 'subscription'

    const { numero, pdfSignedUrl } = await generateAndStoreSaasInvoice({
      userId, userEmail, userName, type, description,
      montantTTC, paymentProvider: 'stripe', providerReference,
    })

    const montant_ht = Math.round((montantTTC / 1.20) * 100) / 100
    const tva_amount = Math.round((montantTTC - montant_ht) * 100) / 100
    const { subject, html } = saasInvoiceEmail({
      userName, prenom, numero, description,
      montantTTC, montantHT: montant_ht, tvaAmount: tva_amount,
      pdfUrl: pdfSignedUrl ?? '', type,
    })

    const emailResult = await sendEmail(userEmail, subject, html)
    if (!emailResult.success) {
      console.error('[saas-invoice] email error:', emailResult.error)
    } else {
      console.log('[saas-invoice] email sent to:', userEmail)
    }

    await db
      .from('saas_invoices')
      .update({ email_sent_at: new Date().toISOString(), status: 'sent' })
      .eq('numero', numero)

    console.log('[saas-invoice] done — numero:', numero)
  } catch (err) {
    console.error('[saas-invoice] error:', err instanceof Error ? `${err.message}\n${err.stack}` : err)
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
        const session  = event.data.object as Stripe.Checkout.Session
        const userId   = session.metadata?.userId
        const priceId  = session.metadata?.priceId
        const itemType = session.metadata?.itemType

        console.log('[webhook] checkout.session.completed — mode:', session.mode, '| userId:', userId, '| priceId:', priceId, '| itemType:', itemType ?? '(absent)', '| subscription:', session.subscription ?? 'null')

        if (!userId || !priceId) {
          console.error('[webhook] checkout.session.completed — userId ou priceId manquant dans metadata')
          break
        }

        if (session.mode === 'payment') {
          const paymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null
          await creditTokens(userId, priceId, paymentIntentId, itemType)
          await handleSaasInvoiceStripe({
            userId, priceId, mode: 'payment',
            montantTTC: (session.amount_total ?? 0) / 100,
            providerReference: paymentIntentId ?? `session_${session.id}`,
            itemType,
          })
        } else if (session.mode === 'subscription') {
          if (!session.subscription) {
            console.error('[webhook] checkout.session.completed — session.subscription est null (abonnement non créé ?)')
            break
          }
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id
          await upsertSubscription(userId, priceId, 'active', subId)
          await handleSaasInvoiceStripe({
            userId, priceId, mode: 'subscription',
            montantTTC: (session.amount_total ?? 0) / 100,
            providerReference: subId,
          })
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
          const now = new Date().toISOString()
          const { error } = await db
            .from('subscriptions')
            .update({ status: 'expired', plan: 'SOLO', target_plan: 'SOLO', cancel_at: null, updated_at: now })
            .eq('id', (existing as { id: string }).id)
          if (error) {
            console.error('[webhook] customer.subscription.deleted — erreur UPDATE subscriptions:', error)
          } else {
            console.log('[webhook] subscription.deleted — userId:', userId, ', status: expired, plan → SOLO')
          }

          const { error: accErr } = await db
            .from('user_accounts')
            .update({ plan: 'SOLO', updated_at: now })
            .eq('id', userId)
          if (accErr) console.error('[webhook] customer.subscription.deleted — erreur UPDATE user_accounts:', accErr)
        }

        // Email d'expiration — isolé pour ne jamais crasher le webhook
        try {
          const { data: account } = await db
            .from('user_accounts')
            .select('email, full_name')
            .eq('id', userId)
            .maybeSingle()

          const acc = account as { email: string; full_name: string } | null
          if (acc?.email) {
            const oldPriceId = sub.items.data[0]?.price.id ?? ''
            const oldPlan    = await resolvePlanFromDb(oldPriceId)
            const planName   = oldPlan === 'TEAM' ? 'Premium' : 'Pro'
            const expiredAt  = sub.ended_at
              ? new Date(sub.ended_at * 1000).toISOString()
              : new Date().toISOString()

            const { subject, html } = subscriptionExpiredEmail({
              userName: acc.full_name ?? 'Client',
              planName,
              expiredAt,
            })
            const result = await sendEmail(acc.email, subject, html)
            if (!result.success) {
              console.error('[webhook] subscription.deleted — email expiration erreur:', result.error)
            } else {
              console.log('[webhook] subscription.deleted — email expiration envoyé:', userId)
            }
          }
        } catch (emailErr) {
          console.error('[webhook] subscription.deleted — email expiration exception:', emailErr)
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

      case 'invoice.paid': {
        // SDK v22 : invoice.subscription au niveau racine n'existe plus,
        // l'identifiant d'abonnement est dans parent.subscription_details.
        // Pour les invoices one-time (packs jetons), ce chemin est null → on ignore.
        const invoice = event.data.object as Stripe.Invoice
        const subRef  = invoice.parent?.subscription_details?.subscription
        const subId   = typeof subRef === 'string' ? subRef : subRef?.id ?? null

        if (!subId) break

        const periodEnd = new Date(invoice.period_end * 1000).toISOString()
        console.log('[webhook] invoice.paid — subId:', subId, '| period_end:', periodEnd)

        const db = makeAdminDb()
        const { error } = await db
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subId)
        if (error) {
          console.error('[webhook] invoice.paid — erreur UPDATE subscriptions:', error)
        }
        break
      }
    }
  } catch (err) {
    console.error('[webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifyPayPalWebhookSignature } from '@/lib/paypal/subscriptions'
import { subscriptionExpiredEmail } from '@/emails/subscription-expired'
import { sendEmail } from '@/lib/email/resend'

function makeAdminDb() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

async function upsertPlan(userId: string, plan: string, status: string) {
  const db = makeAdminDb()
  const { data: existing } = await db
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    await db.from('subscriptions')
      .update({ plan, status, payment_provider: 'paypal' })
      .eq('id', (existing as { id: string }).id)
  } else {
    await db.from('subscriptions').insert({
      user_id: userId, plan, target_plan: plan.toLowerCase(),
      status, payment_provider: 'paypal',
      current_period_start: new Date().toISOString(),
    })
  }
  await db.from('user_accounts').update({ plan }).eq('id', userId)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const webhookId = process.env.PAYPAL_WEBHOOK_ID ?? ''

  if (webhookId) {
    try {
      const valid = await verifyPayPalWebhookSignature(req.headers, body, webhookId)
      if (!valid) {
        console.error('[paypal-webhook] signature invalide')
        return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
      }
    } catch (sigErr) {
      console.error('[paypal-webhook] signature verification error:', sigErr)
      return NextResponse.json({ error: 'Erreur vérification signature' }, { status: 500 })
    }
  } else {
    console.error('[paypal-webhook] PAYPAL_WEBHOOK_ID non configure — webhook rejeté')
    return NextResponse.json({ error: 'Webhook non configuré' }, { status: 500 })
  }

  let event: { event_type: string; resource: Record<string, unknown> }
  try {
    event = JSON.parse(body) as typeof event
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  console.log('[paypal-webhook] event recu:', event.event_type)

  try {
    const db = makeAdminDb()
    const res = event.resource

    switch (event.event_type) {

      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subscriptionId = res.id as string
        console.log('[paypal-webhook] ACTIVATED — subscriptionId:', subscriptionId)

        const { data: rec } = await db
          .from('paypal_subscriptions')
          .select('user_id, plan_code')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle()

        if (!rec) {
          console.error('[paypal-webhook] ACTIVATED — record introuvable:', subscriptionId)
          break
        }
        const { user_id: userId, plan_code: plan } = rec as { user_id: string; plan_code: string }

        await db.from('paypal_subscriptions')
          .update({ status: 'active' })
          .eq('paypal_subscription_id', subscriptionId)

        await upsertPlan(userId, plan, 'active')
        console.log('[paypal-webhook] ACTIVATED — userId:', userId, '| plan:', plan)
        break
      }

      case 'PAYMENT.SALE.COMPLETED': {
        const subscriptionId = res.billing_agreement_id as string
        if (!subscriptionId) break
        console.log('[paypal-webhook] PAYMENT.SALE.COMPLETED — subscriptionId:', subscriptionId)

        const now = new Date().toISOString()
        const nextBilling = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

        await db.from('paypal_subscriptions')
          .update({ status: 'active', last_payment_date: now, next_billing_date: nextBilling })
          .eq('paypal_subscription_id', subscriptionId)

        const { data: rec } = await db
          .from('paypal_subscriptions')
          .select('user_id')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle()

        if (rec) {
          const { user_id: userId } = rec as { user_id: string }
          await db.from('subscriptions')
            .update({ status: 'active', current_period_end: nextBilling, updated_at: now })
            .eq('user_id', userId)
            .eq('payment_provider', 'paypal')
        }
        console.log('[paypal-webhook] PAYMENT.SALE.COMPLETED — traite pour:', subscriptionId)
        break
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        const subscriptionId = res.id as string
        console.log('[paypal-webhook] CANCELLED — subscriptionId:', subscriptionId)

        const { data: rec } = await db
          .from('paypal_subscriptions')
          .select('user_id, plan_code')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle()

        if (!rec) break
        const { user_id: userId, plan_code: oldPlan } = rec as { user_id: string; plan_code: string }
        const now = new Date().toISOString()

        await db.from('paypal_subscriptions')
          .update({ status: 'cancelled', cancelled_at: now })
          .eq('paypal_subscription_id', subscriptionId)

        // Vérifie si l'annulation vient de l'app (cancel_at futur déjà posé en DB)
        // → période déjà payée, le cron expire-trials gèrera la transition à cancel_at
        const { data: subRow } = await db
          .from('subscriptions')
          .select('cancel_at')
          .eq('user_id', userId)
          .eq('payment_provider', 'paypal')
          .maybeSingle()

        const cancelAt = (subRow as { cancel_at: string | null } | null)?.cancel_at
        const hasFutureCancelAt = cancelAt && new Date(cancelAt) > new Date()

        if (hasFutureCancelAt) {
          // Accès maintenu jusqu'à cancel_at — alignement sur le comportement Stripe
          await db.from('subscriptions')
            .update({ status: 'cancelled', updated_at: now })
            .eq('user_id', userId)
            .eq('payment_provider', 'paypal')
          console.log('[paypal-webhook] CANCELLED — accès maintenu jusqu\'à', cancelAt, '(cron)')
          break
        }

        // Annulation directe depuis PayPal (sans cancel_at) → downgrade immédiat
        await db.from('subscriptions')
          .update({ status: 'expired', plan: 'SOLO', target_plan: 'solo', updated_at: now })
          .eq('user_id', userId)
          .eq('payment_provider', 'paypal')

        await db.from('user_accounts').update({ plan: 'SOLO', updated_at: now }).eq('id', userId)

        try {
          const { data: account } = await db
            .from('user_accounts').select('email, full_name').eq('id', userId).maybeSingle()
          const acc = account as { email: string; full_name: string } | null
          if (acc?.email) {
            const planName = oldPlan === 'TEAM' ? 'Premium' : 'Pro'
            const { subject, html } = subscriptionExpiredEmail({
              userName: acc.full_name ?? 'Client', planName, expiredAt: now,
            })
            await sendEmail(acc.email, subject, html)
          }
        } catch (emailErr) {
          console.error('[paypal-webhook] CANCELLED email error:', emailErr)
        }

        console.log('[paypal-webhook] CANCELLED — userId:', userId, '→ SOLO immédiat')
        break
      }

      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const subscriptionId = res.id as string
        if (!subscriptionId) break
        console.log('[paypal-webhook] SUSPENDED — subscriptionId:', subscriptionId)

        const { data: rec } = await db
          .from('paypal_subscriptions')
          .select('user_id')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle()

        if (!rec) break
        const { user_id: userId } = rec as { user_id: string }

        await db.from('paypal_subscriptions')
          .update({ status: 'suspended' })
          .eq('paypal_subscription_id', subscriptionId)

        await db.from('user_accounts').update({ account_status: 'suspended' }).eq('id', userId)
        console.log('[paypal-webhook] SUSPENDED — userId:', userId, 'suspendu')
        break
      }

      case 'PAYMENT.SALE.DENIED': {
        const subscriptionId = res.billing_agreement_id as string
        if (!subscriptionId) break
        console.log('[paypal-webhook] PAYMENT.SALE.DENIED — subscriptionId:', subscriptionId)

        const { data: rec } = await db
          .from('paypal_subscriptions')
          .select('user_id')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle()

        if (!rec) break
        const { user_id: userId } = rec as { user_id: string }

        await db.from('paypal_subscriptions')
          .update({ status: 'suspended' })
          .eq('paypal_subscription_id', subscriptionId)

        await db.from('user_accounts').update({ account_status: 'suspended' }).eq('id', userId)
        console.log('[paypal-webhook] PAYMENT.SALE.DENIED — userId:', userId, 'suspendu')
        break
      }

      default:
        console.log('[paypal-webhook] event ignore:', event.event_type)
    }
  } catch (err) {
    console.error('[paypal-webhook] handler error:', err)
    // Toujours retourner 200 pour eviter les retentatives PayPal en boucle
  }

  return NextResponse.json({ received: true })
}

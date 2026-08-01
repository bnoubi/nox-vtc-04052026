import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPayPalSubscription } from '@/lib/paypal/subscriptions'

const BASE_APP = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.noxvtc.fr'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  // PayPal redirige avec ?subscription_id=I-XXXX apres approbation
  const subscriptionId = searchParams.get('subscription_id') ?? ''

  console.log('[subscription-callback] subscription_id:', subscriptionId)

  if (!subscriptionId) {
    return NextResponse.redirect(new URL('/?paypal=error&msg=missing_subscription_id', BASE_APP))
  }

  const db = createAdminClient()

  // Retrouver l'enregistrement pre-insere par create-subscription
  const { data: subRecord } = await db
    .from('paypal_subscriptions')
    .select('user_id, plan_code')
    .eq('paypal_subscription_id', subscriptionId)
    .maybeSingle()

  if (!subRecord) {
    console.error('[subscription-callback] paypal_subscriptions introuvable pour:', subscriptionId)
    return NextResponse.redirect(new URL('/?paypal=error&msg=subscription_not_found', BASE_APP))
  }

  const { user_id: userId, plan_code: planCode } = subRecord as { user_id: string; plan_code: string }

  try {
    const details = await getPayPalSubscription(subscriptionId)
    console.log('[subscription-callback] statut PayPal:', details.status, '| plan:', planCode, '| userId:', userId)

    if (details.status === 'ACTIVE') {
      await db.from('paypal_subscriptions')
        .update({ status: 'active' })
        .eq('paypal_subscription_id', subscriptionId)

      const { data: existing } = await db
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        await db.from('subscriptions')
          .update({ plan: planCode, status: 'active', payment_provider: 'paypal' })
          .eq('id', (existing as { id: string }).id)
      } else {
        await db.from('subscriptions').insert({
          user_id:              userId,
          plan:                 planCode,
          target_plan:          planCode.toLowerCase(),
          status:               'active',
          payment_provider:     'paypal',
          current_period_start: new Date().toISOString(),
        })
      }

      await db.from('user_accounts').update({ plan: planCode }).eq('id', userId)
      console.log('[subscription-callback] activated — userId:', userId, '| plan:', planCode)
    } else {
      // APPROVAL_PENDING : l'utilisateur n'a pas encore approuve ou PayPal est lent
      // Le webhook BILLING.SUBSCRIPTION.ACTIVATED prendra le relais
      console.log('[subscription-callback] statut non-ACTIVE:', details.status, '— webhook prendra le relais')
    }

    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    return NextResponse.redirect(
      new URL(`/payment/success?type=subscription&plan=${planCode}&valid_until=${validUntil}`, BASE_APP),
    )
  } catch (err) {
    console.error('[subscription-callback] error:', err)
    return NextResponse.redirect(new URL('/?paypal=error&msg=verification_failed', BASE_APP))
  }
}

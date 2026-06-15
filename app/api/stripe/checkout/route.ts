import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTokenPack, getPlan } from '@/lib/config/prices'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { itemType, userId, userEmail, successUrl: clientSuccessUrl, cancelUrl: clientCancelUrl } = body

    if (!userId || !itemType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Lire la config promo depuis app_config
    const adminClient = createAdminClient()
    const { data: promoConfig } = await adminClient
      .from('app_config')
      .select('key, value')
      .in('key', ['promo_active', 'promo_coupon_id'])

    const promoActive = promoConfig?.find(c => c.key === 'promo_active')?.value === 'true'
    const promoCouponId = promoConfig?.find(c => c.key === 'promo_coupon_id')?.value

    const pack = getTokenPack(itemType)
    const plan = getPlan(itemType)
    if (!pack && !plan) {
      return NextResponse.json({ error: 'Invalid item type' }, { status: 400 })
    }

    const mode: 'subscription' | 'payment' = plan ? 'subscription' : 'payment'
    const envKey = (pack ?? plan)!.stripeEnvKey
    const priceId = process.env[envKey]

    if (!priceId) {
      return NextResponse.json({ error: `Price ID not configured (${envKey})` }, { status: 500 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.noxvtc.fr'
    const successUrl = clientSuccessUrl ?? `${siteUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&item=${itemType}`
    const cancelUrl = clientCancelUrl ?? `${siteUrl}/`

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      customer_email: userEmail,
      metadata: {
        userId,
        itemType,
        priceId,
        type: mode === 'payment' ? 'token_pack' : 'subscription',
      },
      ...(mode === 'subscription' && {
        subscription_data: { metadata: { userId, priceId } },
      }),
    }

    // Appliquer le coupon promo uniquement sur les abonnements si promo active
    if (promoActive && promoCouponId && mode === 'subscription') {
      sessionParams.discounts = [{ coupon: promoCouponId }]
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[stripe/checkout] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

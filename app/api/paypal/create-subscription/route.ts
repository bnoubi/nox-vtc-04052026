import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPayPalProduct, createPayPalPlan, createPayPalSubscription } from '@/lib/paypal/subscriptions'

const APP_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.noxvtc.fr'

const schema = z.object({
  itemType: z.enum(['plan_duo', 'plan_team']),
  userId:   z.string().uuid(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Corps de requete invalide' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  }

  const { itemType, userId } = parsed.data
  const planCode = itemType === 'plan_duo' ? 'DUO' : 'TEAM'

  const db = createAdminClient()

  const { data: planRow, error: planErr } = await db
    .from('subscription_plans')
    .select('price_per_month, paypal_plan_id, paypal_product_id')
    .eq('code', planCode)
    .maybeSingle()

  if (planErr || !planRow) {
    console.error('[create-subscription] plan lookup error:', planErr)
    return NextResponse.json({ error: 'Plan introuvable' }, { status: 500 })
  }

  const plan = planRow as { price_per_month: number; paypal_plan_id: string | null; paypal_product_id: string | null }
  let paypalPlanId = plan.paypal_plan_id

  // Auto-init : creer Product + Plan PayPal si jamais initialise (premier deploiement)
  if (!paypalPlanId) {
    try {
      console.log('[create-subscription] paypal_plan_id null, auto-init pour', planCode)
      let productId = plan.paypal_product_id
      if (!productId) {
        const productName = planCode === 'DUO' ? 'NoX VTC Pro' : 'NoX VTC Premium'
        productId = await createPayPalProduct(productName)
        await db.from('subscription_plans').update({ paypal_product_id: productId }).eq('code', planCode)
        console.log('[create-subscription] PayPal product cree:', productId)
      }
      paypalPlanId = await createPayPalPlan(productId, planCode, Number(plan.price_per_month))
      await db.from('subscription_plans').update({ paypal_plan_id: paypalPlanId }).eq('code', planCode)
      console.log('[create-subscription] PayPal plan cree:', paypalPlanId)
    } catch (err) {
      console.error('[create-subscription] PayPal auto-init error:', err)
      return NextResponse.json({ error: 'Erreur initialisation PayPal' }, { status: 500 })
    }
  }

  const returnUrl = `${APP_BASE}/api/paypal/subscription-callback`
  const cancelUrl = `${APP_BASE}/?cancelled=1`

  try {
    const { subscriptionId, approvalUrl } = await createPayPalSubscription(
      paypalPlanId, returnUrl, cancelUrl, userId,
    )
    console.log('[create-subscription] subscription cree:', subscriptionId, '| plan:', planCode, '| userId:', userId)

    // Pre-inserer un enregistrement pending pour que callback et webhook retrouvent user + plan
    const { error: insertErr } = await db.from('paypal_subscriptions').insert({
      user_id:                userId,
      paypal_subscription_id: subscriptionId,
      paypal_plan_id:         paypalPlanId,
      plan_code:              planCode,
      status:                 'pending',
      price_at_subscription:  Number(plan.price_per_month),
    })
    if (insertErr) console.error('[create-subscription] insert paypal_subscriptions error:', insertErr)

    return NextResponse.json({ approvalUrl })
  } catch (err) {
    console.error('[create-subscription] error:', err)
    return NextResponse.json({ error: 'Erreur creation abonnement PayPal' }, { status: 500 })
  }
}

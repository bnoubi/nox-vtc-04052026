import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe/client'
import { createAdminClient, verifyAdminPermission } from '@/lib/supabase/admin'
import { createPayPalPlan } from '@/lib/paypal/subscriptions'

async function logAction(adminId: string, action: string, details: Record<string, unknown>) {
  const { error } = await createAdminClient()
    .from('admin_logs')
    .insert({ action, admin_id: adminId, target_user_id: adminId, new_values: details })
  if (error) console.error('[subscription-plans] log failed:', error.message)
}

const patchSchema = z.object({
  code:            z.enum(['DUO', 'TEAM']),
  price_per_month: z.number().positive().min(0.5).max(999),
})

export async function GET() {
  const auth = await verifyAdminPermission('config.write')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorise' }, { status: auth.status })

  const db = createAdminClient()
  const { data, error } = await db
    .from('subscription_plans')
    .select('code, name, price_per_month, stripe_price_id, paypal_plan_id, paypal_product_id, sort_order')
    .in('code', ['DUO', 'TEAM'])
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminPermission('config.write')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorise' }, { status: auth.status })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parametres invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  const { code, price_per_month } = parsed.data
  const db = createAdminClient()

  const { data: current, error: fetchErr } = await db
    .from('subscription_plans')
    .select('price_per_month, stripe_price_id, paypal_plan_id, paypal_product_id')
    .eq('code', code)
    .maybeSingle()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 })
  }

  const cur = current as {
    price_per_month:  number
    stripe_price_id:  string | null
    paypal_plan_id:   string | null
    paypal_product_id: string | null
  }

  const priceChanged = Math.abs(Number(cur.price_per_month) - price_per_month) > 0.001
  const updates: Record<string, unknown> = { price_per_month }

  if (priceChanged && cur.stripe_price_id) {
    try {
      const existing = await stripe.prices.retrieve(cur.stripe_price_id)
      const productId = typeof existing.product === 'string' ? existing.product : existing.product.id
      const newPrice = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(price_per_month * 100),
        currency: 'eur',
        recurring: { interval: 'month' },
      })
      updates.stripe_price_id = newPrice.id
      console.log('[subscription-plans] nouveau Stripe Price:', newPrice.id, '| plan:', code)
    } catch (err) {
      console.error('[subscription-plans] Stripe error:', err)
      return NextResponse.json({ error: 'Erreur Stripe lors de la mise a jour du prix' }, { status: 500 })
    }
  }

  if (priceChanged && cur.paypal_product_id) {
    try {
      const newPlanId = await createPayPalPlan(cur.paypal_product_id, code, price_per_month)
      updates.paypal_plan_id = newPlanId
      console.log('[subscription-plans] nouveau PayPal Plan:', newPlanId, '| plan:', code)
    } catch (err) {
      console.error('[subscription-plans] PayPal plan error:', err)
      return NextResponse.json({ error: 'Erreur PayPal lors de la mise a jour du prix' }, { status: 500 })
    }
  }

  const { data: updated, error: updateErr } = await db
    .from('subscription_plans')
    .update(updates)
    .eq('code', code)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: 'Erreur DB' }, { status: 500 })

  await logAction(auth.adminId, 'update_subscription_plan', { code, price_per_month, ...updates })
  return NextResponse.json(updated)
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayPalAccessToken } from '@/lib/paypal/client'

const BASE_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

const APP_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.noxvtc.fr'

const ITEM_CONFIG: Record<string, { amount: number; description: string }> = {
  pack_decouverte: { amount: 0.99,  description: 'Pack Découverte — 5 jetons' },
  pack_privilege:  { amount: 9.99,  description: 'Pack Privilège — 15 jetons' },
  pack_prestige:   { amount: 14.99, description: 'Pack Prestige — 25 jetons' },
  plan_duo:        { amount: 9.99,  description: 'Offre DUO — abonnement mensuel' },
  plan_team:       { amount: 14.99, description: 'Offre TEAM — abonnement mensuel' },
}

const schema = z.object({
  itemType: z.enum(['pack_decouverte', 'pack_privilege', 'pack_prestige', 'plan_duo', 'plan_team']),
  userId:   z.string().uuid(),
})

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

  const { itemType, userId } = parsed.data
  const config = ITEM_CONFIG[itemType]

  console.log("[PayPal] return_url:", `${APP_BASE}/api/paypal/capture-order`)
  const returnUrl = `${APP_BASE}/api/paypal/capture-order?userId=${userId}&itemType=${itemType}`
  const cancelUrl = `${APP_BASE}/?cancelled=1`

  try {
    const token = await getPayPalAccessToken()
    const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'EUR', value: config.amount.toFixed(2) },
          description: config.description,
        }],
        application_context: {
          return_url:  returnUrl,
          cancel_url:  cancelUrl,
          brand_name:  'NoX VTC',
          user_action: 'PAY_NOW',
        },
      }),
    })

    if (!res.ok) throw new Error(`PayPal create order failed: ${res.status}`)
    const data = await res.json() as { id: string; links: Array<{ rel: string; href: string }> }

    const approvalLink = data.links.find(l => l.rel === 'approve')
    if (!approvalLink) throw new Error('No approval URL from PayPal')

    return NextResponse.json({ orderID: data.id, approvalUrl: approvalLink.href })
  } catch (err) {
    console.error('[paypal/create-order] error:', err)
    return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
  }
}

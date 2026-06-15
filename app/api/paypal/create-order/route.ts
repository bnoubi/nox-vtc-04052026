import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayPalAccessToken } from '@/lib/paypal/client'
import { getItem } from '@/lib/config/prices'

const BASE_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

const APP_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.noxvtc.fr'

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
  const item = getItem(itemType)
  if (!item) {
    return NextResponse.json({ error: 'Item inconnu' }, { status: 400 })
  }

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
          amount: { currency_code: 'EUR', value: item.price.toFixed(2) },
          description: item.description,
        }],
        application_context: {
          return_url:  returnUrl,
          cancel_url:  cancelUrl,
          brand_name:  'NoX VTC',
          user_action: 'PAY_NOW',
        },
      }),
    })

    const responseText = await res.text()
    if (!res.ok) {
      console.error('[paypal/create-order] PayPal API error:', responseText)
      return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
    }

    const data = JSON.parse(responseText) as { id: string; links: Array<{ rel: string; href: string }> }
    const approvalLink = data.links.find(l => l.rel === 'approve')
    if (!approvalLink) {
      console.error('[paypal/create-order] No approval URL in response:', responseText)
      return NextResponse.json({ error: 'Réponse PayPal invalide' }, { status: 500 })
    }

    return NextResponse.json({ orderID: data.id, approvalUrl: approvalLink.href })
  } catch (err) {
    console.error('[paypal/create-order] error:', err)
    return NextResponse.json({ error: 'Erreur lors de la création de la commande' }, { status: 500 })
  }
}

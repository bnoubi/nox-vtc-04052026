import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe/client'

type ItemConfig = { priceId: string; mode: 'payment' | 'subscription' }

function resolveItem(itemType: string): ItemConfig | null {
  const map: Record<string, () => ItemConfig | null> = {
    pack_decouverte: () => process.env.STRIPE_PRICE_PACK_DECOUVERTE
      ? { priceId: process.env.STRIPE_PRICE_PACK_DECOUVERTE, mode: 'payment' } : null,
    pack_privilege:  () => process.env.STRIPE_PRICE_PACK_PRIVILEGE
      ? { priceId: process.env.STRIPE_PRICE_PACK_PRIVILEGE,  mode: 'payment' } : null,
    pack_prestige:   () => process.env.STRIPE_PRICE_PACK_PRESTIGE
      ? { priceId: process.env.STRIPE_PRICE_PACK_PRESTIGE,   mode: 'payment' } : null,
    plan_duo:        () => process.env.STRIPE_PRICE_DUO
      ? { priceId: process.env.STRIPE_PRICE_DUO,             mode: 'subscription' } : null,
    plan_team:       () => process.env.STRIPE_PRICE_TEAM
      ? { priceId: process.env.STRIPE_PRICE_TEAM,            mode: 'subscription' } : null,
  }
  return map[itemType]?.() ?? null
}

const schema = z.object({
  itemType:   z.enum(['pack_decouverte', 'pack_privilege', 'pack_prestige', 'plan_duo', 'plan_team']),
  userId:     z.string().uuid(),
  successUrl: z.string().url(),
  cancelUrl:  z.string().url(),
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

  const { itemType, userId, successUrl, cancelUrl } = parsed.data
  const item = resolveItem(itemType)

  if (!item) {
    return NextResponse.json({ error: 'Prix non configuré' }, { status: 503 })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: item.mode,
      line_items: [{ price: item.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      metadata: { userId, priceId: item.priceId, type: item.mode === 'payment' ? 'token_pack' : 'subscription' },
      ...(item.mode === 'subscription' && {
        subscription_data: { metadata: { userId, priceId: item.priceId } },
      }),
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] error:', err)
    return NextResponse.json({ error: 'Erreur lors de la création de la session' }, { status: 500 })
  }
}

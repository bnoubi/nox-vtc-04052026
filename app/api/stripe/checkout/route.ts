import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe/client'

const schema = z.object({
  priceId:    z.string().min(1),
  mode:       z.enum(['payment', 'subscription']),
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

  const { priceId, mode, userId, successUrl, cancelUrl } = parsed.data

  try {
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, priceId, type: mode === 'payment' ? 'token_pack' : 'subscription' },
      ...(mode === 'subscription' && {
        subscription_data: { metadata: { userId, priceId } },
      }),
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] error:', err)
    return NextResponse.json({ error: 'Erreur lors de la création de la session' }, { status: 500 })
  }
}

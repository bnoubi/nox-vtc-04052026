import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe/client'
import { createAdminClient, verifyAdminPermission } from '@/lib/supabase/admin'

async function logPackAction(adminId: string, action: string, details: Record<string, unknown>) {
  const { error } = await createAdminClient()
    .from('admin_logs')
    .insert({ action, admin_id: adminId, target_user_id: adminId, new_values: details })
  if (error) console.error('[token-packs] log failed:', error.message)
}

const patchSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1).max(100).optional(),
  quantite_jetons: z.number().int().min(1).max(10000).optional(),
  prix_eur: z.number().min(0.5).max(500).optional(),
  actif: z.boolean().optional(),
  ordre_affichage: z.number().int().min(0).optional(),
})

const postSchema = z.object({
  nom: z.string().min(1).max(100),
  quantite_jetons: z.number().int().min(1).max(10000),
  prix_eur: z.number().min(0.5).max(500),
  ordre_affichage: z.number().int().min(0).optional(),
})

export async function GET() {
  const auth = await verifyAdminPermission('config.write')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorise' }, { status: auth.status })

  const db = createAdminClient()
  const { data, error } = await db.from('token_packs').select('*').order('ordre_affichage')
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

  const { id, prix_eur, ...rest } = parsed.data
  const db = createAdminClient()

  const { data: current, error: fetchErr } = await db
    .from('token_packs').select('*').eq('id', id).maybeSingle()
  if (fetchErr || !current) return NextResponse.json({ error: 'Pack introuvable' }, { status: 404 })

  const updates: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() }

  if (prix_eur !== undefined) {
    updates.prix_eur = prix_eur
    if (Math.abs(Number(current.prix_eur) - prix_eur) > 0.001) {
      try {
        const existingPrice = await stripe.prices.retrieve(current.stripe_price_id as string)
        const productId = typeof existingPrice.product === 'string'
          ? existingPrice.product
          : existingPrice.product.id
        const newPrice = await stripe.prices.create({
          product: productId,
          unit_amount: Math.round(prix_eur * 100),
          currency: 'eur',
        })
        updates.stripe_price_id = newPrice.id
      } catch (err) {
        console.error('[token-packs] stripe price error:', err)
        return NextResponse.json({ error: 'Erreur Stripe lors de la mise a jour du prix' }, { status: 500 })
      }
    }
  }

  const { data: updated, error: updateErr } = await db
    .from('token_packs').update(updates).eq('id', id).select().single()
  if (updateErr) return NextResponse.json({ error: 'Erreur mise a jour DB' }, { status: 500 })

  await logPackAction(auth.adminId, 'update_token_pack', { pack_id: id, ...updates })
  return NextResponse.json(updated)
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminPermission('config.write')
  if (!auth.authorized) return NextResponse.json({ error: 'Non autorise' }, { status: auth.status })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parametres invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  const { nom, quantite_jetons, prix_eur, ordre_affichage } = parsed.data

  let stripePriceId: string
  try {
    const product = await stripe.products.create({ name: nom })
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(prix_eur * 100),
      currency: 'eur',
    })
    stripePriceId = price.id
  } catch (err) {
    console.error('[token-packs] stripe create error:', err)
    return NextResponse.json({ error: 'Erreur Stripe lors de la creation' }, { status: 500 })
  }

  const db = createAdminClient()
  const { data: newPack, error: insertErr } = await db
    .from('token_packs')
    .insert({
      nom,
      quantite_jetons,
      prix_eur,
      stripe_price_id: stripePriceId,
      actif: true,
      ordre_affichage: ordre_affichage ?? 0,
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: 'Erreur insertion DB' }, { status: 500 })

  await logPackAction(auth.adminId, 'create_token_pack', {
    pack_id: newPack.id, nom, quantite_jetons, prix_eur, stripe_price_id: stripePriceId,
  })
  return NextResponse.json(newPack, { status: 201 })
}

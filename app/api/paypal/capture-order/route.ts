import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { capturePayPalOrder } from '@/lib/paypal/client'
import { createServerClient } from '@supabase/ssr'
import { generateAndStoreSaasInvoice } from '@/lib/saas-invoice-generator'
import { saasInvoiceEmail } from '@/emails/saas-invoice'
import { sendEmail } from '@/lib/email/resend'


const schema = z.object({
  orderID:  z.string().min(1),
  itemType: z.string().min(1),
  userId:   z.string().uuid(),
})


function makeAdminDb() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

async function handleSaasInvoicePaypal(opts: {
  userId: string
  itemType: string
  orderID: string
}) {
  try {
    const { userId, itemType, orderID } = opts
    const db = makeAdminDb()

    const { data: account } = await db
      .from('user_accounts')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle()

    const acc = account as { email: string; full_name: string } | null
    const userEmail = acc?.email ?? ''
    const userName  = acc?.full_name ?? 'Client'

    if (!userEmail) {
      console.warn('[saas-invoice] PayPal — email introuvable pour userId:', userId)
      return
    }

    const { data: packDB } = await db
      .from('token_packs')
      .select('prix_eur, nom, quantite_jetons')
      .eq('id', itemType)
      .eq('actif', true)
      .maybeSingle()
    const description: string = packDB ? `${packDB.nom} – ${packDB.quantite_jetons} jetons` : 'Pack jetons NoX VTC'
    const montantTTC: number  = packDB?.prix_eur ?? 0
    const type: 'token_pack'  = 'token_pack'

    if (montantTTC <= 0) {
      console.log('[saas-invoice] PayPal — montant 0, pas de facture')
      return
    }

    const { numero, pdfSignedUrl } = await generateAndStoreSaasInvoice({
      userId, userEmail, userName, type, description,
      montantTTC, paymentProvider: 'paypal', providerReference: orderID,
    })

    const montant_ht = Math.round((montantTTC / 1.20) * 100) / 100
    const tva_amount = Math.round((montantTTC - montant_ht) * 100) / 100
    const { subject, html } = saasInvoiceEmail({
      userName, numero, description,
      montantTTC, montantHT: montant_ht, tvaAmount: tva_amount,
      pdfUrl: pdfSignedUrl ?? '', type,
    })

    const emailResult = await sendEmail(userEmail, subject, html)
    if (!emailResult.success) {
      console.error('[saas-invoice] PayPal — email error:', emailResult.error)
    } else {
      console.log('[saas-invoice] PayPal — email sent to:', userEmail)
    }

    await db
      .from('saas_invoices')
      .update({ email_sent_at: new Date().toISOString(), status: 'sent' })
      .eq('numero', numero)

    console.log('[saas-invoice] PayPal — done, numero:', numero)
  } catch (err) {
    console.error('[saas-invoice] PayPal — error:', err instanceof Error ? `${err.message}\n${err.stack}` : err)
  }
}

async function processCapture(orderID: string, itemType: string, userId: string) {
  const parsed = schema.safeParse({ orderID, itemType, userId })
  if (!parsed.success) return { error: 'Paramètres invalides', status: 400 }

  if (itemType === 'plan_duo' || itemType === 'plan_team') {
    return { error: 'Utilisez /api/paypal/create-subscription pour les abonnements', status: 400 }
  }

  try {
    await capturePayPalOrder(orderID)
  } catch (err) {
    console.error('[paypal/capture-order] capture error:', err)
    return { error: 'Erreur lors de la capture du paiement', status: 500 }
  }

  const db     = makeAdminDb()
  const isPack = !itemType.startsWith('plan_')

  if (isPack) {
    const { data: packDB } = await db
      .from('token_packs')
      .select('quantite_jetons')
      .eq('id', itemType)
      .eq('actif', true)
      .maybeSingle()
    const tokens = packDB?.quantite_jetons ?? 0
    
    const { data: wallet } = await db
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .maybeSingle()

    let walletId: string
    let balanceBefore: number
    let balanceAfter: number

    if (wallet) {
      const w       = wallet as { id: string; balance: number }
      walletId      = w.id
      balanceBefore = w.balance
      balanceAfter  = w.balance + tokens
      await db.from('wallets').update({ balance: balanceAfter }).eq('user_id', userId)
    } else {
      balanceBefore = 0
      balanceAfter  = tokens
      const { data: newWallet } = await db
        .from('wallets')
        .insert({ user_id: userId, balance: tokens })
        .select('id')
        .single()
      walletId = (newWallet as { id: string } | null)?.id ?? ''
    }

    await db.from('token_transactions').insert({
      user_id:       userId,
      type:          'purchase',
      amount:        tokens,
      description:   'Achat pack jetons (PayPal)',
      wallet_id:     walletId || null,
      balance_after: balanceAfter,
    })

    await handleSaasInvoicePaypal({ userId, itemType, orderID })

    return { redirectUrl: `/payment/success?type=token_pack&amount=${tokens}&before=${balanceBefore}&after=${balanceAfter}` }
  }

  return { error: 'Item inconnu', status: 400 }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orderID  = searchParams.get('token')    ?? ''  // PayPal redirects with ?token=ORDER_ID
  const itemType = searchParams.get('itemType') ?? ''
  const userId   = searchParams.get('userId')   ?? ''

  const result = await processCapture(orderID, itemType, userId)

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.noxvtc.fr'

  if ('error' in result) {
    return NextResponse.redirect(new URL(`/?paypal=error&msg=${encodeURIComponent(result.error ?? '')}`, baseUrl))
  }

  return NextResponse.redirect(new URL(result.redirectUrl, baseUrl))
}

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

  const { orderID, itemType, userId } = parsed.data
  const result = await processCapture(orderID, itemType, userId)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true, redirectUrl: result.redirectUrl })
}

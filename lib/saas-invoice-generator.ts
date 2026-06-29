import { jsPDF } from 'jspdf'
import { createAdminClient } from '@/lib/supabase/admin'

export interface SaasInvoiceParams {
  userId: string
  userEmail: string
  userName: string
  type: 'subscription' | 'token_pack'
  description: string
  montantTTC: number
  paymentProvider: 'stripe' | 'paypal'
  providerReference: string
}

function buildSaasInvoicePDF(params: {
  numero: string
  userName: string
  userEmail: string
  description: string
  montantTTC: number
  montant_ht: number
  tva_amount: number
  paymentProvider: 'stripe' | 'paypal'
}): ArrayBuffer {
  const { numero, userName, userEmail, description, montantTTC, montant_ht, tva_amount, paymentProvider } = params

  const doc = new jsPDF()
  const gold = '#D4AF37'
  const dark = '#1A1A1A'
  const gray = '#71717A'

  const now = new Date()
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`

  function fmtEur(n: number): string {
    const parts = n.toFixed(2).split('.')
    return parts[0] + ',' + parts[1] + ' €'
  }

  // HEADER GAUCHE — émetteur
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(dark)
  doc.text('ALLO VTC 77 LA FERTE SOUS JOUARRE', 20, 22)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(gray)
  doc.text('SIREN : 930159389', 20, 29)
  doc.text('TVA : FR27930159389', 20, 33.5)
  doc.text('Document émis par NoX VTC', 20, 38)

  // Séparateur vertical
  doc.setDrawColor('#dddddd')
  doc.setLineWidth(0.5)
  doc.line(105, 18, 105, 45)

  // HEADER DROIT
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(dark)
  doc.text('FACTURE', 190, 22, { align: 'right' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(gray)
  doc.text(`N° : ${numero}`, 190, 29, { align: 'right' })
  doc.text(`Date : ${dateStr}`, 190, 34, { align: 'right' })

  // Ligne séparatrice
  let y = 49
  doc.setDrawColor(230)
  doc.setLineWidth(0.3)
  doc.line(20, y, 190, y)
  y += 8

  // SECTION CLIENT
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(dark)
  doc.text('DESTINATAIRE', 20, y)
  y += 5
  doc.text(userName, 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(gray)
  doc.text(userEmail, 20, y)
  y += 10

  // SECTION DÉSIGNATION — tableau dark header
  doc.setFillColor(dark)
  doc.rect(20, y, 170, 10, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#FFFFFF')
  doc.text('Désignation', 25, y + 6.5)
  doc.text('Montant HT', 185, y + 6.5, { align: 'right' })
  y += 13

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(dark)
  const descLines = doc.splitTextToSize(description, 130) as string[]
  doc.text(descLines, 25, y)
  doc.text(fmtEur(montant_ht), 185, y, { align: 'right' })
  y += descLines.length * 5 + 8

  // SECTION TOTAUX
  doc.setDrawColor(200)
  doc.setLineWidth(0.3)
  doc.line(130, y, 190, y)
  y += 7

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(dark)

  doc.text('Total HT', 140, y)
  doc.text(fmtEur(montant_ht), 185, y, { align: 'right' })
  y += 6

  doc.text('TVA 20%', 140, y)
  doc.text(fmtEur(tva_amount), 185, y, { align: 'right' })
  y += 4.5
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(gray)
  doc.text('(art. 278 du CGI)', 142, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(dark)
  doc.setFontSize(9)
  y += 7

  // Ligne gold
  doc.setDrawColor(gold)
  doc.setLineWidth(0.5)
  doc.line(130, y, 190, y)
  y += 8

  // TOTAL TTC
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(gold)
  doc.text('TOTAL TTC', 130, y)
  doc.text(fmtEur(montantTTC), 185, y, { align: 'right' })

  // FOOTER
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor('#A0A0A0')
  doc.text('Document généré par NoX VTC', 105, 283, { align: 'center' })
  const providerLabel = paymentProvider === 'stripe' ? 'Stripe' : 'PayPal'
  doc.text(`Paiement reçu via ${providerLabel}`, 105, 288, { align: 'center' })

  return doc.output('arraybuffer')
}

export async function generateAndStoreSaasInvoice(params: SaasInvoiceParams): Promise<{ numero: string; pdfSignedUrl: string | null }> {
  const { userId, userEmail, userName, type, description, montantTTC, paymentProvider, providerReference } = params

  const db = createAdminClient()

  // A) Générer le numéro via RPC
  console.log('[saas-invoice] generating numero...')
  const { data: numeroData, error: rpcError } = await db.rpc('generate_saas_invoice_numero')
  if (rpcError) throw new Error(`RPC generate_saas_invoice_numero: ${rpcError.message}`)
  const numero = numeroData as string
  console.log('[saas-invoice] numero:', numero)

  // B) Calculer HT et TVA
  const montant_ht = Math.round((montantTTC / 1.20) * 100) / 100
  const tva_amount = Math.round((montantTTC - montant_ht) * 100) / 100

  // C) Générer le PDF
  console.log('[saas-invoice] generating PDF...')
  const pdfBuffer = buildSaasInvoicePDF({ numero, userName, userEmail, description, montantTTC, montant_ht, tva_amount, paymentProvider })

  // D) Créer le bucket s'il n'existe pas
  await db.storage.createBucket('saas-invoices', { public: false }).catch(() => { /* bucket déjà existant */ })

  // E) Uploader le PDF
  const storagePath = `${userId}/${numero}.pdf`
  console.log('[saas-invoice] uploading PDF to', storagePath)
  const { error: uploadError } = await db.storage
    .from('saas-invoices')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf' })
  if (uploadError) {
    console.warn('[saas-invoice] PDF upload warning:', uploadError.message)
  } else {
    console.log('[saas-invoice] PDF uploaded')
  }

  // E') Générer l'URL signée (1 an) immédiatement après l'upload
  const { data: signedData, error: signedError } = await db.storage
    .from('saas-invoices')
    .createSignedUrl(storagePath, 31536000)
  if (signedError || !signedData?.signedUrl) {
    console.error('[saas-invoice] signed URL error:', signedError)
  }
  const pdfSignedUrl = signedData?.signedUrl ?? null

  // F) Insérer dans saas_invoices — ON CONFLICT DO NOTHING via ignoreDuplicates
  console.log('[saas-invoice] inserting into saas_invoices...')
  const { data: inserted } = await db
    .from('saas_invoices')
    .upsert(
      {
        user_id: userId,
        numero,
        type,
        description,
        payment_provider: paymentProvider,
        provider_reference: providerReference,
        montant_ht,
        tva_rate: 20,
        tva_amount,
        montant_ttc: montantTTC,
        currency: 'EUR',
        status: 'issued',
        issued_at: new Date().toISOString(),
        pdf_url: storagePath,
      },
      { onConflict: 'payment_provider,provider_reference', ignoreDuplicates: true }
    )
    .select('numero')
    .maybeSingle()

  if (inserted) {
    const insertedNumero = (inserted as { numero: string }).numero
    console.log('[saas-invoice] inserted, numero:', insertedNumero)
    return { numero: insertedNumero, pdfSignedUrl }
  }

  // Conflit détecté — récupérer le numéro existant
  console.log('[saas-invoice] conflict — fetching existing numero...')
  const { data: existing } = await db
    .from('saas_invoices')
    .select('numero')
    .eq('payment_provider', paymentProvider)
    .eq('provider_reference', providerReference)
    .maybeSingle()

  const existingNumero = (existing as { numero: string } | null)?.numero ?? numero
  console.log('[saas-invoice] existing numero:', existingNumero)
  return { numero: existingNumero, pdfSignedUrl }
}

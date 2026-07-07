'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email/resend'
import { verifyAdminPermission } from '@/lib/supabase/admin'

export interface Recipient {
  userId: string
  email: string
  prenom: string
  solde?: number
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function sendCommunication(
  recipients: Recipient[],
  subject: string,
  body: string,
  segment: string
): Promise<{ sent: number; failed: number }> {
  const auth = await verifyAdminPermission('users.write')
  if (!auth.authorized) throw new Error('Non autorisé')
  let sent = 0
  let failed = 0

  for (const r of recipients) {
    if (!r.email) { failed++; continue }

    const personalizedBody = body
      .replace(/\{prenom\}/g, r.prenom || 'Abonné')
      .replace(/\{solde\}/g, String(r.solde ?? 0))

    const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;color:#333">
      <p>${personalizedBody.replace(/\n/g, '<br/>')}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="font-size:12px;color:#999">NoX VTC — noreply@noxvtc.fr</p>
    </div>`

    const result = await sendEmail(r.email, subject, html)
    if (result.success) sent++
    else failed++
  }

  const supabase = adminClient()
  await supabase.from('communication_logs').insert({
    segment,
    subject,
    recipients_count: sent,
    mode: 'manual',
    status: failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed',
  })

  revalidatePath('/admin/communications')
  return { sent, failed }
}

'use server'

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/resend'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function sendClientReply(
  ticketId: string,
  content: string,
  authorName: string,
  subject: string
) {
  const supabase = adminClient()

  const { data: ticket, error: fetchError } = await supabase
    .from('support_tickets')
    .select('messages, status')
    .eq('id', ticketId)
    .single()

  if (fetchError || !ticket) throw new Error('Ticket introuvable')

  const newMessage = { role: 'user', content, created_at: new Date().toISOString() }
  const updatedMessages = [...((ticket.messages as object[]) ?? []), newMessage]

  const { error } = await supabase
    .from('support_tickets')
    .update({
      messages: updatedMessages,
      status: 'open',
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)

  if (error) throw new Error(error.message)

  const adminEmail = process.env.ADMIN_EMAIL ?? 'bernardnoubi@gmail.com'
  const ticketUrl = `https://app.noxvtc.fr/admin/support/${ticketId}`

  await sendEmail(
    adminEmail,
    `Nouvelle réponse sur ticket : ${subject}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
      <p>L'abonné <strong>${authorName}</strong> a répondu à son ticket.</p>
      <p><strong>Sujet :</strong> ${subject}</p>
      <blockquote style="border-left:3px solid #C5A059;padding:12px 16px;background:#fafafa;color:#333;margin:16px 0">
        ${content.replace(/\n/g, '<br/>')}
      </blockquote>
      <p><a href="${ticketUrl}" style="color:#C5A059">Accéder au ticket</a></p>
    </div>`
  )
}

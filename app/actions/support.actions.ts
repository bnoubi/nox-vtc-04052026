'use server'

import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/resend'
import { ADMIN_URL } from '@/lib/admin-url'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getAdminEmail() {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) throw new Error('ADMIN_EMAIL is not configured')
  return adminEmail
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

  const adminEmail = getAdminEmail()
  const ticketUrl = `${ADMIN_URL}/admin/support/${ticketId}`

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

export async function notifyAdminNewTicket(ticketId: string) {
  const supabase = adminClient()

  const { data: ticket, error: fetchError } = await supabase
    .from('support_tickets')
    .select('subject, subject_category, priority, messages, user_id')
    .eq('id', ticketId)
    .single()

  if (fetchError || !ticket) throw new Error('Ticket introuvable')

  const { data: userData } = await supabase.auth.admin.getUserById(ticket.user_id)
  const userEmail = userData?.user?.email ?? 'inconnu'

  const messages = (ticket.messages as { content?: string }[]) ?? []
  const content = messages[0]?.content ?? ''

  const adminEmail = getAdminEmail()
  const ticketUrl = `${ADMIN_URL}/admin/support/${ticketId}`

  await sendEmail(
    adminEmail,
    `Nouveau ticket support : ${ticket.subject}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
      <p>Un nouveau ticket support vient d'être créé.</p>
      <p><strong>Sujet :</strong> ${ticket.subject}</p>
      <p><strong>Catégorie :</strong> ${ticket.subject_category}</p>
      <p><strong>Priorité :</strong> ${ticket.priority}</p>
      <p><strong>Abonné :</strong> ${userEmail}</p>
      <blockquote style="border-left:3px solid #C5A059;padding:12px 16px;background:#fafafa;color:#333;margin:16px 0">
        ${content.replace(/\n/g, '<br/>')}
      </blockquote>
      <p><a href="${ticketUrl}" style="color:#C5A059">Accéder au ticket</a></p>
    </div>`
  )
}

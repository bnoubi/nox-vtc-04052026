'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email/resend'
import { verifyAdminPermission } from '@/lib/supabase/admin'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const auth = await verifyAdminPermission('tickets.write')
  if (!auth.authorized) throw new Error('Non autorisé')
  const supabase = adminClient()
  const update: Record<string, string> = { status, updated_at: new Date().toISOString() }
  if (status === 'resolved') update.resolved_at = new Date().toISOString()
  const { error } = await supabase.from('support_tickets').update(update).eq('id', ticketId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/support/${ticketId}`)
  revalidatePath('/admin/support')
}

export async function updateTicketPriority(ticketId: string, priority: string) {
  const auth = await verifyAdminPermission('tickets.write')
  if (!auth.authorized) throw new Error('Non autorisé')
  const supabase = adminClient()
  const { error } = await supabase
    .from('support_tickets')
    .update({ priority, updated_at: new Date().toISOString() })
    .eq('id', ticketId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/support/${ticketId}`)
}

export async function sendAdminReply(ticketId: string, content: string, userEmail: string, subject: string) {
  const auth = await verifyAdminPermission('tickets.write')
  if (!auth.authorized) throw new Error('Non autorisé')
  const supabase = adminClient()

  const { data: ticket, error: fetchError } = await supabase
    .from('support_tickets')
    .select('messages, status')
    .eq('id', ticketId)
    .single()

  if (fetchError || !ticket) throw new Error('Ticket introuvable')

  const newMessage = { role: 'admin', content, created_at: new Date().toISOString() }
  const updatedMessages = [...((ticket.messages as object[]) ?? []), newMessage]

  const update: Record<string, unknown> = {
    messages: updatedMessages,
    updated_at: new Date().toISOString(),
  }
  if (ticket.status === 'open') update.status = 'in_progress'

  const { error } = await supabase.from('support_tickets').update(update).eq('id', ticketId)
  if (error) throw new Error(error.message)

  await sendEmail(
    userEmail,
    `Réponse à votre demande de support : ${subject}`,
    `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
      <p>Bonjour,</p>
      <p>Votre demande de support concernant <strong>${subject}</strong> a reçu une réponse :</p>
      <blockquote style="border-left:3px solid #C5A059;padding:12px 16px;background:#fafafa;color:#333;margin:16px 0">
        ${content.replace(/\n/g, '<br/>')}
      </blockquote>
      <p>Vous pouvez consulter votre ticket depuis votre espace client.</p>
      <p style="color:#666">Cordialement,<br/>L'équipe NoX VTC</p>
    </div>`
  )

  revalidatePath(`/admin/support/${ticketId}`)
  revalidatePath('/admin/support')
}

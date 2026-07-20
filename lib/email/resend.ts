import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options?: { scheduledAt?: string; fromName?: string; replyTo?: string },
): Promise<{ success: boolean; error?: string }> {
  const from = options?.fromName
    ? `${options.fromName} <noreply@noxvtc.fr>`
    : 'NoX VTC <noreply@noxvtc.fr>'
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
    ...(options?.replyTo ? { replyTo: options.replyTo } : {}),
    ...(options?.scheduledAt ? { scheduledAt: options.scheduledAt } : {}),
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

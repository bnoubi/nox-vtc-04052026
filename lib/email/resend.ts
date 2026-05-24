import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await resend.emails.send({
    from: 'NoX VTC <noreply@noxvtc.fr>',
    to: [to],
    subject,
    html,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

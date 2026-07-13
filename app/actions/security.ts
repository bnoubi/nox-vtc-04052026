"use server"

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { passwordChangedEmail } from '@/emails/password-changed'

export async function sendPasswordChangedEmailAction(): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return

    const db = createAdminClient()
    const { data: account } = await db
      .from('user_accounts')
      .select('prenom, nom, full_name')
      .eq('id', user.id)
      .maybeSingle()

    const a = account as { prenom?: string | null; nom?: string | null; full_name?: string | null } | null
    const prenom = a?.prenom?.trim() || a?.full_name?.split(' ')[0]?.trim() || ''
    const nom = a?.nom?.trim() || a?.full_name?.split(' ').slice(1).join(' ').trim() || ''

    const { subject, html } = passwordChangedEmail({ prenom, nom })
    await sendEmail(user.email, subject, html)
  } catch {
    // email failure never bubbles up
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { twoFactorCodeEmail } from '@/emails/2fa-code'
import { createHash, randomInt } from 'crypto'

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function generateCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ ok: false }, { status: 401 })

  const db = createAdminClient()
  const code = generateCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await db.from('two_factor_codes').insert({ user_id: user.id, code_hash: codeHash, expires_at: expiresAt })

  const { data: account } = await db
    .from('user_accounts')
    .select('prenom, nom, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const a = account as { prenom?: string | null; full_name?: string | null } | null
  const prenom = a?.prenom?.trim() || a?.full_name?.split(' ')[0]?.trim() || ''

  const { subject, html } = twoFactorCodeEmail({ prenom, code })
  await sendEmail(user.email, subject, html)

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createHash, randomInt } from 'crypto'
import { sendEmail } from '@/lib/email/resend'
import { accountDeletionOtpEmail } from '@/emails/account-deletion-otp'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const captchaToken: string | undefined = body?.captchaToken

  if (!captchaToken) {
    console.warn('[request-deletion-otp] captchaToken absent — userId:', user.id)
    return NextResponse.json({ error: 'Token de sécurité manquant' }, { status: 400 })
  }

  console.log('[request-deletion-otp] captchaToken présent — userId:', user.id)

  const db = createAdminClient()
  const { data: authData, error: authError } = await db.auth.admin.getUserById(user.id)

  if (authError || !authData?.user) {
    console.error('[request-deletion-otp] getUserById error:', authError)
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  const provider: string = authData.user.app_metadata?.provider ?? 'email'
  console.log('[request-deletion-otp] userId:', user.id, '| provider:', provider)

  if (provider === 'email') {
    return NextResponse.json({ method: 'password' })
  }

  // OAuth provider — génération d'un OTP maison via Resend
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  const codeHash = createHash('sha256').update(code).digest('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  console.log('[request-deletion-otp] OTP généré pour userId:', user.id, '| expires_at:', expiresAt)

  const { error: insertError } = await db
    .from('account_deletion_otp')
    .insert({ user_id: user.id, code_hash: codeHash, expires_at: expiresAt, used: false })

  if (insertError) {
    console.error('[request-deletion-otp] INSERT error:', insertError)
    return NextResponse.json({ error: "Impossible de générer le code de vérification" }, { status: 500 })
  }

  // Récupère le prénom depuis user_metadata OAuth ou fallback email
  const userName: string =
    authData.user.user_metadata?.full_name ??
    authData.user.user_metadata?.name ??
    user.email

  const { subject, html } = accountDeletionOtpEmail({ userName, code })
  const { success, error: emailError } = await sendEmail(user.email, subject, html)

  if (!success) {
    console.error('[request-deletion-otp] sendEmail error:', emailError)
    return NextResponse.json({ error: "Impossible d'envoyer le code de vérification" }, { status: 500 })
  }

  console.log('[request-deletion-otp] OTP email envoyé — userId:', user.id)
  return NextResponse.json({ method: 'otp' })
}

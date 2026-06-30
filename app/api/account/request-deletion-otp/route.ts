import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Valider la présence du captchaToken avant tout appel Supabase
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

  // OAuth provider (google, apple, facebook…) → envoyer un OTP par email
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: {
      shouldCreateUser: false,
      captchaToken,
    },
  })

  if (otpError) {
    console.error('[request-deletion-otp] OTP send error:', otpError)
    return NextResponse.json({ error: "Impossible d'envoyer le code de vérification" }, { status: 500 })
  }

  console.log('[request-deletion-otp] OTP sent — userId:', user.id)
  return NextResponse.json({ method: 'otp' })
}

import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EmailOtpType, Session } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash') || requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.noxvtc.fr'

  const supabase = await createClient()

  let session: Session | null = null
  let exchangeError: { message: string } | null = null

  // Cas 1 : PKCE flow (?code=XXX) — magic link moderne, OAuth Google
  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code)
    session = result.data.session
    exchangeError = result.error
    console.log('[Auth Callback] PKCE exchange — session:', !!session, 'err:', result.error?.message ?? 'NULL')
  }
  // Cas 2 : Implicit/OTP flow (?token_hash=XXX&type=magiclink) — legacy
  else if (tokenHash) {
    // Mapper le `type` URL vers EmailOtpType Supabase. Notre custom type=onboarding
    // est rétro-mappé vers 'magiclink' (default OTP email).
    const otpType: EmailOtpType =
      type === 'recovery' ? 'recovery'
      : type === 'signup' ? 'signup'
      : type === 'invite' ? 'invite'
      : type === 'email_change' ? 'email_change'
      : type === 'email' ? 'email'
      : 'magiclink'

    const result = await supabase.auth.verifyOtp({ type: otpType, token_hash: tokenHash })
    session = result.data.session
    exchangeError = result.error
    console.log('[Auth Callback] OTP verify — type:', otpType, 'session:', !!session, 'err:', result.error?.message ?? 'NULL')
  } else {
    console.warn('[Auth Callback] Aucun code ni token_hash dans l\'URL')
  }

  if (exchangeError) {
    console.error('[Auth Callback] Erreur échange:', exchangeError.message)
    return NextResponse.redirect(new URL('/login?error=auth', siteUrl))
  }

  if (session?.user) {
    const adminClient = createAdminClient()

    // Trial TEAM 14 jours si pas encore créé
    const { data: existingSub } = await adminClient
      .from('subscriptions')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!existingSub) {
      console.log('[Auth Callback] creating trial for:', session.user.id)
      await adminClient
        .from('wallets')
        .upsert({ user_id: session.user.id, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true })

      await adminClient
        .from('subscriptions')
        .insert({
          user_id: session.user.id,
          plan: 'TEAM',
          status: 'trial',
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        })
    }

    // Recovery password → page reset
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/reset-password', siteUrl))
    }

    // Confirmation signup password legacy → page de succès
    if (type === 'signup') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/auth/confirmed', siteUrl))
    }

    // Reprise onboarding ou dashboard selon onboarding_status
    const { data: account } = await adminClient
      .from('user_accounts')
      .select('onboarding_status, onboarding_step')
      .eq('id', session.user.id)
      .maybeSingle()

    const status = account?.onboarding_status ?? 'not_started'
    if (status !== 'completed') {
      const stepParam = account?.onboarding_step ?? 0
      return NextResponse.redirect(new URL(`/?resume_step=${stepParam}`, siteUrl))
    }

    return NextResponse.redirect(new URL('/', siteUrl))
  }

  // Pas de session établie sans erreur explicite — fallback recovery / dashboard
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', siteUrl))
  }
  return NextResponse.redirect(new URL('/', siteUrl))
}

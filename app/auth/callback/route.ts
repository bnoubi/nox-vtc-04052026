import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EmailOtpType, Session } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  console.log('[callback] url complète:', requestUrl.toString())
  console.log('[callback] searchParams:', Object.fromEntries(requestUrl.searchParams))

  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash') || requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.noxvtc.fr'

  console.log('[callback] code présent:', !!code)
  console.log('[callback] token_hash présent:', !!tokenHash)
  console.log('[callback] type param:', type)

  const supabase = await createClient()

  let session: Session | null = null
  let exchangeError: { message: string } | null = null

  // Cas 1 : PKCE flow (?code=XXX) — magic link moderne, OAuth Google
  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code)
    session = result.data.session
    exchangeError = result.error
    console.log('[callback] PKCE exchange — err:', result.error?.message ?? 'NULL')
  }
  // Cas 2 : Implicit/OTP flow (?token_hash=XXX&type=magiclink) — legacy
  else if (tokenHash) {
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
    console.log('[callback] OTP verify — type:', otpType, 'err:', result.error?.message ?? 'NULL')
  } else {
    console.warn('[callback] Aucun code ni token_hash dans l\'URL')
  }

  console.log('[callback] session établie:', !!session)
  console.log('[callback] user:', session?.user?.id)
  console.log('[callback] nouveau user créé:', session?.user?.id, 'email:', session?.user?.email)

  if (exchangeError) {
    console.error('[callback] Erreur échange:', exchangeError.message)
    const redirectUrl = new URL('/login?error=auth', siteUrl).toString()
    console.log('[callback] redirect vers:', redirectUrl)
    return NextResponse.redirect(redirectUrl)
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
      console.log('[callback] creating trial for:', session.user.id)
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
      const redirectUrl = new URL('/reset-password', siteUrl).toString()
      console.log('[callback] redirect vers:', redirectUrl)
      return NextResponse.redirect(redirectUrl)
    }

    // Confirmation signup password legacy → page de succès
    if (type === 'signup') {
      await supabase.auth.signOut()
      const redirectUrl = new URL('/auth/confirmed', siteUrl).toString()
      console.log('[callback] redirect vers:', redirectUrl)
      return NextResponse.redirect(redirectUrl)
    }

    // Reprise onboarding ou dashboard selon onboarding_status
    let { data: account, error: accountErr } = await adminClient
      .from('user_accounts')
      .select('onboarding_status, onboarding_step')
      .eq('id', session.user.id)
      .maybeSingle()

    // Filet de sécurité : si le trigger handle_new_user_account a silencieusement
    // échoué (EXCEPTION WHEN OTHERS), on crée la ligne ici puis on re-SELECT.
    if (!account && !accountErr) {
      console.warn('[callback] user_accounts row missing, creating it now')
      const { error: insertErr } = await adminClient
        .from('user_accounts')
        .insert({
          id: session.user.id,
          email: session.user.email ?? '',
          plan: 'SOLO',
          tokens: 0,
          onboarding_status: 'not_started',
          onboarding_step: 0,
        })
      if (insertErr) {
        console.error('[callback] user_accounts insert err:', insertErr.code, insertErr.message)
        if (insertErr.code === '23505') {
          console.warn('[callback] doublon user_accounts détecté (email ou id existant) — résidu d\'un ancien compte non purgé ?')
        }
      }
      const reselect = await adminClient
        .from('user_accounts')
        .select('onboarding_status, onboarding_step')
        .eq('id', session.user.id)
        .maybeSingle()
      account = reselect.data
      accountErr = reselect.error
    }

    console.log('[callback] onboarding_status:', account?.onboarding_status)
    console.log('[callback] onboarding_step (db):', account?.onboarding_step)
    if (accountErr) console.error('[callback] user_accounts lookup err:', accountErr.message)

    const status = account?.onboarding_status ?? 'not_started'
    if (status !== 'completed') {
      const stepParam = account?.onboarding_step ?? 0
      const redirectUrl = new URL(`/?resume_step=${stepParam}`, siteUrl).toString()
      console.log('[callback] redirect vers:', redirectUrl)
      return NextResponse.redirect(redirectUrl)
    }

    const redirectUrl = new URL('/', siteUrl).toString()
    console.log('[callback] redirect vers:', redirectUrl)
    return NextResponse.redirect(redirectUrl)
  }

  // Pas de session établie sans erreur explicite — fallback
  if (type === 'recovery') {
    const redirectUrl = new URL('/reset-password', siteUrl).toString()
    console.log('[callback] redirect vers (fallback recovery):', redirectUrl)
    return NextResponse.redirect(redirectUrl)
  }
  const redirectUrl = new URL('/', siteUrl).toString()
  console.log('[callback] redirect vers (fallback no-session):', redirectUrl)
  return NextResponse.redirect(redirectUrl)
}

import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { EmailOtpType, Session } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  console.log('[callback] url complète:', requestUrl.toString())
  console.log('[callback] searchParams:', Object.fromEntries(requestUrl.searchParams))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.noxvtc.fr'

  // Cas 0 : Supabase a rejeté le lien AVANT l'échange et envoie l'erreur
  // directement en query params (?error=access_denied&error_code=otp_expired).
  // Dans ce cas il n'y a ni code ni token_hash — à court-circuiter immédiatement.
  const urlError = requestUrl.searchParams.get('error')
  const urlErrorCode = requestUrl.searchParams.get('error_code')
  if (urlError) {
    const isExpired = urlErrorCode === 'otp_expired' || urlError === 'access_denied'
    const redirectUrl = new URL(`/login?error=${isExpired ? 'link_expired' : 'auth'}`, siteUrl).toString()
    console.log('[callback] erreur détectée en query params, redirect vers:', redirectUrl)
    return NextResponse.redirect(redirectUrl)
  }

  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash') || requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')

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
    const errMsg = exchangeError.message.toLowerCase()
    const errCode = (exchangeError as { code?: string }).code
    const isExpiredLink =
      errCode === 'otp_expired' ||
      errMsg.includes('expired') ||
      (errMsg.includes('invalid') && errMsg.includes('token'))
    const errorParam = isExpiredLink ? 'link_expired' : 'auth'
    const redirectUrl = new URL(`/login?error=${errorParam}`, siteUrl).toString()
    console.log('[callback] redirect vers:', redirectUrl)
    return NextResponse.redirect(redirectUrl)
  }

  if (session?.user) {
    const adminClient = createAdminClient()
    const userId = session.user.id
    const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>
    const metaFullName = typeof meta.full_name === 'string' ? meta.full_name
      : typeof meta.name === 'string' ? meta.name : null

    // Backfill défensif (idempotent) : rattrape silencieusement tout trigger
    // DB qui aurait échoué (le RAISE WARNING ajouté côté SQL logue l'erreur
    // mais ne bloque pas la création de auth.users). Tous les upserts
    // utilisent ON CONFLICT DO NOTHING — JAMAIS DO UPDATE — donc une ligne
    // déjà créée par le trigger ne sera jamais écrasée.

    // Lire le feature flag — même logique que le trigger PG
    const { data: flagRow } = await adminClient
      .from('app_config')
      .select('value')
      .eq('key', 'disable_auto_trial')
      .maybeSingle()
    const disableTrial = flagRow?.value === 'true'

    const subscriptionPayload = disableTrial
      ? { user_id: userId, plan: 'SOLO', status: 'active', target_plan: 'solo',
          trial_started_at: null as string | null, trial_ends_at: null as string | null }
      : { user_id: userId, plan: 'TEAM', status: 'trial', target_plan: 'solo',
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() }

    const tasks: Promise<unknown>[] = [
      adminClient
        .from('wallets')
        .upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true }),
      adminClient
        .from('subscriptions')
        .upsert(subscriptionPayload, { onConflict: 'user_id', ignoreDuplicates: true }),
    ]
    if (session.user.email) {
      tasks.push(
        adminClient
          .from('user_accounts')
          .upsert({
            id: userId,
            email: session.user.email,
            full_name: metaFullName,
            plan: 'SOLO',
            onboarding_step: 0,
          }, { onConflict: 'id', ignoreDuplicates: true })
      )
    } else {
      console.warn('[callback] session.user.email manquant — user_accounts backfill skipped pour', userId)
    }
    const results = await Promise.all(tasks)
    for (const r of results) {
      const err = (r as { error?: { message?: string; code?: string } | null }).error
      if (err) console.error('[callback] backfill error:', err.code, err.message)
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

    // Invitation admin → définition du mot de passe obligatoire avant tout accès.
    // generateLink type:'invite' établit une session mais ne crée pas de mot de passe.
    // On redirige vers /auth/reset-password (session active = updateUser fonctionne),
    // qui après succès renvoie vers / → le bypass admin prend le relais vers /admin/dashboard.
    if (type === 'invite') {
      const redirectUrl = new URL('/auth/reset-password', siteUrl).toString()
      console.log('[callback] invite admin détecté, redirect vers:', redirectUrl)
      return NextResponse.redirect(redirectUrl)
    }

    // Admin bypass → back-office directement, jamais onboarding chauffeur
    const { data: adminRole } = await adminClient
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()
    if (adminRole) {
      const redirectUrl = new URL('/admin/dashboard', siteUrl).toString()
      console.log('[callback] admin détecté, redirect vers:', redirectUrl)
      return NextResponse.redirect(redirectUrl)
    }

    // Reprise onboarding ou dashboard selon onboarding_status
    let { data: account, error: accountErr } = await adminClient
      .from('user_accounts')
      .select('onboarding_status, onboarding_step, two_factor_email_enabled')
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
        .select('onboarding_status, onboarding_step, two_factor_email_enabled')
        .eq('id', session.user.id)
        .maybeSingle()
      account = reselect.data
      accountErr = reselect.error
    }

    console.log('[callback] onboarding_status:', account?.onboarding_status)
    console.log('[callback] onboarding_step (db):', account?.onboarding_step)
    if (accountErr) console.error('[callback] user_accounts lookup err:', accountErr.message)

    const status = account?.onboarding_status ?? 'not_started'
    const finalDest = status !== 'completed'
      ? `/?resume_step=${account?.onboarding_step ?? 0}`
      : '/'

    // Email 2FA : rediriger vers la page de vérification en passant la destination finale
    const a2fa = account as { two_factor_email_enabled?: boolean } | null
    if (a2fa?.two_factor_email_enabled) {
      const next = encodeURIComponent(new URL(finalDest, siteUrl).toString())
      const redirectUrl = new URL(`/verify-email-code?next=${next}`, siteUrl).toString()
      console.log('[callback] email 2FA activée, redirect vers:', redirectUrl)
      return NextResponse.redirect(redirectUrl)
    }

    const redirectUrl = new URL(finalDest, siteUrl).toString()
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

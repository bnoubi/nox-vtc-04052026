import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.noxvtc.fr'

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[Auth Callback] Session établie:', !!session, 'type:', type)
    console.log('[Auth Callback] session user:', session?.user?.id ?? 'NULL')
    console.log('[Auth Callback] error:', error?.message ?? 'NULL')

    if (error) {
      console.error('[Auth Callback] Erreur échange de code:', error.message)
      // Ne jamais rediriger vers /login ici — cela crée une boucle OAuth si un trigger DB
      // échoue lors de la création du compte. L'app gère le renvoi vers /login côté client.
      return NextResponse.redirect(new URL('/', siteUrl))
    }

    // Créer trial AVANT toute redirection, y compris signup
    if (session?.user) {
      const adminClient = createAdminClient()

      const { data: existingSub } = await adminClient
        .from('subscriptions')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      console.log('[Auth Callback] existingSub:', existingSub)
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

        console.log('[Auth Callback] Trial TEAM créé pour:', session.user.id)
      }

      // Reprise onboarding : si non terminé, rediriger vers / avec resume_step
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
    }

    // Confirmation d'inscription password (legacy) : sign-out puis page de succès
    if (type === 'signup') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/auth/confirmed', siteUrl))
    }
  }

  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', siteUrl))
  }

  return NextResponse.redirect(new URL('/', siteUrl))
}

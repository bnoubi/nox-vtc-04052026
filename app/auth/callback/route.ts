import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.noxvtc.fr'

  console.log('[Auth Callback] Code reçu:', !!code)

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('[Auth Callback] Session établie:', !!session)

    if (error) {
      console.error('[Auth Callback] Erreur échange de code:', error.message)
      // Ne jamais rediriger vers /login ici — cela crée une boucle OAuth si un trigger DB
      // échoue lors de la création du compte. L'app gère le renvoi vers /login côté client.
      const redirectTo = '/'
      console.log('[Auth Callback] Redirect vers:', redirectTo)
      return NextResponse.redirect(new URL(redirectTo, siteUrl))
    }

    // Confirmation d'inscription : sign-out puis page de succès
    if (type === 'signup') {
      await supabase.auth.signOut()
      const redirectTo = '/auth/confirmed'
      console.log('[Auth Callback] Redirect vers:', redirectTo)
      return NextResponse.redirect(new URL(redirectTo, siteUrl))
    }
  }

  if (type === 'recovery') {
    const redirectTo = '/reset-password'
    console.log('[Auth Callback] Redirect vers:', redirectTo)
    return NextResponse.redirect(new URL(redirectTo, siteUrl))
  }

  const redirectTo = '/'
  console.log('[Auth Callback] Redirect vers:', redirectTo)
  return NextResponse.redirect(new URL(redirectTo, siteUrl))
}

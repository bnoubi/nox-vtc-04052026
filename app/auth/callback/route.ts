import { NextResponse, NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')
  
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(new URL('/login?error=Invalid+Link', requestUrl.origin))
    }

    // Confirmation d'inscription : on signe out (l'email est confirmé côté Supabase)
    // puis on redirige vers la page de succès pour que l'utilisateur se connecte manuellement
    if (type === 'signup') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/auth/confirmed', requestUrl.origin))
    }
  }

  // Si le flux est de type recovery, on redirige vers l'écran de nouveau mot de passe
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
  }

  // Si c'est un email_change ou autre, on redirige à la racine après succès
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}

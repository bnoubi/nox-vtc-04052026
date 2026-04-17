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
  }

  // Si le flux est de type recovery, on redirige vers l'écran de nouveau mot de passe
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
  }

  // Si c'est un email_change ou un signup on redirige à la racine après succès
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}

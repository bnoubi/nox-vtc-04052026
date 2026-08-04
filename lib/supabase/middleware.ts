import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with cross-browser cookies.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // AuthApiError (e.g. refresh_token_not_found) — treat as unauthenticated
  }

  const { pathname } = request.nextUrl

  // /auth/callback doit être TOUJOURS accessible — la session y est établie via exchangeCodeForSession.
  // Toute vérification d'auth ici provoquerait une boucle OAuth si la session n'est pas encore prête.
  const isCallbackRoute =
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/confirmed') ||
    pathname.startsWith('/auth/reset-password')

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/auth')

  const isApiRoute = pathname.startsWith('/api')

  const isPublicRoute =
    pathname.startsWith('/politique-de-confidentialite') ||
    pathname.startsWith('/politique-de-cookies') ||
    pathname.startsWith('/request/')

  // Routes publiques : auth + callback + pages légales → jamais de redirection vers /login
  if (!user && !isAuthRoute && !isApiRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Utilisateur connecté sur /login ou /register → rediriger vers l'app
  // /auth/callback, /auth/confirmed, /auth/reset-password restent toujours accessibles
  if (user && isAuthRoute && !isCallbackRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

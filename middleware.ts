import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

function buildCspHeaders(request: NextRequest): { nonce: string; csp: string } {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com https://maps.googleapis.com https://maps.gstatic.com https://static.axept.io https://*.axept.io https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' blob: https://maps.googleapis.com https://maps.gstatic.com https://*.supabase.co https://images.unsplash.com https://static.axept.io https://*.axept.io https://axeptio.imgix.net https://www.google-analytics.com https://storage.googleapis.com",
    "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com https://maps.googleapis.com https://places.googleapis.com https://routes.googleapis.com https://recherche-entreprises.api.gouv.fr wss://*.supabase.co https://*.axept.io https://www.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
    "frame-src 'self' https://challenges.cloudflare.com https://*.axept.io",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')
  return { nonce, csp }
}

function isAdminHost(request: NextRequest): boolean {
  const host = request.headers.get('host') ?? ''
  const adminHost = process.env.NEXT_PUBLIC_ADMIN_HOST ?? ''
  return adminHost !== '' && host === adminHost
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { nonce, csp } = buildCspHeaders(request)

  const patchedHeaders = new Headers(request.headers)
  patchedHeaders.set('x-nonce', nonce)
  const patchedRequest = new NextRequest(request, { headers: patchedHeaders })

  let response: NextResponse

  if (isAdminHost(request)) {
    response = await handleAdminSubdomain(patchedRequest)
  } else if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin/')) {
    // Phase 9 — /admin/* et /api/admin/* fermés sur app.noxvtc.fr
    response = new NextResponse(null, { status: 404 })
  } else {
    response = await updateSession(patchedRequest)
  }

  response.headers.set('content-security-policy', csp)
  return response
}

type AuthResult =
  | { ok: true; supabaseResponse: NextResponse }
  | { ok: false; redirect: NextResponse }

async function checkAdminAuth(request: NextRequest): Promise<AuthResult> {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabaseAuth.auth.getUser()
    user = data.user
  } catch {
    // AuthApiError — treat as unauthenticated
  }

  if (!user) {
    console.warn(`[proxy/admin] no_session — ${request.nextUrl.pathname}`)
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('error', 'unauthorized')
    return { ok: false, redirect: NextResponse.redirect(url) }
  }

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const { data: userRole } = await supabaseAdmin
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!userRole) {
    console.warn(`[proxy/admin] not_admin — ${request.nextUrl.pathname} — user: ${user.id}`)
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('error', 'unauthorized')
    return { ok: false, redirect: NextResponse.redirect(url) }
  }

  return { ok: true, supabaseResponse }
}

async function handleAdminSubdomain(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Normalize / and /admin (exact) to /admin/dashboard
  const targetPathname =
    pathname === '/' || pathname === '/admin' ? '/admin/dashboard' : pathname

  // Public paths — no auth check
  if (
    targetPathname === '/admin/login' ||
    targetPathname.startsWith('/api/admin/') ||
    targetPathname === '/auth/callback' ||
    targetPathname.startsWith('/_next/') ||
    targetPathname.startsWith('/.well-known/')
  ) {
    return NextResponse.next({ request })
  }

  // Any non-/admin path on admin subdomain → 404
  if (!targetPathname.startsWith('/admin')) {
    return new NextResponse(null, { status: 404 })
  }

  // Protected /admin/* — check auth
  const auth = await checkAdminAuth(request)
  if (!auth.ok) return auth.redirect

  // If pathname was normalized (/ or /admin → /admin/dashboard), rewrite internally
  if (pathname !== targetPathname) {
    const url = request.nextUrl.clone()
    url.pathname = targetPathname
    const rewrite = NextResponse.rewrite(url)
    auth.supabaseResponse.cookies.getAll().forEach(({ name, value, ...opts }) =>
      rewrite.cookies.set(name, value, opts)
    )
    return rewrite
  }

  return auth.supabaseResponse
}

async function handleAdminRoute(request: NextRequest): Promise<NextResponse> {
  const auth = await checkAdminAuth(request)
  if (!auth.ok) return auth.redirect
  return auth.supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|data/|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

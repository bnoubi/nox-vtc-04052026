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
    "img-src 'self' blob: https://maps.googleapis.com https://maps.gstatic.com https://*.supabase.co https://images.unsplash.com https://*.axept.io https://www.google-analytics.com",
    "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com https://maps.googleapis.com https://places.googleapis.com https://routes.googleapis.com https://recherche-entreprises.api.gouv.fr wss://*.supabase.co https://*.axept.io https://www.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
    "frame-src https://challenges.cloudflare.com https://*.axept.io",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')
  return { nonce, csp }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { nonce, csp } = buildCspHeaders(request)

  const patchedHeaders = new Headers(request.headers)
  patchedHeaders.set('x-nonce', nonce)
  const patchedRequest = new NextRequest(request, { headers: patchedHeaders })

  let response: NextResponse

  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') {
      response = NextResponse.next({ request: patchedRequest })
    } else {
      response = await handleAdminRoute(patchedRequest)
    }
  } else {
    response = await updateSession(patchedRequest)
  }

  response.headers.set('content-security-policy', csp)
  return response
}

async function handleAdminRoute(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request })

  // Client anon avec cookies pour valider la session utilisateur
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
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    return NextResponse.redirect(url)
  }

  // Client service role pour contourner la RLS sur user_roles/admin_roles
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  )

  const { data: adminRoles } = await supabaseAdmin
    .from('admin_roles')
    .select('id')
    .in('code', ['admin', 'super_admin'])

  if (!adminRoles || adminRoles.length === 0) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  const adminRoleIds = (adminRoles as { id: string }[]).map((r) => r.id)

  const { data: userRole } = await supabaseAdmin
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .in('admin_role_id', adminRoleIds)
    .limit(1)
    .maybeSingle()

  if (!userRole) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|data/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

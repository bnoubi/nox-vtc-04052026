import { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com https://maps.googleapis.com https://maps.gstatic.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' blob: https://maps.googleapis.com https://maps.gstatic.com https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co https://maps.googleapis.com https://places.googleapis.com https://routes.googleapis.com wss://*.supabase.co",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')

  const patchedHeaders = new Headers(request.headers)
  patchedHeaders.set('x-nonce', nonce)
  const patchedRequest = new NextRequest(request, { headers: patchedHeaders })

  const response = await updateSession(patchedRequest)
  response.headers.set('content-security-policy', csp)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

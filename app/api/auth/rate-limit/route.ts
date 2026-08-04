import { NextRequest, NextResponse } from 'next/server'
import { checkLoginRateLimit, recordFailedLogin } from '@/lib/auth/rate-limit'

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid' }, { status: 400 }) }
  const { action, email } = body as { action?: string; email?: string }
  if (!email || typeof email !== 'string' || email.length > 254) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  if (action === 'check') {
    return NextResponse.json(checkLoginRateLimit(email))
  }
  if (action === 'record') {
    recordFailedLogin(email)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown' }, { status: 400 })
}

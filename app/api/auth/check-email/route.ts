import { NextResponse, NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string } | null
  const email = body?.email?.trim().toLowerCase()
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_accounts')
    .select('id, onboarding_step, onboarding_status')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message, code: error.code }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ exists: false })
  }

  return NextResponse.json({
    exists: true,
    onboarding_step: data.onboarding_step ?? 0,
    onboarding_status: data.onboarding_status ?? 'not_started',
  })
}

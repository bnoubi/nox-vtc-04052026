import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'crypto'

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ success: false, error: 'invalid' }, { status: 400 }) }
  const { code } = body as { code?: string }

  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ success: false, error: 'Code invalide.' })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: 'Session expirée.' })

  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data: row } = await db
    .from('two_factor_codes')
    .select('id, code_hash, failed_attempts')
    .eq('user_id', user.id)
    .is('used_at', null)
    .gt('expires_at', now)
    .lt('failed_attempts', 5)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ success: false, error: 'Code expiré ou invalide. Demandez un nouveau code.' })
  }

  if (hashCode(code) !== row.code_hash) {
    await db.from('two_factor_codes').update({ failed_attempts: row.failed_attempts + 1 }).eq('id', row.id)
    const remaining = 4 - row.failed_attempts
    if (remaining <= 0) {
      return NextResponse.json({ success: false, error: 'Trop de tentatives. Demandez un nouveau code.' })
    }
    return NextResponse.json({
      success: false,
      error: `Code incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`,
    })
  }

  try {
    await Promise.race([
      db.from('two_factor_codes').update({ used_at: now }).eq('id', row.id),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ])
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur réseau, veuillez réessayer.' })
  }

  return NextResponse.json({ success: true })
}

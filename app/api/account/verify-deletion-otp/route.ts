import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const code: string | undefined = body?.code

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Code invalide' }, { status: 400 })
  }

  const codeHash = createHash('sha256').update(code).digest('hex')
  console.log('[verify-deletion-otp] vérification OTP — userId:', user.id)

  const db = createAdminClient()
  const { data: row, error: selectError } = await db
    .from('account_deletion_otp')
    .select('id, code_hash')
    .eq('user_id', user.id)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (selectError || !row) {
    console.warn('[verify-deletion-otp] aucun OTP valide — userId:', user.id)
    return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 })
  }

  if (row.code_hash !== codeHash) {
    console.warn('[verify-deletion-otp] code incorrect — userId:', user.id)
    return NextResponse.json({ error: 'Code incorrect' }, { status: 400 })
  }

  const { error: updateError } = await db
    .from('account_deletion_otp')
    .update({ used: true })
    .eq('id', row.id)

  if (updateError) {
    console.error('[verify-deletion-otp] UPDATE used error:', updateError)
    return NextResponse.json({ error: 'Erreur lors de la validation' }, { status: 500 })
  }

  console.log('[verify-deletion-otp] OTP vérifié avec succès — userId:', user.id)
  return NextResponse.json({ verified: true })
}

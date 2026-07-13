"use server"

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { twoFactorCodeEmail } from '@/emails/2fa-code'
import { createHash, randomInt } from 'crypto'

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function generateCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

async function _sendCode(userId: string, email: string): Promise<void> {
  const db = createAdminClient()
  const code = generateCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await db.from('two_factor_codes').insert({ user_id: userId, code_hash: codeHash, expires_at: expiresAt })

  const { data: account } = await db
    .from('user_accounts')
    .select('prenom, nom, full_name')
    .eq('id', userId)
    .maybeSingle()

  const a = account as { prenom?: string | null; nom?: string | null; full_name?: string | null } | null
  const prenom = a?.prenom?.trim() || a?.full_name?.split(' ')[0]?.trim() || ''

  const { subject, html } = twoFactorCodeEmail({ prenom, code })
  await sendEmail(email, subject, html)
}

export async function getTwoFactorStatusAction(): Promise<{ enabled: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { enabled: false }

  const db = createAdminClient()
  const { data } = await db
    .from('user_accounts')
    .select('two_factor_email_enabled')
    .eq('id', user.id)
    .maybeSingle()

  return { enabled: data?.two_factor_email_enabled ?? false }
}

// Always sends a code — used from Settings (activation/deactivation flows)
export async function requestTwoFactorCodeAction(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return
  await _sendCode(user.id, user.email)
}

// Checks two_factor_email_enabled first — used from login flow
export async function sendTwoFactorCodeAction(): Promise<{ twoFactorRequired: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { twoFactorRequired: false }

  const db = createAdminClient()
  const { data } = await db
    .from('user_accounts')
    .select('two_factor_email_enabled')
    .eq('id', user.id)
    .maybeSingle()

  if (!data?.two_factor_email_enabled) return { twoFactorRequired: false }

  await _sendCode(user.id, user.email)
  return { twoFactorRequired: true }
}

export async function verifyTwoFactorCodeAction(code: string): Promise<{ success: boolean; error?: string }> {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return { success: false, error: 'Code invalide.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Session expirée.' }

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
    return { success: false, error: 'Code expiré ou invalide. Demandez un nouveau code.' }
  }

  if (hashCode(code) !== row.code_hash) {
    await db
      .from('two_factor_codes')
      .update({ failed_attempts: row.failed_attempts + 1 })
      .eq('id', row.id)
    const remaining = 4 - row.failed_attempts
    if (remaining <= 0) {
      return { success: false, error: 'Trop de tentatives. Demandez un nouveau code.' }
    }
    return {
      success: false,
      error: `Code incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`,
    }
  }

  await db.from('two_factor_codes').update({ used_at: now }).eq('id', row.id)
  return { success: true }
}

export async function enableTwoFactorAction(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await createAdminClient().from('user_accounts').update({ two_factor_email_enabled: true }).eq('id', user.id)
}

export async function disableTwoFactorAction(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await createAdminClient().from('user_accounts').update({ two_factor_email_enabled: false }).eq('id', user.id)
}

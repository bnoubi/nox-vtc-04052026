"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { passwordResetCodeEmail } from '@/emails/password-reset-code'
import { createHash, randomInt } from 'crypto'

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function generateCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, '0')
}

async function findUserByEmail(email: string) {
  const db = createAdminClient()
  const { data } = await db
    .from('user_accounts')
    .select('id, prenom, full_name')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()
  return data
}

export async function sendPasswordResetCodeAction(
  email: string,
): Promise<{ success: boolean }> {
  if (!email || !email.includes('@')) return { success: true }

  const account = await findUserByEmail(email)
  if (!account) return { success: true } // Anti-énumération : ne pas révéler si l'email existe

  const db = createAdminClient()
  const code = generateCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  await db.from('two_factor_codes').insert({
    user_id: account.id,
    code_hash: codeHash,
    expires_at: expiresAt,
  })

  const a = account as { prenom?: string | null; full_name?: string | null }
  const prenom = a.prenom?.trim() || a.full_name?.split(' ')[0]?.trim() || ''

  const { subject, html } = passwordResetCodeEmail({ prenom, code })
  await sendEmail(email, subject, html)

  return { success: true }
}

export async function verifyPasswordResetCodeAction(
  email: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return { success: false, error: 'Code invalide.' }
  }

  const account = await findUserByEmail(email)
  if (!account) return { success: false, error: 'Code expiré ou invalide.' }

  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data: row } = await db
    .from('two_factor_codes')
    .select('id, code_hash, failed_attempts')
    .eq('user_id', account.id)
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

  // Code valide — ne pas marquer used_at ici, le reset final le fera
  return { success: true }
}

export async function resetPasswordAction(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return { success: false, error: 'Code invalide.' }
  }

  const account = await findUserByEmail(email)
  if (!account) return { success: false, error: 'Code expiré ou invalide.' }

  const db = createAdminClient()
  const now = new Date().toISOString()

  const { data: row } = await db
    .from('two_factor_codes')
    .select('id, code_hash, failed_attempts')
    .eq('user_id', account.id)
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
    return { success: false, error: 'Code incorrect ou expiré. Demandez un nouveau code.' }
  }

  // Marquer le code comme utilisé
  await db.from('two_factor_codes').update({ used_at: now }).eq('id', row.id)

  // Mise à jour du mot de passe via admin — aucune session utilisateur requise
  const { error: updateErr } = await db.auth.admin.updateUserById(account.id, {
    password: newPassword,
  })

  if (updateErr) {
    return { success: false, error: 'Impossible de mettre à jour le mot de passe. Veuillez réessayer.' }
  }

  return { success: true }
}

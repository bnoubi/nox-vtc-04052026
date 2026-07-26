/**
 * Envoie un email de réinitialisation de mot de passe aux comptes Google-only.
 * Exécuter UNIQUEMENT après validation manuelle de la liste.
 * Usage : node scripts/send_reset_oauth_users.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')

const supabase = createClient(
  'https://ucxevvmukrhxyurmzvnu.supabase.co',
  'sb_secret_kJ2FsLeR6E3zaqjf-IuHlg_a0AdaCyI',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Liste des comptes Google-only identifiés le 2026-07-23
const GOOGLE_ONLY_ACCOUNTS = [
  'allovtc77laferte@gmail.com',
  'bernard.noubi.youmbi@gmail.com',
  'bernardnoubi@gmail.com',
  'youmbi.fsh@gmail.com',
  'marie.bernard.noubi@gmail.com',
]

const REDIRECT_URL = 'https://noxvtc.fr/auth/reset-password'

console.log(`Mode : ${DRY_RUN ? 'DRY-RUN (aucun email envoyé)' : 'RÉEL'}`)
console.log(`Comptes à traiter : ${GOOGLE_ONLY_ACCOUNTS.length}\n`)

for (const email of GOOGLE_ONLY_ACCOUNTS) {
  if (DRY_RUN) {
    console.log(`[DRY-RUN] Skipping reset for: ${email}`)
    continue
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: REDIRECT_URL,
  })

  if (error) {
    console.error(`ERREUR pour ${email}: ${error.message}`)
  } else {
    console.log(`✓ Email envoyé : ${email}`)
  }

  // Délai de 500ms entre chaque envoi pour éviter le rate limit
  await new Promise(r => setTimeout(r, 500))
}

console.log('\nTerminé.')

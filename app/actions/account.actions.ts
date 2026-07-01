'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/client'
import { sendEmail } from '@/lib/email/resend'
import { accountDeletionScheduledEmail } from '@/emails/account-deletion-scheduled'

export async function deleteUserAccount(): Promise<{ success?: boolean; error?: string }> {
  // 1. Récupérer la session utilisateur courante
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return { error: 'Utilisateur non authentifié.' }
  }

  const userId = user.id
  const userEmail = user.email
  const db = createAdminClient()
  const encKey = process.env.ARCHIVE_ENCRYPTION_KEY!

  console.log('[deleteUserAccount] start — userId:', userId)

  // 2. Récupérer les données actuelles
  const [profileRes, accountRes] = await Promise.all([
    db
      .from('profiles')
      .select('nom_representant_legal, prenom_representant_legal, telephone, adresse, siret, nom_entreprise, email')
      .eq('user_id', userId)
      .maybeSingle(),
    db
      .from('user_accounts')
      .select('email, full_name, phone, prenom, nom')
      .eq('id', userId)
      .maybeSingle(),
  ])

  if (profileRes.error) {
    console.error('[deleteUserAccount] step 2 — profiles fetch error:', profileRes.error)
    return { error: 'Erreur lors de la récupération du profil.' }
  }
  if (accountRes.error) {
    console.error('[deleteUserAccount] step 2 — user_accounts fetch error:', accountRes.error)
    return { error: 'Erreur lors de la récupération du compte.' }
  }

  const profile = profileRes.data
  const account = accountRes.data
  console.log('[deleteUserAccount] step 2 OK — data fetched')

  // 3. Chiffrer chaque champ personnel via RPC archive_encrypt
  async function encrypt(value: string | null | undefined): Promise<unknown> {
    if (!value) return null
    const { data, error } = await db.rpc('archive_encrypt', { p_plain: value, p_key: encKey })
    if (error) throw new Error(`archive_encrypt failed: ${error.message}`)
    return data
  }

  let emailEncrypted: unknown
  let prenomEncrypted: unknown
  let nomEncrypted: unknown
  let telephoneEncrypted: unknown
  let adresseEncrypted: unknown
  let sirenEncrypted: unknown
  let raisonSocialeEncrypted: unknown

  try {
    emailEncrypted        = await encrypt(account?.email ?? userEmail)
    prenomEncrypted       = await encrypt(account?.prenom ?? profile?.prenom_representant_legal)
    nomEncrypted          = await encrypt(account?.nom ?? profile?.nom_representant_legal)
    telephoneEncrypted    = await encrypt(account?.phone ?? profile?.telephone)
    adresseEncrypted      = await encrypt(profile?.adresse)
    sirenEncrypted        = await encrypt(profile?.siret)
    raisonSocialeEncrypted = await encrypt(profile?.nom_entreprise)
    console.log('[deleteUserAccount] step 3 OK — fields encrypted')
  } catch (err: unknown) {
    console.error('[deleteUserAccount] step 3 — encrypt error:', err)
    return { error: 'Erreur lors du chiffrement des données.' }
  }

  // 4. INSERT dans deleted_accounts_archive
  const legalRetentionUntil = new Date(Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000).toISOString()

  const { error: archiveError } = await db
    .from('deleted_accounts_archive')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      original_user_id:         userId,
      email_encrypted:          emailEncrypted,
      prenom_encrypted:         prenomEncrypted,
      nom_encrypted:            nomEncrypted,
      telephone_encrypted:      telephoneEncrypted,
      adresse_encrypted:        adresseEncrypted,
      siren_encrypted:          sirenEncrypted,
      raison_sociale_encrypted: raisonSocialeEncrypted,
      deletion_reason:          'user_request',
      legal_retention_until:    legalRetentionUntil,
    } as Record<string, unknown>)

  if (archiveError) {
    console.error('[deleteUserAccount] step 4 — archive insert error:', archiveError)
    return { error: "Erreur lors de l'archivage des données." }
  }
  console.log('[deleteUserAccount] step 4 OK — archive created')

  // 5. Annuler l'abonnement Stripe actif immédiatement
  const { data: sub } = await db
    .from('subscriptions')
    .select('stripe_subscription_id, status, payment_provider')
    .eq('user_id', userId)
    .in('status', ['active', 'trial'])
    .not('stripe_subscription_id', 'is', null)
    .maybeSingle()

  if (sub?.payment_provider === 'stripe' && sub.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: false })
      await stripe.subscriptions.cancel(sub.stripe_subscription_id)
      console.log('[deleteUserAccount] step 5 OK — Stripe subscription cancelled:', sub.stripe_subscription_id)
    } catch (err: unknown) {
      // Non-bloquant : on continue même si l'annulation Stripe échoue
      console.error('[deleteUserAccount] step 5 — Stripe cancel error:', err)
    }
  } else {
    console.log('[deleteUserAccount] step 5 — no active Stripe subscription to cancel')
  }

  const now = new Date().toISOString()
  const deletionScheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // 6. UPDATE user_accounts
  const { error: accountUpdateError } = await db
    .from('user_accounts')
    .update({
      deletion_requested_at:  now,
      deletion_scheduled_for: deletionScheduledFor,
      account_status:         'pending_deletion',
    })
    .eq('id', userId)

  if (accountUpdateError) {
    console.error('[deleteUserAccount] step 6 — user_accounts update error:', accountUpdateError)
    return { error: 'Erreur lors de la mise à jour du compte.' }
  }
  console.log('[deleteUserAccount] step 6 OK — user_accounts updated')

  // 7. UPDATE profiles
  const { error: profileUpdateError } = await db
    .from('profiles')
    .update({
      deletion_requested_at:  now,
      deletion_scheduled_for: deletionScheduledFor,
      status:                 'pending_deletion',
    })
    .eq('user_id', userId)

  if (profileUpdateError) {
    console.error('[deleteUserAccount] step 7 — profiles update error:', profileUpdateError)
    return { error: 'Erreur lors de la mise à jour du profil.' }
  }
  console.log('[deleteUserAccount] step 7 OK — profiles updated')

  // 8. Email de confirmation (avant signOut, données encore intactes)
  const userName = account?.prenom
    ? `${account.prenom}${account.nom ? ` ${account.nom}` : ''}`.trim()
    : profile?.prenom_representant_legal
      ? `${profile.prenom_representant_legal}${profile.nom_representant_legal ? ` ${profile.nom_representant_legal}` : ''}`.trim()
      : account?.full_name ?? 'Client'

  const { subject, html } = accountDeletionScheduledEmail({ userName, deletionDate: deletionScheduledFor })
  const emailResult = await sendEmail(userEmail, subject, html)
  if (!emailResult.success) {
    console.error('[deleteUserAccount] step 8 — email send error:', emailResult.error)
  } else {
    console.log('[deleteUserAccount] step 8 OK — confirmation email sent to:', userEmail)
  }

  // 9. Log final
  console.log('[deleteUserAccount] completed — userId:', userId, '| scheduledFor:', deletionScheduledFor)

  return { success: true }
}

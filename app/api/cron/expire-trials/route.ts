import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { subscriptionExpiredEmail } from '@/emails/subscription-expired'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const cronSecret = request.headers.get('x-cron-secret')
  if (!expected || cronSecret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Récupérer les trials expirés avant downgrade
  const { data: expiredTrials } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('status', 'trial')
    .lt('trial_ends_at', new Date().toISOString())

  // Exécuter le downgrade + attribution jetons via la fonction SQL
  await supabase.rpc('expire_trials')

  // Envoyer emails de relance
  if (expiredTrials && expiredTrials.length > 0) {
    for (const trial of expiredTrials) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(
          trial.user_id
        )
        if (!userData?.user?.email) continue

        const { data: profile } = await supabase
          .from('profiles')
          .select('prenom')
          .eq('user_id', trial.user_id)
          .single()

        const prenom = profile?.prenom || 'Chauffeur'

        await resend.emails.send({
          from: 'noreply@noxvtc.fr',
          to: userData.user.email,
          subject: 'Votre période d\'essai NoX VTC est terminée',
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
              <p>Bonjour ${prenom},</p>
              <p>Votre période d'essai Premium de 14 jours est terminée.</p>
              <p>Votre compte est maintenant en offre <strong>Starter</strong> avec <strong>5 jetons offerts</strong> pour continuer à utiliser NoX VTC.</p>
              <p>Pour profiter de toutes les fonctionnalités Pro et Premium :</p>
              <a href="https://app.noxvtc.fr/settings"
                style="display:inline-block;background:#D4AF37;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
                Choisir mon offre
              </a>
              <p style="color:#888;font-size:12px;">L'équipe NoX VTC</p>
            </div>
          `
        })
      } catch (e) {
        console.error('Email relance trial failed:', e)
      }
    }
  }

  // Expiration abonnements PayPal (cancel_at dépassé, pas de webhook)
  let expiredPaypalCount = 0
  try {
    const adminDb = createAdminClient()
    const now = new Date().toISOString()

    const { data: expiredPaypalSubs } = await adminDb
      .from('subscriptions')
      .select('id, user_id, plan')
      .eq('payment_provider', 'paypal')
      .not('cancel_at', 'is', null)
      .lt('cancel_at', now)
      .neq('status', 'expired')

    if (expiredPaypalSubs && expiredPaypalSubs.length > 0) {
      for (const sub of expiredPaypalSubs as { id: string; user_id: string; plan: string }[]) {
        try {
          // Basculer l'abonnement et le compte en solo
          await adminDb
            .from('subscriptions')
            .update({ status: 'expired', plan: 'SOLO', target_plan: 'SOLO', updated_at: now })
            .eq('id', sub.id)

          await adminDb
            .from('user_accounts')
            .update({ plan: 'SOLO', updated_at: now })
            .eq('id', sub.user_id)

          // Récupérer email + nom
          const { data: account } = await adminDb
            .from('user_accounts')
            .select('email, full_name')
            .eq('id', sub.user_id)
            .maybeSingle()

          const acc = account as { email: string; full_name: string } | null
          if (acc?.email) {
            const planName = sub.plan === 'TEAM' || sub.plan === 'team'
              ? 'Premium'
              : 'Pro'
            const { subject, html } = subscriptionExpiredEmail({
              userName: acc.full_name ?? 'Client',
              planName,
              expiredAt: now,
            })
            const result = await sendEmail(acc.email, subject, html)
            if (!result.success) {
              console.error('[expire-paypal] email erreur userId:', sub.user_id, result.error)
            } else {
              console.log('[expire-paypal] email expiration envoyé:', sub.user_id)
            }
          }

          expiredPaypalCount++
        } catch (subErr) {
          console.error('[expire-paypal] erreur traitement userId:', sub.user_id, subErr)
        }
      }
    }
  } catch (paypalErr) {
    console.error('[expire-paypal] erreur globale:', paypalErr)
  }

  return NextResponse.json({
    expired: expiredTrials?.length ?? 0,
    expiredPaypal: expiredPaypalCount,
    message: 'Trials expired successfully'
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

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

  return NextResponse.json({
    expired: expiredTrials?.length ?? 0,
    message: 'Trials expired successfully'
  })
}

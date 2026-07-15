import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/resend'

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const D = 86_400_000

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TEMPLATES: Record<string, { subject: string; body: string }> = {
  inactifs15: {
    subject: 'NoX VTC vous attend !',
    body: 'Bonjour {prenom}, cela fait 2 semaines que nous ne vous avons pas vu. Votre espace NoX VTC est prêt et vos documents vous attendent. Reconnectez-vous dès maintenant !',
  },
  inactifs30: {
    subject: 'Votre activité VTC nous manque',
    body: "Bonjour {prenom}, un mois sans activité sur NoX VTC. N'oubliez pas que vos jetons n'expirent jamais et restent disponibles. Reprenez votre activité dès aujourd'hui !",
  },
  inactifs45: {
    subject: 'Offre spéciale - 30% de réduction',
    body: 'Bonjour {prenom}, nous souhaitons vous retrouver sur NoX VTC. Profitez de 30% de réduction sur vos prochains achats avec le code : RETOUR30 (placeholder). Offre valable 7 jours.',
  },
  jetonsEpuises: {
    subject: 'Rechargez vos jetons NoX VTC',
    body: 'Bonjour {prenom}, votre solde de jetons est épuisé. Rechargez dès maintenant pour continuer à générer vos bons de commande et factures en toute simplicité.',
  },
  jetonsFaibles: {
    subject: 'Votre solde de jetons est faible',
    body: 'Bonjour {prenom}, il vous reste seulement {solde} jetons. Pensez à recharger pour ne pas être bloqué dans votre activité.',
  },
  aboExpires: {
    subject: 'Réactivez votre abonnement NoX VTC',
    body: "Bonjour {prenom}, votre abonnement a expiré. Réactivez-le dès maintenant pour profiter de toutes les fonctionnalités NoX VTC sans limitation.",
  },
}

async function wasRecentlySent(supabase: ReturnType<typeof adminClient>, segment: string): Promise<boolean> {
  const since = new Date(Date.now() - 7 * D).toISOString()
  const { data } = await supabase
    .from('communication_logs')
    .select('id')
    .eq('segment', segment)
    .eq('mode', 'auto')
    .gte('sent_at', since)
    .limit(1)
    .maybeSingle()
  return !!data
}

async function sendSegment(
  supabase: ReturnType<typeof adminClient>,
  segment: string,
  recipients: { email: string; prenom: string; solde?: number }[]
): Promise<number> {
  const tpl = TEMPLATES[segment]
  if (!tpl || !recipients.length) return 0

  let sent = 0
  for (const r of recipients) {
    if (!r.email) continue
    const body = tpl.body
      .replace(/\{prenom\}/g, r.prenom || 'Abonné')
      .replace(/\{solde\}/g, String(r.solde ?? 0))
    const html = `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">${body.replace(/\n/g, '<br/>')}</div>`
    const res = await sendEmail(r.email, tpl.subject, html)
    if (res.success) sent++
  }

  if (sent > 0) {
    await supabase.from('communication_logs').insert({
      segment,
      subject: tpl.subject,
      recipients_count: sent,
      mode: 'auto',
      status: 'sent',
    })
  }

  return sent
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()
  const now = Date.now()
  const results: Record<string, number> = {}

  try {
    // ── Inactifs ──────────────────────────────────────────
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const allUsers: User[] = authData?.users ?? []

    const inactifSegments = [
      { key: 'inactifs15', min: 15, max: 30 },
      { key: 'inactifs30', min: 30, max: 45 },
      { key: 'inactifs45', min: 45, max: null },
    ]

    for (const seg of inactifSegments) {
      if (await wasRecentlySent(supabase, seg.key)) { results[seg.key] = 0; continue }

      const filtered = allUsers.filter(u => {
        if (!u.last_sign_in_at) return false
        const ms = now - new Date(u.last_sign_in_at).getTime()
        return ms >= seg.min * D && (seg.max === null || ms < seg.max * D)
      })

      const ids = filtered.map(u => u.id)
      const accounts = ids.length
        ? (await supabase.from('user_accounts').select('id, email, prenom, full_name, marketing_email_consent').in('id', ids)).data ?? []
        : []

      const recipients = filtered.map(u => {
        const acc = accounts.find((a: { id: string }) => a.id === u.id) as { id: string; email: string | null; prenom: string | null; full_name: string | null; marketing_email_consent: boolean } | undefined
        if (!acc?.marketing_email_consent) return null
        return {
          email: u.email ?? acc?.email ?? '',
          prenom: acc?.prenom ?? acc?.full_name?.split(' ')[0] ?? 'Abonné',
        }
      }).filter((r): r is { email: string; prenom: string } => !!r && !!r.email)

      results[seg.key] = await sendSegment(supabase, seg.key, recipients)
    }

    // ── Jetons épuisés ────────────────────────────────────
    if (!(await wasRecentlySent(supabase, 'jetonsEpuises'))) {
      const { data: wallets } = await supabase.from('wallets').select('user_id, balance').eq('balance', 0)
      const ids = (wallets ?? []).map((w: { user_id: string }) => w.user_id)
      const accounts = ids.length ? (await supabase.from('user_accounts').select('id, email, prenom, full_name').in('id', ids)).data ?? [] : []
      const recipients = (wallets ?? []).map((w: { user_id: string; balance: number }) => {
        const acc = accounts.find((a: { id: string }) => a.id === w.user_id) as { id: string; email: string | null; prenom: string | null; full_name: string | null } | undefined
        return { email: acc?.email ?? '', prenom: acc?.prenom ?? acc?.full_name?.split(' ')[0] ?? 'Abonné', solde: w.balance }
      }).filter(r => r.email)
      results.jetonsEpuises = await sendSegment(supabase, 'jetonsEpuises', recipients)
    } else results.jetonsEpuises = 0

    // ── Jetons faibles ────────────────────────────────────
    if (!(await wasRecentlySent(supabase, 'jetonsFaibles'))) {
      const { data: wallets } = await supabase.from('wallets').select('user_id, balance').gt('balance', 0).lt('balance', 3)
      const ids = (wallets ?? []).map((w: { user_id: string }) => w.user_id)
      const accounts = ids.length ? (await supabase.from('user_accounts').select('id, email, prenom, full_name').in('id', ids)).data ?? [] : []
      const recipients = (wallets ?? []).map((w: { user_id: string; balance: number }) => {
        const acc = accounts.find((a: { id: string }) => a.id === w.user_id) as { id: string; email: string | null; prenom: string | null; full_name: string | null } | undefined
        return { email: acc?.email ?? '', prenom: acc?.prenom ?? acc?.full_name?.split(' ')[0] ?? 'Abonné', solde: w.balance }
      }).filter(r => r.email)
      results.jetonsFaibles = await sendSegment(supabase, 'jetonsFaibles', recipients)
    } else results.jetonsFaibles = 0

    // ── Abonnements expirés ───────────────────────────────
    if (!(await wasRecentlySent(supabase, 'aboExpires'))) {
      const { data: subs } = await supabase.from('subscriptions').select('user_id').eq('status', 'expired')
      const ids = [...new Set((subs ?? []).map((s: { user_id: string }) => s.user_id))]
      const accounts = ids.length ? (await supabase.from('user_accounts').select('id, email, prenom, full_name').in('id', ids)).data ?? [] : []
      const recipients = ids.map(uid => {
        const acc = accounts.find((a: { id: string }) => a.id === uid) as { id: string; email: string | null; prenom: string | null; full_name: string | null } | undefined
        return { email: acc?.email ?? '', prenom: acc?.prenom ?? acc?.full_name?.split(' ')[0] ?? 'Abonné' }
      }).filter(r => r.email)
      results.aboExpires = await sendSegment(supabase, 'aboExpires', recipients)
    } else results.aboExpires = 0

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('[cron/reminders]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

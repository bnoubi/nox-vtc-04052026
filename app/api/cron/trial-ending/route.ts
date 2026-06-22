import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { sendEmail } from "@/lib/email/resend"
import { trialEndingEmail } from "@/emails/trial-ending"

// Cron quotidien : sélectionne les abonnés dont l'essai se termine dans
// exactement 2 jours et leur envoie l'email de rappel.
//
// À déclencher une fois par jour (heure idéale : 09:00 Europe/Paris pour
// que les emails arrivent en début de journée).
//
// Exemple crontab (sur le VPS) :
//   0 9 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
//     https://app.noxvtc.fr/api/cron/trial-ending >> /var/log/nox-cron.log 2>&1
//
// Exemple Vercel Cron (vercel.json) :
//   { "crons": [{ "path": "/api/cron/trial-ending", "schedule": "0 9 * * *" }] }

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminDb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )

  // Fenêtre [J+2 00:00, J+3 00:00) en UTC
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const start = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)
  const end = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)

  const { data: subs, error: subsErr } = await adminDb
    .from("subscriptions")
    .select("user_id, trial_ends_at")
    .eq("status", "trial")
    .gte("trial_ends_at", start.toISOString())
    .lt("trial_ends_at", end.toISOString())

  if (subsErr) {
    console.error("[cron/trial-ending] subscriptions err:", subsErr.message)
    return NextResponse.json({ error: subsErr.message }, { status: 500 })
  }

  const targets = subs ?? []
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const sub of targets) {
    const { data: account } = await adminDb
      .from("user_accounts")
      .select("email, prenom, nom")
      .eq("id", sub.user_id)
      .maybeSingle()

    if (!account?.email) {
      failed++
      errors.push(`${sub.user_id}: no email`)
      continue
    }

    const prenom = (account.prenom || "").trim()
    const nom = (account.nom || "").trim()
    const { subject, html } = trialEndingEmail({ prenom, nom })
    const result = await sendEmail(account.email, subject, html)
    if (result.success) {
      sent++
    } else {
      failed++
      errors.push(`${account.email}: ${result.error}`)
    }
  }

  return NextResponse.json({
    window: { start: start.toISOString(), end: end.toISOString() },
    candidates: targets.length,
    sent,
    failed,
    ...(errors.length ? { errors } : {}),
  })
}

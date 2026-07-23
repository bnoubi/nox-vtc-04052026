import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import { welcomeEmail } from "@/emails/welcome"
import { trialStartEmail } from "@/emails/trial-start"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: account } = await supabase
    .from("user_accounts")
    .select("prenom, nom, welcome_emails_sent_at")
    .eq("id", user.id)
    .maybeSingle()

  if (account?.welcome_emails_sent_at) {
    return NextResponse.json({ skipped: true, reason: "already_sent", at: account.welcome_emails_sent_at })
  }

  const meta = user.user_metadata ?? {}
  const prenom = (account?.prenom || meta.prenom || meta.given_name || "").trim()
  const nom = (account?.nom || meta.nom || meta.family_name || "").trim()

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("trial_ends_at, status")
    .eq("user_id", user.id)
    .maybeSingle()

  const isTrial = subscription?.status === "trial"

  const welcome = welcomeEmail({ prenom, nom })

  const welcomeResult = await sendEmail(user.email, welcome.subject, welcome.html)
  if (!welcomeResult.success) {
    console.error("[onboarding/welcome] email 1 erreur:", welcomeResult.error)
    return NextResponse.json({ error: "Email 1 failed", details: welcomeResult.error }, { status: 500 })
  }

  // Pose le flag d'idempotence dès qu'Email 1 part avec succès — on évite
  // qu'un second appel reparte Email 1 même si Email 2 plante juste après.
  await supabase
    .from("user_accounts")
    .update({ welcome_emails_sent_at: new Date().toISOString() })
    .eq("id", user.id)

  if (!isTrial) {
    return NextResponse.json({ sent: 1, scheduled: 0, reason: "no_trial" })
  }

  const trialEndsAt = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at)
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  const trial = trialStartEmail({ prenom, nom, trialEndsAt })
  const scheduledAt = new Date(Date.now() + 3 * 60 * 1000).toISOString()
  const trialResult = await sendEmail(user.email, trial.subject, trial.html, { scheduledAt })
  if (!trialResult.success) {
    console.error("[onboarding/welcome] email 2 erreur:", trialResult.error)
    return NextResponse.json({ sent: 1, scheduled: 0, details: trialResult.error }, { status: 207 })
  }

  return NextResponse.json({ sent: 1, scheduled: 1, scheduledAt })
}

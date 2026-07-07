import { NextRequest, NextResponse } from "next/server"
import { verifyAdminPermission, createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  const auth = await verifyAdminPermission("users.read")
  if (!auth.authorized) return NextResponse.json({ error: "Non autorisé" }, { status: auth.status })

  const adminDb = createAdminClient()

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase()
  const userId = request.nextUrl.searchParams.get("user_id")?.trim()

  if (!email && !userId) {
    return NextResponse.json(
      { error: "Paramètre 'email' ou 'user_id' requis" },
      { status: 400 },
    )
  }

  const query = adminDb
    .from("user_accounts")
    .select("id, email, prenom, nom, onboarding_status, onboarding_step, welcome_emails_sent_at")

  const { data: account, error } = userId
    ? await query.eq("id", userId).maybeSingle()
    : await query.eq("email", email!).maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!account) {
    return NextResponse.json({ found: false }, { status: 404 })
  }

  return NextResponse.json({
    found: true,
    user_id: account.id,
    email: account.email,
    prenom: account.prenom,
    nom: account.nom,
    onboarding_status: account.onboarding_status,
    onboarding_step: account.onboarding_step,
    welcome_emails_sent_at: account.welcome_emails_sent_at,
    sent: account.welcome_emails_sent_at !== null,
  })
}

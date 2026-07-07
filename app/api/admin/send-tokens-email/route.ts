import { NextRequest, NextResponse } from "next/server"
import { verifyAdminPermission, createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/resend"
import { tokensCreditedEmail } from "@/emails/tokens-credited"

export async function POST(request: NextRequest) {
  const auth = await verifyAdminPermission("tokens.write")
  if (!auth.authorized) return NextResponse.json({ error: "Non autorisé" }, { status: auth.status })

  const adminDb = createAdminClient()

  let body: { user_id?: string; nombre_jetons?: number } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 })
  }

  const userId = body.user_id?.trim()
  const nombre = Number(body.nombre_jetons)
  if (!userId || !Number.isFinite(nombre) || nombre <= 0) {
    return NextResponse.json(
      { error: "user_id et nombre_jetons (> 0) requis" },
      { status: 400 },
    )
  }

  const { data: account } = await adminDb
    .from("user_accounts")
    .select("email, prenom, nom")
    .eq("id", userId)
    .maybeSingle()

  if (!account?.email) {
    return NextResponse.json({ error: "Utilisateur introuvable ou sans email" }, { status: 404 })
  }

  const prenom = (account.prenom || "").trim()
  const nom = (account.nom || "").trim()
  const { subject, html } = tokensCreditedEmail({ prenom, nom, nombre_jetons: nombre })
  const result = await sendEmail(account.email, subject, html)
  if (!result.success) {
    console.error("[admin/send-tokens-email] erreur Resend:", result.error)
    return NextResponse.json({ error: "Envoi échoué", details: result.error }, { status: 500 })
  }

  return NextResponse.json({ sent: true, to: account.email, nombre_jetons: nombre })
}

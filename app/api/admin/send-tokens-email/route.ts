import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServerClient } from "@supabase/ssr"
import { sendEmail } from "@/lib/email/resend"
import { tokensCreditedEmail } from "@/emails/tokens-credited"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })

  const adminDb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )

  const { data: adminRoles } = await adminDb
    .from("admin_roles")
    .select("id")
    .in("code", ["admin", "super_admin"])
  if (!adminRoles?.length) return NextResponse.json({ error: "Non autorisé" }, { status: 403 })

  const adminRoleIds = (adminRoles as { id: string }[]).map((r) => r.id)
  const { data: role } = await adminDb
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .in("admin_role_id", adminRoleIds)
    .limit(1)
    .maybeSingle()
  if (!role) return NextResponse.json({ error: "Non autorisé" }, { status: 403 })

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

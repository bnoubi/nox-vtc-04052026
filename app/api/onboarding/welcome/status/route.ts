import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServerClient } from "@supabase/ssr"

export async function GET(request: NextRequest) {
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

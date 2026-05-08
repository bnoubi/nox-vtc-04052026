import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Vérifier la session — user_id vient du token, pas du body
    const serverClient = await createServerClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    const { data: inserted, error: rpcError } = await adminSupabase
      .from("clients")
      .insert([{
        user_id:        user.id,
        type:           body.type           || "particulier",
        civilite:       body.civilite       || null,
        nom:            body.nom            || null,
        prenom:         body.prenom         || null,
        raison_sociale: body.raisonSociale  || null,
        siren:          body.siren          || null,
        tva_intra:      body.tvaIntra       || null,
        email:          body.email          || null,
        telephone:      body.phone          || null,
        adresse:        body.billingAddress?.rue        || null,
        code_postal:    body.billingAddress?.codePostal || null,
        ville:          body.billingAddress?.ville      || null,
        contacts:       body.contacts       || [],
        notes:          body.notes          || null,
        tag:            body.tag            || null,
        preferences:    body.preferences    || null,
      }])
      .select()
      .single()

    if (rpcError) {
      console.error("[/api/clients/create] RPC FAILED:", rpcError)
      return NextResponse.json(
        { error: rpcError.message, code: rpcError.code, hint: rpcError.hint },
        { status: 500 }
      )
    }

    return NextResponse.json({ client: inserted }, { status: 201 })
  } catch (e) {
    console.error("[/api/clients/create] Exception:", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

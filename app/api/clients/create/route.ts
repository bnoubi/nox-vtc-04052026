import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"
import { CreateClientSchema } from "./schema"

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Auth
    const serverClient = await createServerClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validation Zod
    const body = await req.json()
    const parsed = CreateClientSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Insert avec données validées et nettoyées
    const { data: inserted, error: rpcError } = await adminSupabase
      .from("clients")
      .insert([{
        user_id:        user.id,
        type:           data.type,
        civilite:       data.civilite       ?? null,
        nom:            data.nom            ?? null,
        prenom:         data.prenom         ?? null,
        raison_sociale: data.raisonSociale  ?? null,
        siren:          data.siren          || null,
        tva_intra:      data.tvaIntra       || null,
        email:          data.email          || null,
        telephone:      data.phone          ?? null,
        adresse:        data.billingAddress?.rue        ?? null,
        code_postal:    data.billingAddress?.codePostal ?? null,
        ville:          data.billingAddress?.ville      ?? null,
        contacts:       data.contacts       ?? [],
        notes:          data.notes          ?? null,
        tag:            data.tag            ?? null,
        preferences:    data.preferences    ?? null,
      }])
      .select()
      .single()

    if (rpcError) {
      console.error("[/api/clients/create] RPC FAILED:", rpcError)
      return NextResponse.json(
        { error: "Erreur serveur" },
        { status: 500 }
      )
    }

    return NextResponse.json({ client: inserted }, { status: 201 })

  } catch (e) {
    console.error("[/api/clients/create] Exception:", e)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const serverClient = await createServerClient()
    const { data: { user }, error: authError } = await serverClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 })
    }

    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
    const MAX_SIZE = 2 * 1024 * 1024 // 2 Mo

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: "Type de fichier non autorisé (jpeg, png, webp, svg uniquement)" }, { status: 415 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 2 Mo)" }, { status: 413 })
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png"
    const path = `${user.id}/logo.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await adminSupabase.storage
      .from("logos")
      .upload(path, buffer, { upsert: true, contentType: file.type })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = adminSupabase.storage.from("logos").getPublicUrl(path)

    return NextResponse.json({ url: publicUrl })
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

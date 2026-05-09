import { NextResponse } from "next/server"
import { createClient as createServerSupabase } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Session active ?
  try {
    const serverClient = await createServerSupabase()
    const { data: { user } } = await serverClient.auth.getUser()

    results.session = {
      authenticated: !!user,
      user_id: user?.id ?? null,
      email: user?.email ?? null,
    }

    if (user) {
      // 2. Test INSERT authentifié (même RLS que le browser)
      const { data: inserted, error: insertErr } = await serverClient
        .from("clients")
        .insert([{
          user_id: user.id,
          type: "particulier",
          nom: "__DIAG_TEST__",
          prenom: "__DIAG__",
          telephone: "0000000000"
        }])
        .select("id")
        .single()

      results.authenticated_insert = {
        ok: !insertErr,
        inserted_id: inserted?.id ?? null,
        error: insertErr ? {
          message: insertErr.message,
          code: insertErr.code,
          hint: insertErr.hint,
          details: insertErr.details
        } : null
      }

      if (inserted?.id) {
        await adminSupabase.from("clients").delete().eq("id", inserted.id)
        results.cleanup = "ok"
      }
    } else {
      results.instruction = "Accédez à cette URL DEPUIS LE BROWSER en étant connecté à l'app pour tester l'insert authentifié"
    }
  } catch (e: unknown) {
    results.exception = e instanceof Error ? e.message : String(e)
  }

  // 3. Test service role (toujours)
  try {
    const { data: authUsers } = await adminSupabase.auth.admin.listUsers({ perPage: 1 })
    const realUserId = authUsers?.users?.[0]?.id

    if (realUserId) {
      const { data: inserted, error: insertErr } = await adminSupabase
        .from("clients")
        .insert([{ user_id: realUserId, type: "particulier", nom: "__SVC_TEST__", prenom: "__SVC__", telephone: "0000000000" }])
        .select("id")
        .single()

      results.service_role_insert = {
        ok: !insertErr,
        error: insertErr ? { message: insertErr.message, code: insertErr.code } : null
      }

      if (inserted?.id) {
        await adminSupabase.from("clients").delete().eq("id", inserted.id)
      }
    }
  } catch (e: unknown) {
    results.service_exception = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(results, { status: 200 })
}

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    userId?: string
    passengerName?: string
    departure?: string
    arrival?: string
    date?: string
    time?: string
    estimatedDistance?: number | null
    estimatedDuration?: string | null
  }

  const {
    userId,
    passengerName = "",
    departure = "",
    arrival = "",
    date,
    time,
    estimatedDistance,
    estimatedDuration,
  } = body

  if (!userId) return NextResponse.json({ ok: false }, { status: 400 })

  const { data: { user } } = await adminSupabase.auth.admin.getUserById(userId)
  if (!user?.email) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 })

  const dateFormatted = date
    ? new Date(date).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : ""

  const html = `
<p>Bonjour,</p>
<p><strong>${passengerName}</strong> vient de compléter sa demande de trajet.</p>
<ul>
  <li>📍 <strong>Départ :</strong> ${departure}</li>
  <li>🏁 <strong>Arrivée :</strong> ${arrival}</li>
  ${dateFormatted ? `<li>📅 <strong>Date :</strong> ${dateFormatted}${time ? ` à ${time.replace(":", "h")}` : ""}</li>` : ""}
  ${estimatedDistance != null ? `<li>🛣 <strong>Distance estimée :</strong> ${estimatedDistance} km</li>` : ""}
  ${estimatedDuration ? `<li>⏱ <strong>Durée estimée :</strong> ${estimatedDuration}</li>` : ""}
</ul>
<p>Connectez-vous pour convertir cette demande en bon de réservation :<br/>
<a href="https://app.noxvtc.fr">https://app.noxvtc.fr</a></p>
<p>L'équipe NoX VTC</p>
`

  void adminSupabase.from("notifications").insert({
    user_id: userId,
    type: "trip_request",
    title: "📋 Nouvelle demande de trajet",
    message: `${passengerName} — ${departure}${arrival ? ` → ${arrival}` : ""}`,
    data: {},
    read: false,
  })

  const emailResult = await sendEmail(user.email, "🔔 Nouvelle demande de trajet reçue", html)
  return NextResponse.json({ ok: emailResult.success })
}

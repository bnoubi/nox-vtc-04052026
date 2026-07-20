import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    email?: string; firstname?: string; departure?: string; arrival?: string
    date?: string; time?: string; lang?: string
    operatorUserId?: string; operatorName?: string
  }
  const {
    email, firstname = "", departure = "", arrival = "",
    date, time, lang = "fr",
    operatorUserId, operatorName = "Votre chauffeur",
  } = body

  if (!email) return NextResponse.json({ ok: false }, { status: 400 })

  // Fetch operator email for Reply-To
  let operatorEmail: string | undefined
  if (operatorUserId) {
    const { data: { user } } = await adminSupabase.auth.admin.getUserById(operatorUserId)
    operatorEmail = user?.email ?? undefined
  }

  const dateFormatted = date
    ? new Date(date).toLocaleDateString(
        lang === "en" ? "en-GB" : lang === "es" ? "es-ES" : lang === "it" ? "it-IT" : "fr-FR",
        { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      )
    : ""

  const subjects: Record<string, string> = {
    fr: `Confirmation de votre demande de trajet – ${operatorName}`,
    en: `Your trip request confirmation – ${operatorName}`,
    es: `Confirmación de su solicitud de viaje – ${operatorName}`,
    it: `Conferma della sua richiesta di trasferimento – ${operatorName}`,
  }

  const bodies: Record<string, string> = {
    fr: `<p>Bonjour ${firstname},</p>
<p>${operatorName} a bien reçu votre demande de trajet et vous recontactera prochainement pour confirmation.</p>
<ul>
  <li><strong>Départ :</strong> ${departure}</li>
  <li><strong>Arrivée :</strong> ${arrival}</li>
  ${dateFormatted ? `<li><strong>Date :</strong> ${dateFormatted}</li>` : ""}
  ${time ? `<li><strong>Heure :</strong> ${time.replace(":", "h")}</li>` : ""}
</ul>
<p>Merci de votre confiance,<br/>${operatorName}</p>`,

    en: `<p>Hello ${firstname},</p>
<p>${operatorName} has received your trip request and will contact you shortly to confirm.</p>
<ul>
  <li><strong>Departure:</strong> ${departure}</li>
  <li><strong>Arrival:</strong> ${arrival}</li>
  ${dateFormatted ? `<li><strong>Date:</strong> ${dateFormatted}</li>` : ""}
  ${time ? `<li><strong>Time:</strong> ${time}</li>` : ""}
</ul>
<p>Thank you,<br/>${operatorName}</p>`,

    es: `<p>Hola ${firstname},</p>
<p>${operatorName} ha recibido su solicitud de viaje y se pondrá en contacto con usted en breve para confirmar.</p>
<ul>
  <li><strong>Salida:</strong> ${departure}</li>
  <li><strong>Llegada:</strong> ${arrival}</li>
  ${dateFormatted ? `<li><strong>Fecha:</strong> ${dateFormatted}</li>` : ""}
  ${time ? `<li><strong>Hora:</strong> ${time}</li>` : ""}
</ul>
<p>Gracias,<br/>${operatorName}</p>`,

    it: `<p>Salve ${firstname},</p>
<p>${operatorName} ha ricevuto la sua richiesta di trasferimento e la contatterà a breve per la conferma.</p>
<ul>
  <li><strong>Partenza:</strong> ${departure}</li>
  <li><strong>Arrivo:</strong> ${arrival}</li>
  ${dateFormatted ? `<li><strong>Data:</strong> ${dateFormatted}</li>` : ""}
  ${time ? `<li><strong>Ora:</strong> ${time}</li>` : ""}
</ul>
<p>Grazie,<br/>${operatorName}</p>`,
  }

  const subject = subjects[lang] ?? subjects.fr
  const html = bodies[lang] ?? bodies.fr

  const result = await sendEmail(email, subject, html, {
    fromName: operatorName,
    replyTo: operatorEmail,
  })
  return NextResponse.json({ ok: result.success })
}

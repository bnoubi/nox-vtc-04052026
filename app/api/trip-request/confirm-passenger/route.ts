import { type NextRequest, NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/resend"

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    email?: string; firstname?: string; departure?: string; arrival?: string
    date?: string; time?: string; lang?: string
  }
  const { email, firstname = "", departure = "", arrival = "", date, time, lang = "fr" } = body

  if (!email) return NextResponse.json({ ok: false }, { status: 400 })

  const dateFormatted = date
    ? new Date(date).toLocaleDateString(
        lang === "en" ? "en-GB" : lang === "es" ? "es-ES" : "fr-FR",
        { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      )
    : ""

  const subjects: Record<string, string> = {
    fr: "Confirmation de votre demande de trajet – NoX VTC",
    en: "Your trip request confirmation – NoX VTC",
    es: "Confirmación de su solicitud de viaje – NoX VTC",
  }

  const bodies: Record<string, string> = {
    fr: `<p>Bonjour ${firstname},</p>
<p>Votre demande de trajet a bien été enregistrée.</p>
<ul>
  <li><strong>Départ :</strong> ${departure}</li>
  <li><strong>Arrivée :</strong> ${arrival}</li>
  ${dateFormatted ? `<li><strong>Date :</strong> ${dateFormatted}</li>` : ""}
  ${time ? `<li><strong>Heure :</strong> ${time.replace(":", "h")}</li>` : ""}
</ul>
<p>Votre chauffeur vous contactera prochainement pour confirmation.</p>
<p>Merci de votre confiance,<br/>L'équipe NoX VTC</p>`,

    en: `<p>Hello ${firstname},</p>
<p>Your trip request has been successfully registered.</p>
<ul>
  <li><strong>Departure:</strong> ${departure}</li>
  <li><strong>Arrival:</strong> ${arrival}</li>
  ${dateFormatted ? `<li><strong>Date:</strong> ${dateFormatted}</li>` : ""}
  ${time ? `<li><strong>Time:</strong> ${time}</li>` : ""}
</ul>
<p>Your driver will contact you shortly to confirm the booking.</p>
<p>Thank you,<br/>The NoX VTC Team</p>`,

    es: `<p>Hola ${firstname},</p>
<p>Su solicitud de viaje ha sido registrada correctamente.</p>
<ul>
  <li><strong>Salida:</strong> ${departure}</li>
  <li><strong>Llegada:</strong> ${arrival}</li>
  ${dateFormatted ? `<li><strong>Fecha:</strong> ${dateFormatted}</li>` : ""}
  ${time ? `<li><strong>Hora:</strong> ${time}</li>` : ""}
</ul>
<p>Su conductor le contactará en breve para confirmar la reserva.</p>
<p>Gracias,<br/>El equipo NoX VTC</p>`,
  }

  const subject = subjects[lang] ?? subjects.fr
  const html = bodies[lang] ?? bodies.fr

  const result = await sendEmail(email, subject, html)
  return NextResponse.json({ ok: result.success })
}

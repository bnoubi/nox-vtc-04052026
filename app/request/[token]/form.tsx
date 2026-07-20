"use client"

import { useState, useEffect } from "react"

const formatDateFR = (dateStr: string): string => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}
import { createClient } from "@supabase/supabase-js"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const i18n = {
  fr: {
    sub: "Remplissez ce formulaire pour confirmer votre course",
    consentLabel: (op: string) => `En soumettant ce formulaire, j'accepte que mes informations (nom, contact, adresses) soient transmises à ${op} dans le cadre de ma demande de trajet. NoX VTC agit uniquement comme prestataire technique.`,
    consentRequired: "Veuillez accepter la politique de confidentialité pour continuer.",
    sectionIdentity: "Vos informations",
    sectionRoute: "Trajet",
    sectionSchedule: "Date & Passagers",
    sectionNotes: "Notes",
    civility: "Civilité", mr: "M.", mme: "Mme",
    firstname: "Prénom *", lastname: "Nom *",
    phone: "Téléphone *", email: "Email",
    departure: "Adresse de départ *", arrival: "Adresse d'arrivée *",
    date: "Date *", time: "Heure *",
    passengers: "Passagers", luggage: "Bagages",
    notes: "Notes", notesPlaceholder: "Numéro de vol, instructions… (facultatif)",
    submit: "Envoyer ma demande", submitting: "Envoi en cours…",
    success: "Demande envoyée !",
    successSub: "Votre chauffeur a reçu votre demande et vous contactera pour confirmation.",
    whatsapp: "Contacter sur WhatsApp",
    required: "Merci de remplir tous les champs obligatoires (*) et au moins un contact (téléphone ou email).",
    error: "Une erreur est survenue. Veuillez réessayer.",
    disclaimer: "Ce formulaire constitue une demande de trajet préliminaire et ne vaut pas bon de réservation. Un bon de réservation officiel vous sera transmis après confirmation par votre chauffeur VTC.",
    poweredBy: "Propulsé par NoX VTC",
    estimatedDistance: "Distance estimée",
    estimatedDuration: "Durée estimée",
    estimatedNote: "Ces estimations sont indicatives et peuvent varier selon le trafic.",
  },
  en: {
    sub: "Fill in this form to confirm your ride",
    consentLabel: (op: string) => `By submitting this form, I agree that my information (name, contact, addresses) will be shared with ${op} for the purpose of my trip request. NoX VTC acts solely as a technical provider.`,
    consentRequired: "Please accept the privacy policy to continue.",
    sectionIdentity: "Your information",
    sectionRoute: "Route",
    sectionSchedule: "Date & Passengers",
    sectionNotes: "Notes",
    civility: "Title", mr: "Mr", mme: "Ms",
    firstname: "First name *", lastname: "Last name *",
    phone: "Phone *", email: "Email",
    departure: "Departure address *", arrival: "Arrival address *",
    date: "Date *", time: "Time *",
    passengers: "Passengers", luggage: "Luggage",
    notes: "Notes", notesPlaceholder: "Flight number, instructions… (optional)",
    submit: "Send my request", submitting: "Sending…",
    success: "Request sent!",
    successSub: "Your driver has received your request and will contact you to confirm.",
    whatsapp: "Contact on WhatsApp",
    required: "Please fill in all required fields (*) and provide at least a phone number or email.",
    error: "An error occurred. Please try again.",
    disclaimer: "This form is a preliminary trip request and does not constitute a booking confirmation. An official booking confirmation will be sent to you after validation by your driver.",
    poweredBy: "Powered by NoX VTC",
    estimatedDistance: "Estimated distance",
    estimatedDuration: "Estimated duration",
    estimatedNote: "These estimates are indicative and may vary depending on traffic.",
  },
  es: {
    sub: "Complete este formulario para confirmar su traslado",
    consentLabel: (op: string) => `Al enviar este formulario, acepto que mis datos (nombre, contacto, direcciones) sean transmitidos a ${op} en el marco de mi solicitud de viaje. NoX VTC actúa únicamente como proveedor técnico.`,
    consentRequired: "Por favor, acepte la política de privacidad para continuar.",
    sectionIdentity: "Sus datos",
    sectionRoute: "Viaje",
    sectionSchedule: "Fecha y pasajeros",
    sectionNotes: "Notas",
    civility: "Tratamiento", mr: "Sr.", mme: "Sra.",
    firstname: "Nombre *", lastname: "Apellido *",
    phone: "Teléfono *", email: "Email",
    departure: "Dirección de salida *", arrival: "Dirección de llegada *",
    date: "Fecha *", time: "Hora *",
    passengers: "Pasajeros", luggage: "Equipaje",
    notes: "Notas", notesPlaceholder: "Número de vuelo, instrucciones… (opcional)",
    submit: "Enviar mi solicitud", submitting: "Enviando…",
    success: "¡Solicitud enviada!",
    successSub: "Su conductor ha recibido su solicitud y le contactará para confirmar.",
    whatsapp: "Contactar por WhatsApp",
    required: "Por favor, complete los campos obligatorios (*) y proporcione al menos un teléfono o email.",
    error: "Se ha producido un error. Por favor, inténtelo de nuevo.",
    disclaimer: "Este formulario es una solicitud preliminar de viaje y no constituye una confirmación de reserva. Una confirmación oficial le será enviada tras la validación por su conductor.",
    poweredBy: "Powered by NoX VTC",
    estimatedDistance: "Distancia estimada",
    estimatedDuration: "Duración estimada",
    estimatedNote: "Estas estimaciones son indicativas y pueden variar según el tráfico.",
  },
  it: {
    sub: "Compila questo modulo per confermare il tuo trasferimento",
    consentLabel: (op: string) => `Inviando questo modulo, accetto che i miei dati (nome, contatto, indirizzi) vengano trasmessi a ${op} nell'ambito della mia richiesta di trasferimento. NoX VTC agisce solo come fornitore tecnico.`,
    consentRequired: "Accettare l'informativa sulla privacy per continuare.",
    sectionIdentity: "I tuoi dati",
    sectionRoute: "Percorso",
    sectionSchedule: "Data e passeggeri",
    sectionNotes: "Note",
    civility: "Titolo", mr: "Sig.", mme: "Sig.ra",
    firstname: "Nome *", lastname: "Cognome *",
    phone: "Telefono *", email: "Email",
    departure: "Indirizzo di partenza *", arrival: "Indirizzo di arrivo *",
    date: "Data *", time: "Ora *",
    passengers: "Passeggeri", luggage: "Bagagli",
    notes: "Note", notesPlaceholder: "Numero di volo, istruzioni… (facoltativo)",
    submit: "Invia la mia richiesta", submitting: "Invio in corso…",
    success: "Richiesta inviata!",
    successSub: "Il suo conducente ha ricevuto la sua richiesta e la contatterà per la conferma.",
    whatsapp: "Contatta su WhatsApp",
    required: "Per favore, compila tutti i campi obbligatori (*) e fornisci almeno un telefono o email.",
    error: "Si è verificato un errore. Riprova.",
    disclaimer: "Questo modulo costituisce una richiesta preliminare di viaggio e non costituisce una conferma di prenotazione. Una conferma ufficiale le verrà inviata dopo la validazione da parte del conducente.",
    poweredBy: "Sviluppato da NoX VTC",
    estimatedDistance: "Distanza stimata",
    estimatedDuration: "Durata stimata",
    estimatedNote: "Queste stime sono indicative e possono variare in base al traffico.",
  },
} as const
type Lang = keyof typeof i18n

interface Props {
  token: string
  operatorUserId: string
  operatorName: string
  operatorPhone: string
  operatorLogo: string
  operatorSiren?: string
  initialDeparture: string
  initialArrival: string
  initialDate: string
  initialTime: string
  initialPassengers: number
  initialLuggage: number
  initialNotes: string
}

function Counter({ value, onChange, min = 0, max = 8 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-full bg-[#C5A059] text-white flex items-center justify-center text-lg font-bold hover:bg-[#B8955A] transition-colors active:scale-95">
        −
      </button>
      <span className="text-[#1A1A1A] font-semibold w-4 text-center">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-full bg-[#C5A059] text-white flex items-center justify-center text-lg font-bold hover:bg-[#B8955A] transition-colors active:scale-95">
        +
      </button>
    </div>
  )
}

const INPUT = "w-full bg-[#F9F6F0] rounded-xl px-3 py-2.5 text-[#1A1A1A] text-sm placeholder:text-[#BBAA88] outline-none border border-[#E8D5A3] focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/20"
const CARD = "bg-white rounded-2xl border border-[#E8D5A3]/40 p-4 space-y-3 shadow-sm"
const LABEL = "text-xs text-[#1A1A1A] font-medium block mb-1"
const SECTION_TITLE = "text-[10px] font-bold uppercase tracking-wider text-[#C5A059] mb-1"

export function TripRequestForm({
  token, operatorUserId, operatorName, operatorPhone, operatorLogo, operatorSiren,
  initialDeparture, initialArrival, initialDate, initialTime,
  initialPassengers, initialLuggage, initialNotes,
}: Props) {
  const [lang, setLang] = useState<Lang>("fr")
  const t = i18n[lang]

  const [civility, setCivility] = useState<"M." | "Mme">("M.")
  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [departure, setDeparture] = useState(initialDeparture)
  const [arrival, setArrival] = useState(initialArrival)
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState(initialTime)
  const [passengers, setPassengers] = useState(initialPassengers)
  const [luggage, setLuggage] = useState(initialLuggage)
  const [notes, setNotes] = useState(initialNotes)
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null)
  const [estimatedDuration, setEstimatedDuration] = useState<string | null>(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!departure || !arrival) {
      setEstimatedDistance(null)
      setEstimatedDuration(null)
      return
    }
    const calculate = async () => {
      try {
        const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
          },
          body: JSON.stringify({
            origin: { address: departure },
            destination: { address: arrival },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
          }),
        })
        const data = await res.json()
        if (data.routes?.[0]) {
          const meters = data.routes[0].distanceMeters as number
          const seconds = parseInt(data.routes[0].duration as string)
          const km = Math.round(meters / 100) / 10
          const mins = Math.round(seconds / 60)
          const hours = Math.floor(mins / 60)
          const remainMins = mins % 60
          const duration = hours > 0 ? `${hours}h ${remainMins}min` : `${mins} min`
          setEstimatedDistance(km)
          setEstimatedDuration(duration)
        }
      } catch {
        // silently fail
      }
    }
    void calculate()
  }, [departure, arrival])

  const mapUrl =
    departure && arrival
      ? `https://maps.googleapis.com/maps/api/staticmap?size=600x200&scale=2` +
        `&markers=color:0x4285F4|label:D|${encodeURIComponent(departure)}` +
        `&markers=color:0xEA4335|label:A|${encodeURIComponent(arrival)}` +
        `&path=color:0x4285F480|weight:3|${encodeURIComponent(departure)}|${encodeURIComponent(arrival)}` +
        `&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstname || !lastname || (!phone && !email) || !departure || !arrival || !date || !time) {
      setError(t.required)
      return
    }
    if (!consentChecked) {
      setError(t.consentRequired)
      return
    }
    setError("")
    setSubmitting(true)
    try {
      const { error: dbError } = await supabase
        .from("trip_requests")
        .update({
          passenger_civility: civility,
          passenger_firstname: firstname,
          passenger_lastname: lastname,
          passenger_phone: phone || null,
          passenger_email: email || null,
          departure,
          arrival,
          trip_date: date,
          trip_time: time || null,
          passengers_count: passengers,
          luggage_count: luggage,
          notes: notes || null,
          estimated_distance: estimatedDistance ?? null,
          estimated_duration: estimatedDuration ?? null,
          status: "filled",
        })
        .eq("token", token)
        .eq("status", "pending")

      if (dbError) throw dbError

      if (email) {
        await fetch("/api/trip-request/confirm-passenger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, firstname, departure, arrival, date, time, lang, operatorUserId, operatorName }),
        })
      }
      await fetch("/api/trip-request/notify-operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: operatorUserId,
          passengerName: `${civility} ${firstname} ${lastname}`,
          departure,
          arrival,
          date,
          time,
          estimatedDistance,
          estimatedDuration,
        }),
      }).catch(() => {})
      setSubmitted(true)
    } catch {
      setError(t.error)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    const waPhone = operatorPhone.replace(/\D/g, "")
    const waMsg = encodeURIComponent(
      `Bonjour, j'ai rempli votre formulaire de demande de trajet (${departure} → ${arrival}).`
    )
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-6">
          <span className="text-4xl">✅</span>
        </div>
        <h1 className="text-2xl font-bold text-[#1A1A1A] mb-3">{t.success}</h1>
        <p className="text-sm text-[#666] max-w-xs">{t.successSub}</p>
        {waPhone && (
          <a href={`https://wa.me/${waPhone}?text=${waMsg}`} target="_blank" rel="noopener noreferrer"
            className="mt-8 flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#25D366] text-white font-semibold text-sm">
            <span>💬</span> {t.whatsapp}
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F6F0] pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E8D5A3]/60 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {operatorLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={operatorLogo} alt={operatorName} className="h-9 w-9 rounded-full object-cover border border-[#E8D5A3]" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-[#C5A059]/10 border border-[#E8D5A3] flex items-center justify-center shrink-0">
              <span className="text-[#C5A059] text-xs font-bold">{operatorName[0]}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1A1A1A] truncate max-w-[150px]">{operatorName}</p>
            {operatorSiren && <p className="text-[10px] text-[#999]">SIREN : {operatorSiren}</p>}
            {operatorPhone && <p className="text-[10px] text-[#999]">Tél : {operatorPhone}</p>}
          </div>
        </div>
        <div className="flex gap-1">
          {(["fr", "en", "es", "it"] as Lang[]).map(l => (
            <button key={l} type="button" onClick={() => setLang(l)}
              className={`text-base px-1.5 py-0.5 rounded-lg transition-colors ${lang === l ? "bg-[#C5A059]/15 ring-1 ring-[#C5A059]/40" : "opacity-35 hover:opacity-70"}`}>
              {l === "fr" ? "🇫🇷" : l === "en" ? "🇬🇧" : l === "es" ? "🇪🇸" : "🇮🇹"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 max-w-lg mx-auto">
        <p className="text-xs text-[#999]">{t.sub}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identity */}
          <div className={CARD}>
            <p className={SECTION_TITLE}>{t.sectionIdentity}</p>
            <div className="flex gap-2">
              {(["M.", "Mme"] as const).map(c => (
                <button key={c} type="button" onClick={() => setCivility(c)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${civility === c ? "bg-[#C5A059] text-white" : "bg-[#F9F6F0] text-[#666] border border-[#E8D5A3] hover:border-[#C5A059]"}`}>
                  {c === "M." ? t.mr : t.mme}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>{t.firstname}</label>
                <input value={firstname} onChange={e => setFirstname(e.target.value)}
                  className={INPUT} placeholder="Jean" />
              </div>
              <div>
                <label className={LABEL}>{t.lastname}</label>
                <input value={lastname} onChange={e => setLastname(e.target.value)}
                  className={INPUT} placeholder="Dupont" />
              </div>
            </div>
            <div>
              <label className={LABEL}>{t.phone}</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className={INPUT} placeholder="+33 6 12 34 56 78" />
            </div>
            <div>
              <label className={LABEL}>{t.email}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className={INPUT} placeholder="jean@exemple.fr" />
            </div>
          </div>

          {/* Route */}
          <div className={CARD}>
            <p className={SECTION_TITLE}>{t.sectionRoute}</p>
            <div>
              <label className={LABEL}>{t.departure}</label>
              <div className="relative">
                <PlacesAutocomplete
                  value={departure} onChange={setDeparture}
                  placeholder="Paris, Gare du Nord"
                  className={`${INPUT} ${departure ? "pr-8" : ""}`} addressMode="full"
                />
                {departure && (
                  <button type="button" onClick={() => setDeparture("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#BBAA88] hover:text-[#888] text-xs z-10 leading-none">
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className={LABEL}>{t.arrival}</label>
              <div className="relative">
                <PlacesAutocomplete
                  value={arrival} onChange={setArrival}
                  placeholder="Aéroport CDG, Terminal 2E"
                  className={`${INPUT} ${arrival ? "pr-8" : ""}`} addressMode="full"
                />
                {arrival && (
                  <button type="button" onClick={() => setArrival("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#BBAA88] hover:text-[#888] text-xs z-10 leading-none">
                    ✕
                  </button>
                )}
              </div>
            </div>
            {mapUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mapUrl} alt="aperçu trajet" className="w-full rounded-xl object-cover border border-[#E8D5A3]/40" style={{ height: 130 }} />
            )}
            {estimatedDistance !== null && (
              <div style={{ background: "#FFF8EC", borderLeft: "3px solid #C5A059", paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderRadius: 8 }}>
                <p style={{ color: "#1A1A1A", fontSize: 13, fontWeight: 600, marginBottom: 2 }}>📍 {t.estimatedDistance} : {estimatedDistance} km</p>
                {estimatedDuration && <p style={{ color: "#1A1A1A", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>⏱ {t.estimatedDuration} : {estimatedDuration}</p>}
                <p style={{ color: "#999", fontSize: 11, fontStyle: "italic" }}>{t.estimatedNote}</p>
              </div>
            )}
          </div>

          {/* Schedule & counts */}
          <div className={CARD}>
            <p className={SECTION_TITLE}>{t.sectionSchedule}</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className={LABEL}>{t.date}</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className={INPUT} />
                {date && (
                  <p className="text-xs text-[#C5A059]/70 mt-1">{formatDateFR(date)}</p>
                )}
              </div>
              <div>
                <label className={LABEL}>{t.time}</label>
                <select value={time} onChange={e => setTime(e.target.value)}
                  className={INPUT}>
                  <option value="">-- Heure --</option>
                  {Array.from({ length: 24 * 12 }, (_, i) => {
                    const h = Math.floor(i / 12)
                    const m = (i % 12) * 5
                    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
                  }).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-[#1A1A1A] font-medium">{t.passengers}</span>
              <Counter value={passengers} onChange={setPassengers} min={1} />
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-[#1A1A1A] font-medium">{t.luggage}</span>
              <Counter value={luggage} onChange={setLuggage} />
            </div>
          </div>

          {/* Notes */}
          <div className={CARD}>
            <p className={SECTION_TITLE}>{t.sectionNotes}</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder={t.notesPlaceholder}
              className="w-full bg-[#F9F6F0] rounded-xl px-3 py-2.5 text-[#1A1A1A] text-sm placeholder:text-[#BBAA88] outline-none border border-[#E8D5A3] focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/20 resize-none" />
          </div>

          {/* RGPD consent */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-[#E8D5A3]/60 bg-white cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={e => setConsentChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#C5A059]"
            />
            <span className="text-[11px] text-[#555] leading-relaxed">
              {t.consentLabel(operatorName)}
            </span>
          </label>

          {error && <p className="text-sm text-red-500 text-center px-2">{error}</p>}

          <button type="submit" disabled={submitting || !consentChecked}
            className="w-full py-4 rounded-2xl bg-[#C5A059] text-white font-bold text-sm hover:bg-[#B8955A] transition-colors active:scale-[0.98] disabled:opacity-60">
            {submitting ? t.submitting : t.submit}
          </button>
        </form>

        {/* Legal disclaimer */}
        <p className="text-[10px] text-[#999] text-center italic leading-relaxed px-2 pt-2">
          {t.disclaimer}
        </p>

        {/* Powered by */}
        <p className="text-[10px] text-center pb-4" style={{ color: "#C5A059", opacity: 0.6 }}>
          {t.poweredBy}
        </p>
      </div>
    </div>
  )
}

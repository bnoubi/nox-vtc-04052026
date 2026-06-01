import { createClient } from "@supabase/supabase-js"
import { TripRequestForm } from "./form"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  params: Promise<{ token: string }>
}

export default async function TripRequestPage({ params }: Props) {
  const { token } = await params

  const { data: req } = await supabase
    .from("trip_requests")
    .select("*")
    .eq("token", token)
    .single()

  if (!req) return <ErrorScreen type="invalid" />

  const isExpired = new Date(req.expires_at) < new Date()
  if (isExpired || req.status === "expired") return <ErrorScreen type="expired" />
  if (req.status === "filled" || req.status === "converted") return <ErrorScreen type="filled" />
  if (req.status === "cancelled") return <ErrorScreen type="invalid" />

  const { data: profile } = await supabase
    .from("profiles")
    .select("nom_entreprise, siret, prenom_representant_legal, nom_representant_legal, telephone, logo_url")
    .eq("user_id", req.user_id)
    .single()

  const operatorName =
    profile?.nom_entreprise ||
    [profile?.prenom_representant_legal, profile?.nom_representant_legal].filter(Boolean).join(" ") ||
    "Votre chauffeur"

  return (
    <TripRequestForm
      token={token}
      operatorName={operatorName}
      operatorPhone={profile?.telephone ?? ""}
      operatorLogo={profile?.logo_url ?? ""}
      operatorSiren={profile?.siret ?? ""}
      initialDeparture={req.departure ?? ""}
      initialArrival={req.arrival ?? ""}
      initialDate={req.trip_date ?? ""}
      initialTime={req.trip_time ?? ""}
      initialPassengers={req.passengers_count ?? 1}
      initialLuggage={req.luggage_count ?? 0}
      initialNotes={req.notes ?? ""}
    />
  )
}

function ErrorScreen({ type }: { type: "invalid" | "expired" | "filled" }) {
  const config = {
    invalid: { icon: "🔗", fr: "Lien invalide", en: "Invalid link", msg: "Ce lien de réservation est invalide ou introuvable." },
    expired: { icon: "⏱", fr: "Lien expiré", en: "Link expired", msg: "Ce lien de réservation a expiré." },
    filled:  { icon: "✅", fr: "Déjà rempli", en: "Already submitted", msg: "Cette demande a déjà été complétée." },
  }[type]

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6">
        <span className="text-3xl">{config.icon}</span>
      </div>
      <h1 className="text-xl font-bold text-white mb-1">
        {config.fr} <span className="text-zinc-500 font-normal">· {config.en}</span>
      </h1>
      <p className="text-sm text-zinc-400 mt-2 max-w-xs">{config.msg}</p>
    </div>
  )
}

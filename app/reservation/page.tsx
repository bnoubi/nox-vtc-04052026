import type { Metadata } from "next"
import { ReservationForm } from "@/components/reservation/reservation-form"

export const metadata: Metadata = {
  title: "Ma Réservation | NoX VTC",
  description:
    "Réservez votre chauffeur privé NoX VTC. Service de transport d'exception.",
}

export default function ReservationPage() {
  return <ReservationForm />
}

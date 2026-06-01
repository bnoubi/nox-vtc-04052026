"use client"

import { useState, useRef } from "react"
import { Link2, Plus } from "lucide-react"
import { useNox, type TripRequest } from "./nox-context"
import { type BCDocument } from "./data"
import { CreateBCFlow } from "./create-bc"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function isExpired(expires_at: string): boolean {
  return new Date(expires_at) < new Date()
}

function formatExpiry(expires_at: string): string {
  const d = new Date(expires_at)
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) +
    " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function effectiveStatus(req: TripRequest): TripRequest["status"] {
  if (req.status === "pending" && isExpired(req.expires_at)) return "expired"
  return req.status
}

const ORDER: Record<string, number> = { filled: 0, pending: 1, converted: 2, expired: 3, cancelled: 4 }

function sortRequests(requests: TripRequest[]): TripRequest[] {
  return [...requests].sort((a, b) =>
    (ORDER[effectiveStatus(a)] ?? 4) - (ORDER[effectiveStatus(b)] ?? 4)
  )
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  pending:   { label: "En attente",  dot: "bg-amber-400",   text: "text-amber-400" },
  filled:    { label: "À convertir", dot: "bg-blue-400 animate-pulse", text: "text-blue-400" },
  converted: { label: "Convertie",   dot: "bg-emerald-400", text: "text-emerald-400" },
  expired:   { label: "Expirée",     dot: "bg-zinc-500",    text: "text-zinc-400" },
  cancelled: { label: "Annulée",     dot: "bg-red-400",     text: "text-red-400" },
}

function TripRequestItem({ req, onConvert }: { req: TripRequest; onConvert: (req: TripRequest) => void }) {
  const status = effectiveStatus(req)
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.expired
  const isFilled = status === "filled"

  return (
    <div className={cn(
      "p-3 rounded-2xl bg-onyx-card border transition-all",
      isFilled
        ? "border-gold/50 shadow-[0_0_10px_rgba(212,175,55,0.15)]"
        : "border-onyx-border/40"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn("w-2 h-2 rounded-full shrink-0 mt-0.5", cfg.dot)} />
          <div className="flex-1 min-w-0">
            {isFilled ? (
              <>
                <p className="text-sm font-semibold text-foreground truncate">
                  {[req.passenger_civility, req.passenger_firstname, req.passenger_lastname]
                    .filter(Boolean).join(" ") || "Passager"}
                </p>
                {(req.departure || req.arrival) && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {req.departure ?? "—"} → {req.arrival ?? "—"}
                  </p>
                )}
                {req.trip_date && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {new Date(req.trip_date).toLocaleDateString("fr-FR", {
                      weekday: "short", day: "numeric", month: "long"
                    })}
                    {req.trip_time ? ` · ${req.trip_time.replace(":", "h")}` : ""}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  {status === "pending" ? "En attente du client…" :
                   status === "converted" ? "Demande convertie en BC" :
                   status === "expired" ? "Lien expiré" : "Demande annulée"}
                </p>
                {status === "pending" && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    Expire le {formatExpiry(req.expires_at)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={cn("text-[10px] font-semibold", cfg.text)}>{cfg.label}</span>
          {isFilled && (
            <button
              onClick={() => onConvert(req)}
              className="px-2 py-1 rounded-lg bg-gold text-black text-[10px] font-bold hover:bg-gold/90 transition-colors active:scale-95"
            >
              Convertir en BC
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function TripRequestsWidget() {
  const { tripRequests, loadTripRequests, clients, addClient, bcs, plan, tokens } = useNox()
  const supabase = createClient()
  const [showBC, setShowBC] = useState(false)
  const [showConvertFlow, setShowConvertFlow] = useState(false)
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [convertingRequest, setConvertingRequest] = useState<TripRequest | null>(null)
  const [pendingPrefillBC, setPendingPrefillBC] = useState<BCDocument | null>(null)
  const bcIdsBeforeRef = useRef<Set<string>>(new Set())
  const convertingRequestRef = useRef<TripRequest | null>(null)

  // Detect new BC after conversion
  const handleBCsChange = (currentBcs: typeof bcs) => {
    const req = convertingRequestRef.current
    if (!req) return
    const newBC = currentBcs.find(b => !bcIdsBeforeRef.current.has(b.id))
    if (!newBC) return
    convertingRequestRef.current = null
    setConvertingRequest(null)
    void (async () => {
      await supabase.from("trip_requests").update({ status: "converted", bc_id: newBC.id }).eq("id", req.id)
      await loadTripRequests()
    })()
  }

  // Run check whenever bcs changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevBcsRef = useRef(bcs)
  if (prevBcsRef.current !== bcs) {
    prevBcsRef.current = bcs
    handleBCsChange(bcs)
  }

  function handleConvertRequest(req: TripRequest) {
    if (plan === "SOLO" && tokens <= 0) return // silently block (no token modal in widget)
    const passengerName = [req.passenger_firstname, req.passenger_lastname].filter(Boolean).join(" ")
    const buildPrefill = (clientId?: string): BCDocument => ({
      id: "", number: "", client: passengerName || "Client", clientId,
      amount: 0, date: new Date().toLocaleDateString("fr-FR"),
      status: "brouillon", type: "bc",
      trajet: {
        depart: req.departure ?? "", arrivee: req.arrival ?? "",
        date: req.trip_date ?? "", time: req.trip_time ?? "",
        passengers: req.passengers_count, luggage: req.luggage_count,
        stops: req.stops ?? [],
      },
      notes: req.notes ?? undefined,
      passagerNom: passengerName || undefined,
      passagerTelephone: req.passenger_phone ?? undefined,
    })
    const foundClient = clients.find(c =>
      (req.passenger_phone && c.phone && c.phone === req.passenger_phone) ||
      (req.passenger_email && c.email && c.email === req.passenger_email)
    )
    bcIdsBeforeRef.current = new Set(bcs.map(b => b.id))
    setConvertingRequest(req)
    convertingRequestRef.current = req
    if (foundClient) {
      setPendingPrefillBC(buildPrefill(foundClient.id))
      setShowConvertFlow(true)
    } else if (passengerName || req.passenger_phone) {
      setPendingPrefillBC(buildPrefill())
      setShowNewClientModal(true)
    } else {
      setPendingPrefillBC(buildPrefill())
      setShowConvertFlow(true)
    }
  }

  const filledCount = tripRequests.filter(r => r.status === "filled").length
  const sorted = sortRequests(tripRequests)

  return (
    <section className="px-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Demandes de trajet</h2>
          {filledCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-gold/20 text-gold text-[10px] font-bold leading-tight animate-pulse">
              {filledCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowBC(true)}
          className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center hover:bg-gold/20 transition-colors"
        >
          <Plus className="h-4 w-4 text-gold" />
        </button>
      </div>

      {tripRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-2xl bg-onyx-card border border-onyx-border/40 text-center">
          <Link2 className="h-8 w-8 text-muted-foreground/30 mb-3" strokeWidth={1} />
          <p className="text-sm font-medium text-muted-foreground">
            Aucune demande de trajet pour le moment.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Partagez un lien à votre client pour commencer.
          </p>
          <button
            onClick={() => setShowBC(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-gold text-black text-xs font-semibold hover:bg-gold/90 transition-colors"
          >
            Créer un lien
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(req => (
            <TripRequestItem key={req.id} req={req} onConvert={handleConvertRequest} />
          ))}
        </div>
      )}

      {/* Link creation flow */}
      <CreateBCFlow open={showBC} onClose={() => setShowBC(false)} />

      {/* Conversion flow */}
      <CreateBCFlow
        open={showConvertFlow}
        onClose={() => {
          setShowConvertFlow(false)
          setPendingPrefillBC(null)
          convertingRequestRef.current = null
          setConvertingRequest(null)
        }}
        prefillBC={pendingPrefillBC}
      />

      {/* New Client Modal */}
      {showNewClientModal && convertingRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-5 bg-black/60"
          onClick={() => setShowNewClientModal(false)}>
          <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl border border-onyx-border/40 p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <p className="text-base font-bold text-foreground">👤 Nouveau client détecté</p>
            <p className="text-sm text-muted-foreground">
              {[convertingRequest.passenger_firstname, convertingRequest.passenger_lastname].filter(Boolean).join(" ")}
              {convertingRequest.passenger_phone ? ` — ${convertingRequest.passenger_phone}` : ""}
            </p>
            <p className="text-xs text-muted-foreground/70">Voulez-vous l&apos;ajouter à votre carnet clients ?</p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setShowNewClientModal(false)
                  const req = convertingRequest
                  const newClientId = await addClient({
                    id: "", type: "particulier",
                    civilite: (req.passenger_civility as "M." | "Mme") || "M.",
                    prenom: req.passenger_firstname ?? "", nom: req.passenger_lastname ?? "",
                    phone: req.passenger_phone ?? "", email: req.passenger_email ?? "",
                    billingAddress: { rue: "", codePostal: "", ville: "" },
                    trips: 0, lastTrip: "", notes: "",
                  })
                  setPendingPrefillBC(prev => prev ? { ...prev, clientId: newClientId ?? undefined } : prev)
                  setShowConvertFlow(true)
                }}
                className="flex-1 py-3 rounded-xl bg-gold text-black text-sm font-semibold hover:bg-gold/90 transition-colors"
              >
                Ajouter au carnet
              </button>
              <button
                onClick={() => { setShowNewClientModal(false); setShowConvertFlow(true) }}
                className="flex-1 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 text-muted-foreground text-sm font-semibold"
              >
                Ignorer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

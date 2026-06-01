"use client"

import { useState } from "react"
import { Link2, Plus } from "lucide-react"
import { useNox, type TripRequest } from "./nox-context"
import { CreateBCFlow } from "./create-bc"
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

function TripRequestItem({ req }: { req: TripRequest }) {
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
              disabled
              className="px-2 py-1 rounded-lg bg-gold/10 text-gold text-[10px] font-semibold opacity-50 cursor-not-allowed"
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
  const { tripRequests } = useNox()
  const [showBC, setShowBC] = useState(false)

  const filledCount = tripRequests.filter(r => r.status === "filled").length
  const sorted = sortRequests(tripRequests)

  return (
    <section className="px-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Demandes de trajet</h2>
          {filledCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-gold/20 text-gold text-[10px] font-bold leading-tight">
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
          {sorted.map(req => <TripRequestItem key={req.id} req={req} />)}
        </div>
      )}

      <CreateBCFlow open={showBC} onClose={() => setShowBC(false)} />
    </section>
  )
}

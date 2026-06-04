"use client"

import { useState } from "react"
import { ArrowLeft, Link2, Plus } from "lucide-react"
import { useNox, type TripRequest } from "./nox-context"
import { sortRequests, TripRequestItem, ResendLinkDrawer } from "./trip-requests-widget"

interface TripRequestsScreenProps {
  onBack: () => void
  onConvertRequest: (req: TripRequest) => void
  onCreateNew: () => void
}

export function TripRequestsScreen({ onBack, onConvertRequest, onCreateNew }: TripRequestsScreenProps) {
  const { tripRequests } = useNox()
  const [resendRequest, setResendRequest] = useState<TripRequest | null>(null)

  const visibleRequests = tripRequests.filter(r => r.status !== "converted" && r.status !== "cancelled")
  const filledCount = visibleRequests.filter(r => r.status === "filled").length
  const sorted = sortRequests(visibleRequests)

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <h1 className="text-base font-bold text-foreground">Demandes de trajet</h1>
          {filledCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-gold/20 text-gold text-[10px] font-bold leading-tight animate-pulse">
              {filledCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-2 mt-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Link2 className="h-8 w-8 text-muted-foreground/30 mb-3" strokeWidth={1} />
            <p className="text-sm font-medium text-muted-foreground">Aucune demande de trajet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Partagez un lien à votre client pour commencer.
            </p>
          </div>
        ) : (
          sorted.map(req => (
            <TripRequestItem
              key={req.id}
              req={req}
              onConvert={onConvertRequest}
              onResend={setResendRequest}
            />
          ))
        )}
      </div>

      <button
        onClick={onCreateNew}
        className="fixed right-5 bottom-28 z-30 w-12 h-12 rounded-full bg-gold flex items-center justify-center gold-glow active:scale-95 transition-all duration-200"
      >
        <Plus className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
      </button>

      {resendRequest && (
        <ResendLinkDrawer req={resendRequest} onClose={() => setResendRequest(null)} />
      )}
    </div>
  )
}

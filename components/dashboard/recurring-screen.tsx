"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, Plus, RefreshCw, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface RecurringContract {
  id: string
  label: string | null
  passenger_name: string | null
  departure: string
  arrival: string
  days_of_week: number[]
  time: string
  status: "active" | "paused" | "ended"
  created_at: string
}

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]

function formatRecurrence(days: number[], time: string): string {
  if (!days || days.length === 0) return time
  const sorted = [...days].sort((a, b) => a - b)
  const labels = sorted.map(d => DAY_LABELS[d] ?? "?")
  return `${labels.join("/")} · ${time}`
}

const statusConfig = {
  active: { label: "Actif", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  paused: { label: "En pause", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  ended: { label: "Terminé", className: "bg-[#2a2a2a] text-muted-foreground border-onyx-border/30" },
}

interface RecurringScreenProps {
  onBack: () => void
}

export function RecurringScreen({ onBack }: RecurringScreenProps) {
  const supabase = createClient()
  const [contracts, setContracts] = useState<RecurringContract[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateContract, setShowCreateContract] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from("recurring_contracts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      setContracts((data as RecurringContract[]) ?? [])
      setLoading(false)
    }
    void load()
  }, [])

  return (
    <div className="flex flex-col h-full bg-background">
      {/* En-tête */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d]">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-white/5"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Trajets Récurrents</h1>
          <p className="text-[10px] text-muted-foreground">Courses régulières planifiées</p>
        </div>
        <button
          onClick={() => setShowCreateContract(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold text-black text-[11px] font-bold hover:bg-gold/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Nouveau contrat
        </button>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-gold animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center mb-4">
              <RefreshCw className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Aucun trajet récurrent pour le moment.
            </p>
            <p className="text-[11px] text-muted-foreground mb-5">
              Créez votre premier contrat pour automatiser vos courses régulières.
            </p>
            <button
              onClick={() => setShowCreateContract(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold text-black text-sm font-semibold hover:bg-gold/90 transition-colors"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Créer un contrat
            </button>
          </div>
        ) : (
          contracts.map(contract => {
            const cfg = statusConfig[contract.status] ?? statusConfig.ended
            return (
              <div
                key={contract.id}
                className="p-4 rounded-2xl bg-[#1a1a1a] border border-onyx-border/30 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <RefreshCw className="h-4 w-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {contract.label || "Trajet sans nom"}
                      </p>
                      {contract.passenger_name && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {contract.passenger_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0",
                    cfg.className
                  )}>
                    {cfg.label}
                  </span>
                </div>

                <div className="pl-[52px] space-y-1">
                  <p className="text-[11px] text-muted-foreground truncate">
                    {contract.departure} → {contract.arrival}
                  </p>
                  <p className="text-[11px] text-gold font-medium">
                    {formatRecurrence(contract.days_of_week, contract.time)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modale création — placeholder */}
      {showCreateContract && (
        <div
          className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center px-5"
          onClick={() => setShowCreateContract(false)}
        >
          <div
            className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-foreground">Nouveau contrat récurrent</h3>
            <p className="text-[11px] text-muted-foreground">
              Cette fonctionnalité sera disponible prochainement.
            </p>
            <button
              onClick={() => setShowCreateContract(false)}
              className="w-full py-3 rounded-xl bg-gold text-black font-semibold text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

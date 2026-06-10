"use client"

import { useState, useEffect } from "react"
import { Coins, History } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"
import { useNav } from "./nav-context"
import { createClient } from "@/lib/supabase/client"

type RecentTx = {
  id: string
  type: string
  amount: number
  created_at: string
}

const TX_LABELS: Record<string, string> = {
  purchase: "Achat",
  consumption: "Réservation",
  admin_grant: "Attribution",
  bonus: "Bonus",
  refund: "Remboursement",
}

function relativeDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function TokenCard() {
  const { tokens } = useNox()
  const { openWallet, navigateToWalletHistory } = useNav()
  const [txs, setTxs] = useState<RecentTx[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('token_transactions')
        .select('id, type, amount, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)
      if (!cancelled) setTxs((data ?? []) as RecentTx[])
    }
    load()
    return () => { cancelled = true }
  }, [])

  const balanceColor =
    tokens === 0
      ? "text-red-400"
      : tokens <= 2
      ? "text-orange-400"
      : "text-gold"

  const balanceLabel =
    tokens === 0
      ? "Solde épuisé"
      : tokens <= 2
      ? "Solde faible"
      : null

  return (
    <section className="px-4">
      <div className="rounded-2xl bg-onyx-card border border-onyx-border/50 overflow-hidden">

        {/* En-tête */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-onyx-border/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gold/10 flex items-center justify-center">
              <Coins className="h-4 w-4 text-gold" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-semibold text-foreground">Mes Jetons</span>
          </div>
          <div className="text-right">
            <p className={cn("text-xl font-bold font-heading tabular-nums", balanceColor)}>
              {tokens}
              <span className="text-xs font-medium ml-1 opacity-70">jetons</span>
            </p>
            {balanceLabel && (
              <p className={cn("text-[10px] font-semibold", balanceColor)}>{balanceLabel}</p>
            )}
          </div>
        </div>

        {/* Dernières transactions */}
        <div className="px-4 py-2">
          {txs.length === 0 ? (
            <div className="py-3 flex items-center justify-center gap-2">
              <History className="h-4 w-4 text-muted-foreground/30" strokeWidth={1.5} />
              <p className="text-xs text-muted-foreground/60">Aucune transaction</p>
            </div>
          ) : (
            txs.map((tx, i) => {
              const isDebit = tx.type === "consumption" || tx.type === "debit" || tx.amount < 0
              return (
                <div key={tx.id} className={cn("flex items-center justify-between py-2", i < txs.length - 1 && "border-b border-onyx-border/20")}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isDebit ? "bg-red-400" : "bg-emerald-400")} />
                    <p className="text-xs text-foreground truncate">{TX_LABELS[tx.type] ?? tx.type}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <p className={cn("text-xs font-bold tabular-nums", isDebit ? "text-red-400" : "text-emerald-400")}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{relativeDate(tx.created_at)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Boutons */}
        <div className="flex gap-2 px-4 pb-4 pt-2">
          <button
            onClick={openWallet}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/10 to-[#D4AF37]/20 border border-gold/40 flex items-center justify-center gap-1.5 hover:border-gold/60 active:scale-[0.98] transition-all"
          >
            <Coins className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
            <span className="text-[11px] font-bold text-gold tracking-wide">Recharger</span>
          </button>
          <button
            onClick={navigateToWalletHistory}
            className="flex-1 py-2.5 rounded-xl bg-secondary/40 border border-onyx-border/50 flex items-center justify-center gap-1.5 hover:border-gold/20 hover:bg-secondary/60 active:scale-[0.98] transition-all"
          >
            <History className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-[11px] font-medium text-muted-foreground">Historique</span>
          </button>
        </div>

      </div>
    </section>
  )
}

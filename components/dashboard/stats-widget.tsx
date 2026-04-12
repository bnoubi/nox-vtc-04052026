"use client"

import { BarChart3 } from "lucide-react"
import { useNox } from "./nox-context"

export function StatsWidget() {
  const { bcs, invoices } = useNox()

  // Calculer les vraies statistiques depuis le store utilisateur
  const totalCAFactures = invoices
    .filter((inv) => inv.status === "payee")
    .reduce((sum, inv) => sum + inv.amount, 0)

  const totalBCs = bcs.length
  const totalInvoices = invoices.length
  const hasAnyData = totalBCs > 0 || totalInvoices > 0

  return (
    <section className="px-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Statistiques</h2>

      {!hasAnyData ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-2xl bg-onyx-card border border-onyx-border/40">
          <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-3" strokeWidth={1} />
          <p className="text-sm font-medium text-muted-foreground">Aucune statistique disponible</p>
          <p className="text-xs text-muted-foreground/60 mt-1 text-center">
            Vos données apparaîtront ici après vos premières courses
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* CA Encaissé */}
          <div className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">CA Encaissé</span>
            </div>
            <p className="text-lg font-bold text-foreground mb-1">
              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(totalCAFactures)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {invoices.filter(i => i.status === "payee").length} facture{invoices.filter(i => i.status === "payee").length !== 1 ? "s" : ""} payée{invoices.filter(i => i.status === "payee").length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Documents */}
          <div className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Documents</span>
            </div>
            <p className="text-lg font-bold text-foreground mb-1">{totalBCs + totalInvoices}</p>
            <p className="text-[10px] text-muted-foreground">
              {totalBCs} BC{totalBCs !== 1 ? "s" : ""} · {totalInvoices} facture{totalInvoices !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

"use client"

import { BarChart3 } from "lucide-react"
import { useNox } from "./nox-context"

const MOIS_NOMS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

export function StatsWidget() {
  const { bcs, invoices } = useNox()

  const totalCAFactures = invoices
    .filter((inv) => inv.status === "payee")
    .reduce((sum, inv) => sum + inv.amount, 0)

  const totalBCs = bcs.length
  const totalInvoices = invoices.length
  const hasAnyData = totalBCs > 0 || totalInvoices > 0

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const coursesThisMonth = bcs.filter((bc) => {
    if (bc.status === "annule_client" || bc.status === "annule_chauffeur") return false
    const parts = bc.date.split("/")
    if (parts.length !== 3) return false
    return parseInt(parts[1], 10) === currentMonth && parseInt(parts[2], 10) === currentYear
  }).length

  const bcsEnAttente = bcs.filter((bc) => bc.status === "en_attente").length

  const monthLabel = MOIS_NOMS[currentMonth - 1]

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

          {/* Courses ce mois */}
          <div className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Courses ce mois</span>
            </div>
            <p className="text-lg font-bold text-foreground mb-1">{coursesThisMonth}</p>
            <p className="text-[10px] text-muted-foreground">en {monthLabel} {currentYear}</p>
          </div>

          {/* En attente */}
          <div className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">En attente</span>
            </div>
            <p className="text-lg font-bold text-foreground mb-1">{bcsEnAttente}</p>
            <p className="text-[10px] text-muted-foreground">bons à confirmer</p>
          </div>
        </div>
      )}
    </section>
  )
}

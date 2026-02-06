"use client"

import { useState } from "react"
import { Search, MoreHorizontal, Eye, Share2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type DocType = "bc" | "facture"
type DocStatus = "signe" | "en_attente" | "paye" | "annule"

interface Document {
  id: string
  number: string
  client: string
  amount: number
  date: string
  status: DocStatus
  type: DocType
}

const documents: Document[] = [
  {
    id: "1",
    number: "BC-2026-02-001",
    client: "M. Laurent",
    amount: 350,
    date: "06/02/2026",
    status: "signe",
    type: "bc",
  },
  {
    id: "2",
    number: "BC-2026-02-002",
    client: "Mme Beaumont",
    amount: 180,
    date: "05/02/2026",
    status: "en_attente",
    type: "bc",
  },
  {
    id: "3",
    number: "BC-2026-01-014",
    client: "M. Moreau",
    amount: 520,
    date: "28/01/2026",
    status: "signe",
    type: "bc",
  },
  {
    id: "4",
    number: "FAC-2026-02-001",
    client: "M. Laurent",
    amount: 350,
    date: "06/02/2026",
    status: "paye",
    type: "facture",
  },
  {
    id: "5",
    number: "FAC-2026-01-012",
    client: "Mme Beaumont",
    amount: 640,
    date: "31/01/2026",
    status: "paye",
    type: "facture",
  },
  {
    id: "6",
    number: "FAC-2026-01-011",
    client: "M. Moreau",
    amount: 210,
    date: "29/01/2026",
    status: "en_attente",
    type: "facture",
  },
]

const statusConfig: Record<DocStatus, { label: string; className: string }> = {
  signe: {
    label: "Signé",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  en_attente: {
    label: "En attente",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  paye: {
    label: "Payé",
    className: "bg-gold/10 text-gold border-gold/20",
  },
  annule: {
    label: "Annulé",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
}

function DocCard({ doc }: { doc: Document }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = statusConfig[doc.status]

  return (
    <div className="relative p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/20 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-mono text-muted-foreground">{doc.number}</p>
          <p className="text-sm font-medium text-foreground mt-0.5">{doc.client}</p>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gold">
            {new Intl.NumberFormat("fr-FR").format(doc.amount)}€
          </span>
          <span className="text-[11px] text-muted-foreground">{doc.date}</span>
        </div>
        <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full border", status.className)}>
          {status.label}
        </span>
      </div>

      {/* Quick actions menu */}
      {menuOpen && (
        <div className="absolute top-12 right-4 z-20 bg-onyx-card border border-onyx-border rounded-xl py-1 shadow-xl shadow-black/40 min-w-[140px]">
          {[
            { icon: Eye, label: "Voir" },
            { icon: Share2, label: "Partager" },
            { icon: XCircle, label: "Annuler" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-foreground hover:bg-secondary/50 transition-colors"
            >
              <action.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DocumentsTab() {
  const [activeType, setActiveType] = useState<DocType>("bc")
  const [search, setSearch] = useState("")

  const filtered = documents.filter(
    (d) =>
      d.type === activeType &&
      (d.number.toLowerCase().includes(search.toLowerCase()) ||
        d.client.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-4">
        <h1 className="text-lg font-bold text-foreground mb-3">Documents</h1>

        {/* Type Tabs */}
        <div className="flex gap-2 mb-3">
          {[
            { id: "bc" as DocType, label: "Bons de Commande" },
            { id: "facture" as DocType, label: "Factures" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveType(tab.id)}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-medium border transition-all duration-200",
                activeType === tab.id
                  ? "bg-gold/15 border-gold/40 text-gold"
                  : "bg-onyx-card border-onyx-border/50 text-muted-foreground hover:border-onyx-border",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Rechercher un document..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-onyx-card border border-onyx-border/50 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/40 transition-colors"
          />
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-8">
        {filtered.length > 0 ? (
          filtered.map((doc) => <DocCard key={doc.id} doc={doc} />)
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">Aucun document trouvé</p>
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Search, MoreHorizontal, Eye, Share2, XCircle, FileText, Receipt, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { CreateBCFlow } from "./create-bc"

type DocType = "bc" | "facture"
type DocStatus = "signe" | "en_attente" | "paye" | "brouillon" | "annule"

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
    number: "BC-2026-001",
    client: "M. Laurent",
    amount: 350,
    date: "06/02/2026",
    status: "signe",
    type: "bc",
  },
  {
    id: "2",
    number: "BC-2026-002",
    client: "Mme Beaumont",
    amount: 180,
    date: "05/02/2026",
    status: "en_attente",
    type: "bc",
  },
  {
    id: "3",
    number: "BC-2026-003",
    client: "M. Moreau",
    amount: 520,
    date: "04/02/2026",
    status: "signe",
    type: "bc",
  },
  {
    id: "4",
    number: "BC-2026-004",
    client: "Mme Dubois",
    amount: 95,
    date: "03/02/2026",
    status: "brouillon",
    type: "bc",
  },
  {
    id: "5",
    number: "FAC-2026-001",
    client: "M. Laurent",
    amount: 350,
    date: "06/02/2026",
    status: "paye",
    type: "facture",
  },
  {
    id: "6",
    number: "FAC-2026-002",
    client: "Mme Beaumont",
    amount: 640,
    date: "31/01/2026",
    status: "paye",
    type: "facture",
  },
  {
    id: "7",
    number: "FAC-2026-003",
    client: "M. Moreau",
    amount: 210,
    date: "29/01/2026",
    status: "en_attente",
    type: "facture",
  },
  {
    id: "8",
    number: "FAC-2026-004",
    client: "Mme Martin",
    amount: 175,
    date: "28/01/2026",
    status: "brouillon",
    type: "facture",
  },
]

const statusConfig: Record<DocStatus, { label: string; className: string }> = {
  signe: {
    label: "Signe",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  en_attente: {
    label: "En attente",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  paye: {
    label: "Paye",
    className: "bg-gold/10 text-gold border-gold/20",
  },
  brouillon: {
    label: "Brouillon",
    className: "bg-secondary text-muted-foreground border-onyx-border/40",
  },
  annule: {
    label: "Annule",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
}

function DocCard({ doc }: { doc: Document }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = statusConfig[doc.status]

  return (
    <div className="relative p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/20 transition-colors">
      {/* Top row */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            doc.type === "bc" ? "bg-gold/10" : "bg-emerald-500/10",
          )}>
            {doc.type === "bc" ? (
              <FileText className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
            ) : (
              <Receipt className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
            )}
          </div>
          <div>
            <p className="text-[11px] font-mono text-muted-foreground">{doc.number}</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{doc.client}</p>
          </div>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 -mt-0.5 -mr-1 rounded-lg hover:bg-secondary transition-colors"
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <span className="text-lg font-bold text-gold tabular-nums">
            {new Intl.NumberFormat("fr-FR").format(doc.amount)}&euro;
          </span>
          <span className="text-[10px] text-muted-foreground">{doc.date}</span>
        </div>
        <span className={cn(
          "px-2 py-0.5 text-[10px] font-medium rounded-full border",
          status.className,
        )}>
          {status.label}
        </span>
      </div>

      {/* Quick actions menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute top-12 right-3 z-20 bg-onyx-card border border-onyx-border rounded-xl py-1 shadow-2xl shadow-black/60 min-w-[150px]">
            {[
              { icon: Eye, label: "Voir" },
              { icon: Share2, label: "Partager" },
              { icon: XCircle, label: "Annuler", destructive: true },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs hover:bg-secondary/50 transition-colors",
                  "destructive" in action && action.destructive ? "text-red-400" : "text-foreground",
                )}
              >
                <action.icon className={cn(
                  "h-3.5 w-3.5",
                  "destructive" in action && action.destructive ? "text-red-400" : "text-muted-foreground",
                )} strokeWidth={1.5} />
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function DocumentsTab() {
  const [activeType, setActiveType] = useState<DocType>("bc")
  const [search, setSearch] = useState("")
  const [showBCFlow, setShowBCFlow] = useState(false)

  const filtered = documents.filter(
    (d) =>
      d.type === activeType &&
      (d.number.toLowerCase().includes(search.toLowerCase()) ||
        d.client.toLowerCase().includes(search.toLowerCase())),
  )

  const totalAmount = filtered.reduce((sum, d) => sum + d.amount, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-4">
        <h1 className="text-lg font-bold text-foreground mb-3">Documents</h1>

        {/* Type Tabs */}
        <div className="flex gap-2 mb-3">
          {[
            { id: "bc" as DocType, label: "Bons de Commande", icon: FileText },
            { id: "facture" as DocType, label: "Factures", icon: Receipt },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveType(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium border transition-all duration-200",
                activeType === tab.id
                  ? "bg-gold/15 border-gold/40 text-gold"
                  : "bg-onyx-card border-onyx-border/50 text-muted-foreground hover:border-onyx-border",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Rechercher par numero ou client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/40 transition-colors"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 mb-3">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-onyx-card border border-onyx-border/50">
          <span className="text-[11px] text-muted-foreground">
            {filtered.length} document{filtered.length > 1 ? "s" : ""}
          </span>
          <span className="text-xs font-semibold text-gold tabular-nums">
            Total : {new Intl.NumberFormat("fr-FR").format(totalAmount)}&euro;
          </span>
        </div>
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setShowBCFlow(true)}
        className="fixed bottom-28 right-5 z-30 w-12 h-12 rounded-full bg-gold flex items-center justify-center gold-glow active:scale-95 transition-transform"
      >
        <Plus className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
      </button>

      <CreateBCFlow open={showBCFlow} onClose={() => setShowBCFlow(false)} />

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-20">
        {filtered.length > 0 ? (
          filtered.map((doc) => <DocCard key={doc.id} doc={doc} />)
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center mb-3">
              <Search className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Aucun document</p>
            <p className="text-[11px] text-muted-foreground">Aucun resultat pour cette recherche</p>
          </div>
        )}
      </div>
    </div>
  )
}

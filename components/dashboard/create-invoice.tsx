"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Receipt,
  PlusCircle,
  X,
  ChevronLeft,
  ArrowRight,
  Search,
  Check,
  FileText,
  ChevronDown,
  StickyNote,
  User,
  FilePlus2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { existingClients } from "./data"
import { CreateBCFlow } from "./create-bc"

// ── Types ─────────────────────────────────────────────────────

type InvoiceStep = "choose" | "fromBC" | "newBC" | "libre"

interface BCItem {
  id: string
  number: string
  client: string
  amount: number
  date: string
  trajet?: { depart: string; arrivee: string }
}

interface CreateInvoiceProps {
  open: boolean
  onClose: () => void
}

// ── Unbilled BC data ──────────────────────────────────────────

const unbilledBCs: BCItem[] = [
  {
    id: "bc3",
    number: "BC-2026-003",
    client: "M. Moreau",
    amount: 520,
    date: "04/02/2026",
    trajet: { depart: "Gare de Lyon", arrivee: "Hôtel Plaza Athénée" },
  },
  {
    id: "bc2",
    number: "BC-2026-002",
    client: "Mme Beaumont",
    amount: 180,
    date: "05/02/2026",
    trajet: { depart: "Le Bristol Paris", arrivee: "Opéra Garnier" },
  },
  {
    id: "bc5",
    number: "BC-2026-005",
    client: "Mme Garcia",
    amount: 310,
    date: "03/02/2026",
    trajet: { depart: "7 Rue de Passy", arrivee: "Aéroport Orly, Terminal 1" },
  },
  {
    id: "bc6",
    number: "BC-2026-006",
    client: "M. Petit",
    amount: 145,
    date: "01/02/2026",
    trajet: { depart: "Gare du Nord", arrivee: "22 Rue de la Paix" },
  },
]

// ── Success Toast ─────────────────────────────────────────────

function SuccessToast({ show, onDone }: { show: boolean; onDone: () => void }) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onDone, 2500)
      return () => clearTimeout(t)
    }
  }, [show, onDone])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-onyx-card border border-gold/30 gold-glow-sm shadow-2xl shadow-black/60"
        >
          <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
          </div>
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            Facture générée avec succès
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Bottom Sheet: Choose method ───────────────────────────────

function ChooseInvoiceSheet({
  onFromBC,
  onNewBC,
  onLibre,
  onClose,
}: {
  onFromBC: () => void
  onNewBC: () => void
  onLibre: () => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-full max-w-md bg-background rounded-t-3xl border-t border-x border-onyx-border/50 overflow-hidden"
      >
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
        </div>

        <div className="px-5 pt-4 pb-2">
          <h2 className="text-base font-bold text-foreground">Nouvelle Facture</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Choisissez le type de facturation
          </p>
        </div>

        <div className="px-5 pb-6 space-y-2.5">
          {/* Option 1: Facturer un trajet existant */}
          <button
            onClick={onFromBC}
            className="flex items-center gap-3.5 w-full p-4 rounded-2xl bg-onyx-card border border-gold/20 hover:border-gold/40 hover:bg-gold/5 active:scale-[0.98] transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0 group-hover:bg-gold/20 transition-colors">
              <Receipt className="h-5 w-5 text-gold" strokeWidth={1.5} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors">Facturer un trajet existant</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Convertir un Bon de Commande terminé
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-gold/50 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
          </button>

          {/* Option 2: Facturer un nouveau trajet */}
          <button
            onClick={onNewBC}
            className="flex items-center gap-3.5 w-full p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/30 hover:bg-gold/5 active:scale-[0.98] transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-gold/8 border border-gold/20 flex items-center justify-center shrink-0 group-hover:bg-gold/15 transition-colors">
              <FilePlus2 className="h-5 w-5 text-gold/80 group-hover:text-gold transition-colors" strokeWidth={1.5} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors">Facturer un nouveau trajet</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Créer un Bon de Commande puis facturer
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-gold/50 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
          </button>

          {/* Option 3: Facture Libre */}
          <button
            onClick={onLibre}
            className="flex items-center gap-3.5 w-full p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/30 hover:bg-gold/5 active:scale-[0.98] transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-secondary/60 border border-onyx-border/40 flex items-center justify-center shrink-0 group-hover:bg-gold/10 group-hover:border-gold/20 transition-colors">
              <PlusCircle className="h-5 w-5 text-muted-foreground group-hover:text-gold transition-colors" strokeWidth={1.5} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors">Facture Libre</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Frais annexes : attente, nettoyage, etc.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-gold/50 group-hover:translate-x-0.5 transition-all" strokeWidth={1.5} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── From BC: List unbilled BCs ────────────────────────────────

function FromBCScreen({
  onBack,
  onClose,
  onSuccess,
}: {
  onBack: () => void
  onClose: () => void
  onSuccess: () => void
}) {
  const [search, setSearch] = useState("")
  const [converting, setConverting] = useState<string | null>(null)
  const [tvaRate, setTvaRate] = useState<Record<string, number>>({})

  const filtered = unbilledBCs.filter(
    (bc) =>
      bc.client.toLowerCase().includes(search.toLowerCase()) ||
      bc.number.toLowerCase().includes(search.toLowerCase()),
  )

  function getTva(bcId: string) {
    return tvaRate[bcId] ?? 10
  }

  function handleConvert(bc: BCItem) {
    // Simulate generation
    setConverting(bc.id)
    setTimeout(() => {
      setConverting(null)
      onSuccess()
    }, 600)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed inset-0 z-[70] bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-onyx-border/30">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Facturer un trajet</h1>
          <p className="text-[10px] text-muted-foreground">
            Bons de Commande non facturés
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
        >
          <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Rechercher un BC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/40 transition-colors"
          />
        </div>
      </div>

      {/* BC List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-20">
        {filtered.map((bc) => {
          const rate = getTva(bc.id)
          const tva = (bc.amount * rate) / 100
          const ttc = bc.amount + tva

          return (
            <div
              key={bc.id}
              className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50"
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[11px] font-mono text-muted-foreground">{bc.number}</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{bc.client}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{bc.date}</span>
              </div>

              {/* Trajet */}
              {bc.trajet && (
                <div className="flex items-center gap-2 mb-3 text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[120px]">{bc.trajet.depart}</span>
                  <ArrowRight className="h-3 w-3 text-gold shrink-0" strokeWidth={1.5} />
                  <span className="truncate max-w-[120px]">{bc.trajet.arrivee}</span>
                </div>
              )}

              {/* TVA selector */}
              <div className="flex gap-2 mb-3">
                {[10, 20].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTvaRate((prev) => ({ ...prev, [bc.id]: r }))}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[11px] font-medium border transition-all",
                      rate === r
                        ? "bg-gold/15 border-gold/40 text-gold"
                        : "bg-secondary/30 border-onyx-border/50 text-muted-foreground",
                    )}
                  >
                    TVA {r}% ({r === 10 ? "Transport" : "Standard"})
                  </button>
                ))}
              </div>

              {/* Amount summary */}
              <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-background border border-onyx-border/30">
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <div>HT : {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.amount)} &euro;</div>
                  <div>TVA : {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(tva)} &euro;</div>
                </div>
                <span className="text-lg font-bold text-gold tabular-nums">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(ttc)} &euro;
                </span>
              </div>

              {/* Convert button */}
              <button
                onClick={() => handleConvert(bc)}
                disabled={converting === bc.id}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]",
                  converting === bc.id
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                    : "bg-gold text-primary-foreground hover:bg-gold-light gold-glow-sm",
                )}
              >
                {converting === bc.id ? (
                  <>
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                    Génération...
                  </>
                ) : (
                  <>
                    <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Convertir en Facture
                  </>
                )}
              </button>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Aucun BC en attente</p>
            <p className="text-[11px] text-muted-foreground">
              Tous les Bons de Commande ont été facturés
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Facture Libre: Free-form invoice ──────────────────────────

function FactureLibreForm({
  onBack,
  onClose,
  onSuccess,
}: {
  onBack: () => void
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    clientMode: "existing" as "existing" | "libre",
    clientId: "",
    clientLibre: "",
    objet: "",
    montantHT: "",
    tvaRate: 20,
    notes: "",
  })
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)

  const clientOptions = existingClients.map((c) => ({
    value: c.id,
    label: `${c.title} ${c.name}`,
    sub: c.phone,
  }))

  const selectedClient = clientOptions.find((o) => o.value === form.clientId)

  function update(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const montant = parseFloat(form.montantHT) || 0
  const tva = (montant * form.tvaRate) / 100
  const ttc = montant + tva

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSuccess()
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed inset-0 z-[70] bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-onyx-border/30">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Facture Libre</h1>
          <p className="text-[10px] text-muted-foreground">
            Frais annexes et services complémentaires
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
        >
          <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-5 space-y-6 pb-32">
        {/* Destinataire */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" strokeWidth={1.5} />
            Destinataire
          </p>

          <div className="flex gap-2 mb-3">
            {[
              { id: "existing" as const, label: "Client existant" },
              { id: "libre" as const, label: "Saisie libre" },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => update("clientMode", mode.id)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all",
                  form.clientMode === mode.id
                    ? "bg-gold/15 border-gold/40 text-gold"
                    : "bg-onyx-card border-onyx-border/50 text-muted-foreground",
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {form.clientMode === "existing" ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl bg-onyx-card border text-sm transition-colors text-left",
                  clientDropdownOpen ? "border-gold/40" : "border-onyx-border/50 hover:border-onyx-border",
                )}
              >
                <span className={selectedClient ? "text-foreground" : "text-muted-foreground/50"}>
                  {selectedClient ? selectedClient.label : "Sélectionner un client"}
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", clientDropdownOpen && "rotate-180")}
                  strokeWidth={1.5}
                />
              </button>

              <AnimatePresence>
                {clientDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 z-20 mt-1 py-1 rounded-xl bg-onyx-card border border-onyx-border/50 shadow-2xl shadow-black/60 max-h-48 overflow-y-auto scrollbar-hide"
                  >
                    {clientOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          update("clientId", option.value)
                          setClientDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-secondary/30 transition-colors",
                          form.clientId === option.value && "bg-gold/5",
                        )}
                      >
                        <div>
                          <p className={cn("text-sm", form.clientId === option.value ? "text-gold font-medium" : "text-foreground")}>
                            {option.label}
                          </p>
                          {option.sub && <p className="text-[10px] text-muted-foreground">{option.sub}</p>}
                        </div>
                        {form.clientId === option.value && (
                          <Check className="h-3.5 w-3.5 text-gold shrink-0" strokeWidth={2} />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <input
              type="text"
              placeholder="Nom du destinataire"
              value={form.clientLibre}
              onChange={(e) => update("clientLibre", e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
            />
          )}
        </section>

        {/* Objet */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
            Objet de la facture
          </p>
          <input
            type="text"
            placeholder="Ex : Frais d'attente, supplément nettoyage..."
            value={form.objet}
            onChange={(e) => update("objet", e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
          />
        </section>

        {/* Montant & TVA */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
            Montant et TVA
          </p>

          <div className="relative mb-3">
            <input
              type="number"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={form.montantHT}
              onChange={(e) => update("montantHT", e.target.value)}
              className="w-full px-4 py-3 pr-16 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gold">
              EUR HT
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {[10, 20].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => update("tvaRate", rate)}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-medium border transition-all",
                  form.tvaRate === rate
                    ? "bg-gold/15 border-gold/40 text-gold"
                    : "bg-onyx-card border-onyx-border/50 text-muted-foreground hover:border-onyx-border",
                )}
              >
                {rate}%
                <span className="text-[10px] block mt-0.5 opacity-70">
                  {rate === 10 ? "Transport" : "Standard"}
                </span>
              </button>
            ))}
          </div>

          {/* Live preview */}
          {montant > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-4 rounded-2xl bg-onyx-card border border-gold/20"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2.5">
                Aperçu
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">HT</span>
                  <span className="text-sm text-foreground tabular-nums">
                    {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(montant)} &euro;
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">TVA ({form.tvaRate}%)</span>
                  <span className="text-sm text-foreground tabular-nums">
                    {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(tva)} &euro;
                  </span>
                </div>
                <div className="h-px bg-onyx-border/30 my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">TTC</span>
                  <span className="text-lg font-bold text-gold tabular-nums">
                    {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(ttc)} &euro;
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </section>

        {/* Notes */}
        <section>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" strokeWidth={1.5} />
            Notes complémentaires
          </p>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Informations supplémentaires pour le client..."
            className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors resize-none"
          />
        </section>
      </form>

      {/* Fixed bottom CTA */}
      <div className="px-4 py-4 border-t border-onyx-border/30 bg-background">
        <button
          type="submit"
          onClick={handleSubmit}
          className="w-full py-4 rounded-2xl bg-gold text-primary-foreground font-bold hover:bg-gold-light active:scale-[0.98] transition-all gold-glow flex flex-col items-center justify-center gap-0.5"
        >
          <span className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4" strokeWidth={1.5} />
            Générer la Facture
          </span>
          <span className="text-xs font-medium text-primary-foreground/70">
            (Conforme Factur-X)
          </span>
        </button>
      </div>
    </motion.div>
  )
}

// ── Export: Create Invoice Flow ───────────────────────────────

export function CreateInvoiceFlow({ open, onClose }: CreateInvoiceProps) {
  const [step, setStep] = useState<InvoiceStep>("choose")
  const [showToast, setShowToast] = useState(false)

  function handleClose() {
    setStep("choose")
    onClose()
  }

  function handleSuccess() {
    handleClose()
    setShowToast(true)
  }

  return (
    <>
      <AnimatePresence>
        {open && step === "choose" && (
          <ChooseInvoiceSheet
            key="choose-invoice"
            onFromBC={() => setStep("fromBC")}
            onNewBC={() => setStep("newBC")}
            onLibre={() => setStep("libre")}
            onClose={handleClose}
          />
        )}
        {open && step === "fromBC" && (
          <FromBCScreen
            key="from-bc"
            onBack={() => setStep("choose")}
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        )}
        {open && step === "libre" && (
          <FactureLibreForm
            key="libre"
            onBack={() => setStep("choose")}
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        )}
      </AnimatePresence>

      <CreateBCFlow
        open={open && step === "newBC"}
        onClose={() => {
          setStep("choose")
          handleClose()
        }}
      />

      <SuccessToast show={showToast} onDone={() => setShowToast(false)} />
    </>
  )
}

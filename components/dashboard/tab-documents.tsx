"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Search,
  MoreHorizontal,
  Eye,
  Share2,
  XCircle,
  FileText,
  Receipt,
  Plus,
  ArrowRight,
  X,
  Check,
  Coins,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { usePlan } from "./plan-context"
import { useNav } from "./nav-context"
import { CreateBCFlow } from "./create-bc"

// ── Types ────────────────────────────────────────────────────────

type DocType = "bc" | "facture"
type BCStatus = "signe" | "en_attente" | "brouillon" | "annule"
type InvoiceStatus = "brouillon" | "envoyee" | "payee"

interface BCDocument {
  id: string
  number: string
  client: string
  amount: number
  date: string
  status: BCStatus
  type: "bc"
  trajet?: { depart: string; arrivee: string }
  notes?: string
}

interface InvoiceDocument {
  id: string
  number: string
  client: string
  amount: number
  amountHT: number
  tva: number
  tvaRate: number
  date: string
  echeance: string
  status: InvoiceStatus
  type: "facture"
  bcRef: string
}

type Document = BCDocument | InvoiceDocument

// ── Initial Data ─────────────────────────────────────────────────

const initialBCs: BCDocument[] = [
  {
    id: "bc1",
    number: "BC-2026-001",
    client: "M. Laurent",
    amount: 350,
    date: "06/02/2026",
    status: "signe",
    type: "bc",
    trajet: { depart: "8 Rue de Rivoli, Paris 1er", arrivee: "Aéroport CDG, Terminal 2E" },
    notes: "Accueil pancarte",
  },
  {
    id: "bc2",
    number: "BC-2026-002",
    client: "Mme Beaumont",
    amount: 180,
    date: "05/02/2026",
    status: "en_attente",
    type: "bc",
    trajet: { depart: "Le Bristol Paris", arrivee: "Opéra Garnier" },
  },
  {
    id: "bc3",
    number: "BC-2026-003",
    client: "M. Moreau",
    amount: 520,
    date: "04/02/2026",
    status: "signe",
    type: "bc",
    trajet: { depart: "Gare de Lyon", arrivee: "Hôtel Plaza Athénée" },
    notes: "Siège bébé requis",
  },
  {
    id: "bc4",
    number: "BC-2026-004",
    client: "Mme Dubois",
    amount: 95,
    date: "03/02/2026",
    status: "brouillon",
    type: "bc",
    trajet: { depart: "16 Av. Montaigne", arrivee: "Gare Montparnasse" },
  },
]

const initialInvoices: InvoiceDocument[] = [
  {
    id: "fac1",
    number: "F-2026-001",
    client: "M. Laurent",
    amount: 385,
    amountHT: 350,
    tva: 35,
    tvaRate: 10,
    date: "06/02/2026",
    echeance: "08/03/2026",
    status: "payee",
    type: "facture",
    bcRef: "BC-2026-001",
  },
  {
    id: "fac2",
    number: "F-2026-002",
    client: "Mme Beaumont",
    amount: 704,
    amountHT: 640,
    tva: 64,
    tvaRate: 10,
    date: "31/01/2026",
    echeance: "02/03/2026",
    status: "payee",
    type: "facture",
    bcRef: "BC-2025-048",
  },
  {
    id: "fac3",
    number: "F-2026-003",
    client: "M. Moreau",
    amount: 231,
    amountHT: 210,
    tva: 21,
    tvaRate: 10,
    date: "29/01/2026",
    echeance: "28/02/2026",
    status: "envoyee",
    type: "facture",
    bcRef: "BC-2025-047",
  },
  {
    id: "fac4",
    number: "F-2026-004",
    client: "Mme Martin",
    amount: 192.5,
    amountHT: 175,
    tva: 17.5,
    tvaRate: 10,
    date: "28/01/2026",
    echeance: "27/02/2026",
    status: "brouillon",
    type: "facture",
    bcRef: "BC-2025-046",
  },
]

// ── Status configs ───────────────────────────────────────────────

const bcStatusConfig: Record<BCStatus, { label: string; className: string }> = {
  signe: {
    label: "Signé",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  en_attente: {
    label: "En attente",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  brouillon: {
    label: "Brouillon",
    className: "bg-secondary text-muted-foreground border-onyx-border/40",
  },
  annule: {
    label: "Annulé",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
}

const invoiceStatusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  brouillon: {
    label: "Brouillon",
    className: "bg-secondary text-muted-foreground border-onyx-border/40",
  },
  envoyee: {
    label: "Envoyée",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  payee: {
    label: "Payée",
    className: "bg-gold/10 text-gold border-gold/20",
  },
}

// ── Invoice Detail Modal ─────────────────────────────────────────

function InvoiceDetail({
  invoice,
  onClose,
}: {
  invoice: InvoiceDocument
  onClose: () => void
}) {
  const status = invoiceStatusConfig[invoice.status]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-onyx-border/50 overflow-hidden max-h-[85vh]"
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
        </div>

        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div>
            <h2 className="text-base font-bold text-foreground">{invoice.number}</h2>
            <p className="text-[11px] text-muted-foreground">
              Réf. {invoice.bcRef}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
          >
            <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mx-5 h-px bg-onyx-border/30" />

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Client & Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-onyx-card border border-onyx-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Client</p>
              <p className="text-sm font-medium text-foreground">{invoice.client}</p>
            </div>
            <div className="p-3 rounded-xl bg-onyx-card border border-onyx-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Statut</p>
              <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full border", status.className)}>
                {status.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-onyx-card border border-onyx-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Date émission</p>
              <p className="text-sm font-medium text-foreground">{invoice.date}</p>
            </div>
            <div className="p-3 rounded-xl bg-onyx-card border border-onyx-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Échéance (J+30)</p>
              <p className="text-sm font-medium text-foreground">{invoice.echeance}</p>
            </div>
          </div>

          {/* TVA Detail */}
          <div className="p-4 rounded-2xl bg-onyx-card border border-gold/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">
              Détail TVA
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Montant HT</span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.amountHT)} &euro;
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  TVA ({invoice.tvaRate}%)
                </span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.tva)} &euro;
                </span>
              </div>
              <div className="h-px bg-onyx-border/30 my-1" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Montant TTC</span>
                <span className="text-lg font-bold text-gold tabular-nums">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.amount)} &euro;
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── BC Card ──────────────────────────────────────────────────────

function BCCard({
  doc,
  onInvoice,
}: {
  doc: BCDocument
  onInvoice: (bc: BCDocument) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = bcStatusConfig[doc.status]
  const canInvoice = doc.status === "signe"

  return (
    <div className="relative p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/20 transition-colors">
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
            <FileText className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-bold text-gold tabular-nums">
            {new Intl.NumberFormat("fr-FR").format(doc.amount)}&euro;
          </span>
          <span className="text-[10px] text-muted-foreground">{doc.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full border", status.className)}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Facturer button for signed BCs */}
      {canInvoice && (
        <button
          onClick={() => onInvoice(doc)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-semibold hover:bg-gold/20 active:scale-[0.98] transition-all"
        >
          <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
          Facturer
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </button>
      )}

      {/* Quick actions menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
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
                  action.destructive ? "text-red-400" : "text-foreground",
                )}
              >
                <action.icon
                  className={cn("h-3.5 w-3.5", action.destructive ? "text-red-400" : "text-muted-foreground")}
                  strokeWidth={1.5}
                />
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Invoice Card ─────────────────────────────────────────────────

function InvoiceCard({
  doc,
  onView,
}: {
  doc: InvoiceDocument
  onView: (inv: InvoiceDocument) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = invoiceStatusConfig[doc.status]

  return (
    <div
      className="relative p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/20 transition-colors cursor-pointer"
      onClick={() => onView(doc)}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Receipt className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[11px] font-mono text-muted-foreground">{doc.number}</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{doc.client}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(!menuOpen)
          }}
          className="p-1.5 -mt-0.5 -mr-1 rounded-lg hover:bg-secondary transition-colors"
        >
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* Amount row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-bold text-gold tabular-nums">
            {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(doc.amount)}&euro;
          </span>
          <span className="text-[10px] text-muted-foreground">{doc.date}</span>
        </div>
        <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full border", status.className)}>
          {status.label}
        </span>
      </div>

      {/* TVA summary */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>HT: {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(doc.amountHT)}&euro;</span>
        <span>TVA {doc.tvaRate}%: {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(doc.tva)}&euro;</span>
        <span>Éch. {doc.echeance}</span>
      </div>

      {/* Quick actions menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
          <div className="absolute top-12 right-3 z-20 bg-onyx-card border border-onyx-border rounded-xl py-1 shadow-2xl shadow-black/60 min-w-[150px]">
            {[
              { icon: Eye, label: "Voir détail" },
              { icon: Share2, label: "Envoyer" },
              { icon: Check, label: "Marquer payée" },
            ].map((action) => (
              <button
                key={action.label}
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs text-foreground hover:bg-secondary/50 transition-colors"
              >
                <action.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Generate Invoice Confirmation ────────────────────────────────

function GenerateInvoiceModal({
  bc,
  onConfirm,
  onClose,
}: {
  bc: BCDocument
  onConfirm: (tvaRate: number) => void
  onClose: () => void
}) {
  const [tvaRate, setTvaRate] = useState(10)
  const tva = (bc.amount * tvaRate) / 100
  const ttc = bc.amount + tva

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-full max-w-md bg-background rounded-t-3xl sm:rounded-3xl border border-onyx-border/50 overflow-hidden"
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
        </div>

        <div className="px-5 pt-4 pb-3">
          <h2 className="text-base font-bold text-foreground">Générer la Facture</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            À partir du {bc.number}
          </p>
        </div>

        <div className="mx-5 h-px bg-onyx-border/30" />

        <div className="p-5 space-y-4">
          {/* BC Summary */}
          <div className="p-3 rounded-xl bg-onyx-card border border-onyx-border/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Client</span>
              <span className="text-sm font-medium text-foreground">{bc.client}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Montant HT</span>
              <span className="text-sm font-semibold text-gold">
                {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.amount)} &euro;
              </span>
            </div>
          </div>

          {/* TVA Rate Selector */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Taux de TVA
            </p>
            <div className="flex gap-2">
              {[10, 20].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setTvaRate(rate)}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-medium border transition-all",
                    tvaRate === rate
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
          </div>

          {/* Preview */}
          <div className="p-4 rounded-2xl bg-onyx-card border border-gold/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">
              Aperçu facture
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Montant HT</span>
                <span className="text-sm text-foreground tabular-nums">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.amount)} &euro;
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">TVA ({tvaRate}%)</span>
                <span className="text-sm text-foreground tabular-nums">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(tva)} &euro;
                </span>
              </div>
              <div className="h-px bg-onyx-border/30 my-1" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Total TTC</span>
                <span className="text-lg font-bold text-gold tabular-nums">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(ttc)} &euro;
                </span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Échéance automatique : J+30 à compter de la date d&apos;émission
          </p>

          {/* CTA */}
          <button
            onClick={() => onConfirm(tvaRate)}
            className="w-full py-3.5 rounded-2xl bg-gold text-primary-foreground font-bold hover:bg-gold-light active:scale-[0.98] transition-all gold-glow-sm flex flex-col items-center gap-0.5"
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
    </motion.div>
  )
}

// ── Main Documents Tab ───────────────────────────────────────────

export function DocumentsTab() {
  const [activeType, setActiveType] = useState<DocType>("bc")
  const [search, setSearch] = useState("")
  const [showBCFlow, setShowBCFlow] = useState(false)
  const [invoices, setInvoices] = useState<InvoiceDocument[]>(initialInvoices)
  const [invoicingBC, setInvoicingBC] = useState<BCDocument | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceDocument | null>(null)
  const [showNoTokens, setShowNoTokens] = useState(false)
  const { plan, tokens, spendToken } = usePlan()
  const { openWallet } = useNav()
  const isUnlimited = plan === "DUO" || plan === "TEAM"

  function handleGenerateInvoice(bc: BCDocument, tvaRate: number) {
    // Token gate for SOLO users
    if (!isUnlimited) {
      if (tokens <= 0) {
        setShowNoTokens(true)
        setInvoicingBC(null)
        return
      }
      const ok = spendToken()
      if (!ok) {
        setShowNoTokens(true)
        setInvoicingBC(null)
        return
      }
      toast("Document g\u00e9n\u00e9r\u00e9", {
        description: "1 jeton utilis\u00e9",
        icon: <Coins className="h-4 w-4 text-[#D4AF37]" strokeWidth={1.5} />,
        duration: 2500,
      })
    }
    const tva = (bc.amount * tvaRate) / 100
    const ttc = bc.amount + tva
    const nextNum = invoices.length + 1
    const padded = String(nextNum).padStart(3, "0")

    // Calculate J+30 echeance
    const today = new Date()
    const echeance = new Date(today)
    echeance.setDate(echeance.getDate() + 30)
    const fmtDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`

    const newInvoice: InvoiceDocument = {
      id: `fac-gen-${Date.now()}`,
      number: `F-2026-${padded}`,
      client: bc.client,
      amount: Math.round(ttc * 100) / 100,
      amountHT: bc.amount,
      tva: Math.round(tva * 100) / 100,
      tvaRate,
      date: fmtDate(today),
      echeance: fmtDate(echeance),
      status: "brouillon",
      type: "facture",
      bcRef: bc.number,
    }

    setInvoices((prev) => [newInvoice, ...prev])
    setInvoicingBC(null)
    setActiveType("facture")
  }

  const filteredBCs = initialBCs.filter(
    (d) =>
      d.number.toLowerCase().includes(search.toLowerCase()) ||
      d.client.toLowerCase().includes(search.toLowerCase()),
  )

  const filteredInvoices = invoices.filter(
    (d) =>
      d.number.toLowerCase().includes(search.toLowerCase()) ||
      d.client.toLowerCase().includes(search.toLowerCase()),
  )

  const currentDocs = activeType === "bc" ? filteredBCs : filteredInvoices
  const totalAmount = currentDocs.reduce((sum, d) => sum + d.amount, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-4">
        <h1 className="text-lg font-bold text-foreground mb-3">Bons de CDE & Factures</h1>

        {/* Type Tabs */}
        <div className="flex gap-2 mb-3">
          {[
            { id: "bc" as DocType, label: "Bons de Commande", icon: FileText, count: filteredBCs.length },
            { id: "facture" as DocType, label: "Factures", icon: Receipt, count: filteredInvoices.length },
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
              <span className={cn(
                "ml-0.5 text-[9px] px-1.5 py-0.5 rounded-full",
                activeType === tab.id ? "bg-gold/20 text-gold" : "bg-onyx-border/30 text-muted-foreground"
              )}>
                {tab.count}
              </span>
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
            placeholder="Rechercher par numéro ou client..."
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
            {currentDocs.length} document{currentDocs.length > 1 ? "s" : ""}
          </span>
          <span className="text-xs font-semibold text-gold tabular-nums">
            Total : {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(totalAmount)}&euro;
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
        {currentDocs.length > 0 ? (
          activeType === "bc" ? (
            filteredBCs.map((doc) => (
              <BCCard key={doc.id} doc={doc} onInvoice={(bc) => setInvoicingBC(bc)} />
            ))
          ) : (
            filteredInvoices.map((doc) => (
              <InvoiceCard key={doc.id} doc={doc} onView={(inv) => setViewingInvoice(inv)} />
            ))
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center mb-3">
              <Search className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Aucun document</p>
            <p className="text-[11px] text-muted-foreground">Aucun résultat pour cette recherche</p>
          </div>
        )}
      </div>

      {/* Generate Invoice Modal */}
      <AnimatePresence>
        {invoicingBC && (
          <GenerateInvoiceModal
            bc={invoicingBC}
            onConfirm={(rate) => handleGenerateInvoice(invoicingBC, rate)}
            onClose={() => setInvoicingBC(null)}
          />
        )}
      </AnimatePresence>

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {viewingInvoice && (
          <InvoiceDetail
            invoice={viewingInvoice}
            onClose={() => setViewingInvoice(null)}
          />
        )}
      </AnimatePresence>

      {/* No Tokens Alert */}
      <AnimatePresence>
        {showNoTokens && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80]"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowNoTokens(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-3rem)] max-w-xs rounded-2xl bg-[#141414]/95 backdrop-blur-xl border border-[#D4AF37]/30 shadow-2xl shadow-black/60 p-5"
            >
              <button
                onClick={() => setShowNoTokens(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 flex items-center justify-center hover:bg-[#D4AF37]/20 transition-colors"
                aria-label="Fermer"
              >
                <X className="h-3.5 w-3.5 text-[#D4AF37]" strokeWidth={2.5} />
              </button>

              <div className="flex justify-center mb-3">
                <div className="w-11 h-11 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center">
                  <Coins className="h-5 w-5 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
              </div>

              <p className="text-sm font-semibold text-[#F5F5F5] text-center leading-snug">
                {"R\u00e9serve de jetons \u00e9puis\u00e9e."}
              </p>
              <p className="text-xs text-[#A1A1AA] text-center mt-1.5 leading-relaxed">
                {"Rechargez votre Wallet pour t\u00e9l\u00e9charger ce document."}
              </p>

              <button
                onClick={() => {
                  setShowNoTokens(false)
                  openWallet()
                }}
                className="w-full mt-4 py-2.5 rounded-xl bg-[#D4AF37] text-[#1A1A1A] text-xs font-bold tracking-wide uppercase hover:bg-[#E5C44D] active:scale-[0.97] transition-all"
              >
                Ouvrir la Boutique
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

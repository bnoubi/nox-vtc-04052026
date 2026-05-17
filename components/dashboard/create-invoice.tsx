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
import { useNox } from "./nox-context"
import { type BCDocument, type InvoiceDocument, type Client, type Driver } from "./data"
import { CreateBCFlow } from "./create-bc"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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

// Note: Mock data removed, now using bcs from useNox()

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
                Convertir un Bon de Réservation terminé
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
                Créer un Bon de Réservation puis facturer
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
  const { bcs, invoices, addInvoice, vehicles, clients, enterprise, drivers } = useNox()
  const [search, setSearch] = useState("")
  const [converting, setConverting] = useState<string | null>(null)
  const [tvaRate, setTvaRate] = useState<Record<string, number>>({})

  // Only show BCs that are signed and NOT yet in any invoice
  const unbilledBCs = bcs.filter(bc =>
    (bc.status === "confirme" || bc.status === "termine") && !invoices.some(inv => inv.bcRef === bc.number)
  )

  const filtered = unbilledBCs.filter(
    (bc: BCDocument) =>
      bc.client.toLowerCase().includes(search.toLowerCase()) ||
      bc.number.toLowerCase().includes(search.toLowerCase()),
  )

  function getTva(bcId: string) {
    return tvaRate[bcId] ?? 10
  }

  function handleConvert(bc: BCDocument) {
    setConverting(bc.id)

    const vehicle = vehicles.find(v => v.id === bc.vehicleId)
    const clientRecord = clients.find((c: Client) => c.id === bc.clientId)
    const driverRecord = drivers.find((d: Driver) => d.id === bc.driverId)
    const isFranchise = enterprise?.vatMode === 'franchise'

    setTimeout(() => {
      let amount: number, amountHT: number, tva: number, tvaRateUsed: number
      if (isFranchise) {
        // franchise TVA (art. 293B CGI) : montant HT = TTC, TVA = 0
        amount = bc.amountHT ?? bc.amount
        amountHT = amount
        tva = 0
        tvaRateUsed = 0
      } else if ((bc.tva10Amount ?? 0) > 0 || (bc.tva20Amount ?? 0) > 0) {
        // BC avec split multi-TVA : conserver les montants tels quels
        amount = bc.amount
        amountHT = bc.amountHT ?? bc.amount
        tva = bc.tva ?? Math.round((amount - amountHT) * 100) / 100
        tvaRateUsed = bc.tvaRate ?? 10
      } else {
        const mHT = bc.amountHT ?? bc.amount
        const rate = getTva(bc.id)
        tva = Math.round((mHT * rate) / 100 * 100) / 100
        amount = Math.round((mHT + tva) * 100) / 100
        amountHT = Math.round(mHT * 100) / 100
        tvaRateUsed = rate
      }

      const nextNum = invoices.length + 1
      const padded = String(nextNum).padStart(3, "0")
      const today = new Date()
      const echeance = new Date(today)
      echeance.setDate(echeance.getDate() + 30)
      const fmtDate = (d: Date) =>
        `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`

      const clientAddress = clientRecord?.billingAddress ? {
        rue: clientRecord.billingAddress.rue,
        codePostal: clientRecord.billingAddress.codePostal,
        ville: clientRecord.billingAddress.ville,
        pays: clientRecord.billingAddress.pays,
      } : undefined

      const newInvoice: InvoiceDocument = {
        id: `fac-gen-${Date.now()}`,
        number: `F-2026-${padded}`,
        client: bc.client,
        clientPhone: bc.clientPhone,
        passagerNom: bc.passagerNom,
        passagerTelephone: bc.passagerTelephone,
        amount,
        amountHT,
        tva,
        tvaRate: tvaRateUsed,
        baseHT: bc.baseHT,
        tva10Amount: isFranchise ? 0 : bc.tva10Amount,
        tva20Amount: isFranchise ? 0 : bc.tva20Amount,
        supplementsHT: bc.supplementsHT,
        supplementsList: bc.supplementsList,
        discountValue: bc.discountValue,
        discountType: bc.discountType,
        originalHT: bc.originalHT,
        originalTTC: bc.originalTTC,
        date: fmtDate(today),
        echeance: fmtDate(echeance),
        status: "brouillon",
        type: "facture",
        bcRef: bc.number,
        trajet: bc.trajet,
        driverName: bc.driverName,
        driverPhone: driverRecord?.phone ?? bc.driverPhone,
        driverCarteVTC: bc.driverCarteVTC,
        vehicleId: bc.vehicleId,
        vehicleName: bc.vehicleName,
        vehiclePlate: bc.vehiclePlate,
        vehicleTypeEnergie: vehicle?.type_energie,
        clientType: clientRecord?.type,
        clientSiren: clientRecord?.siren,
        clientTvaIntra: clientRecord?.tvaIntra ?? null,
        clientRaisonSociale: clientRecord?.raisonSociale ?? null,
        clientAddress,
        notes: bc.notes,
        cgvText: bc.cgvText,
      }

      addInvoice(newInvoice)
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
            Bons de Réservation non facturés
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
                    onClick={() => setTvaRate((prev: Record<string, number>) => ({ ...prev, [bc.id]: r }))}
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
            <p className="text-sm font-medium text-foreground mb-1">Aucun BR en attente</p>
            <p className="text-[11px] text-muted-foreground">
              Tous les Bons de Réservation ont été facturés
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
  const { clients, invoices, addInvoice } = useNox()
  const [form, setForm] = useState({
    clientMode: "existing" as "existing" | "libre",
    clientId: "",
    clientLibre: "",
    objet: "",
    notes: "",
  })
  
  const [items, setItems] = useState([{ id: `item-${Date.now()}`, designation: "", amountHT: "", tvaRate: 20 }])
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent")

  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)

  const clientOptions = clients.map((c: Client) => ({
    value: c.id,
    label: (c.type === "particulier" ? `${c.prenom} ${c.nom}` : c.raisonSociale) ?? "Client Inconnu",
    sub: c.phone,
  }))

  const selectedClient = clientOptions.find((o: { value: string; label: string }) => o.value === form.clientId)

  function update(field: string, value: string | number) {
    setForm((prev: any) => ({ ...prev, [field]: value }))
  }

  const addItem = () => setItems([...items, { id: `item-${Date.now()}`, designation: "", amountHT: "", tvaRate: 20 }])
  const removeItem = (id: string) => setItems(items.filter(i => i.id !== id))
  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  // Calculations
  const subtotalHT = items.reduce((sum, item) => sum + (parseFloat(item.amountHT as string) || 0), 0)
  let discountAmount = 0
  if (discountValue > 0) {
    discountAmount = discountType === "percent" ? subtotalHT * (discountValue / 100) : discountValue
  }
  const discountRatio = subtotalHT > 0 ? discountAmount / subtotalHT : 0

  let tva10Amount = 0
  let tva20Amount = 0
  let tva55Amount = 0

  items.forEach(item => {
    const discountedHT = (parseFloat(item.amountHT as string) || 0) * (1 - discountRatio)
    if (item.tvaRate === 10) tva10Amount += discountedHT
    else if (item.tvaRate === 20) tva20Amount += discountedHT
    else if (item.tvaRate === 5.5) tva55Amount += discountedHT
  })

  const totalHT = tva10Amount + tva20Amount + tva55Amount
  const tva10 = tva10Amount * 0.10
  const tva20 = tva20Amount * 0.20
  const tva55 = tva55Amount * 0.055
  const tvaTotal = tva10 + tva20 + tva55
  const totalTTC = totalHT + tvaTotal
  
  const originalTTC = items.reduce((sum, item) => sum + ((parseFloat(item.amountHT as string) || 0) * (1 + item.tvaRate / 100)), 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.clientMode === "existing" && !form.clientId) {
      toast.error("Veuillez sélectionner un client")
      return
    }
    if (form.clientMode === "libre" && !form.clientLibre) {
      toast.error("Veuillez saisir le nom du client")
      return
    }
    if (items.some(i => !i.designation || !i.amountHT)) {
      toast.error("Toutes les lignes doivent avoir une désignation et un montant")
      return
    }

    const nextNum = invoices.length + 1
    const padded = String(nextNum).padStart(3, "0")
    const today = new Date()
    const echeance = new Date(today)
    echeance.setDate(echeance.getDate() + 30)
    const fmtDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`

    const clientName = form.clientMode === "existing" 
      ? clientOptions.find(o => o.value === form.clientId)?.label ?? "Inconnu"
      : form.clientLibre

    const formattedItems = items.map(i => ({
      id: i.id,
      designation: i.designation,
      amountHT: parseFloat(i.amountHT as string) || 0,
      tvaRate: i.tvaRate
    }))

    const newInvoice: InvoiceDocument = {
      id: `fac-libre-${Date.now()}`,
      number: `F-2026-${padded}`,
      client: clientName,
      amount: Math.round(totalTTC * 100) / 100,
      amountHT: Math.round(totalHT * 100) / 100,
      tva: Math.round(tvaTotal * 100) / 100,
      date: fmtDate(today),
      echeance: fmtDate(echeance),
      status: "brouillon",
      type: "facture",
      bcRef: form.objet || "Facture Libre",
      notes: form.notes,
      
      items: formattedItems,
      discountValue: discountValue > 0 ? discountValue : undefined,
      discountType: discountValue > 0 ? discountType : undefined,
      originalHT: subtotalHT,
      originalTTC: originalTTC,
      tva10Amount: tva10Amount > 0 ? tva10 : undefined,
      tva20Amount: tva20Amount > 0 ? tva20 : undefined,
      tva55Amount: tva55Amount > 0 ? tva55 : undefined,
    }

    addInvoice(newInvoice)
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

        {/* Lignes de Facture */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
              Détail des Prestations
            </p>
          </div>
          
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="p-3 bg-[#242424] border border-onyx-border/30 rounded-xl relative group">
                <input
                  type="text"
                  placeholder="Désignation (ex: Supplément attente, etc.)"
                  value={item.designation}
                  onChange={e => updateItem(item.id, "designation", e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none mb-3"
                />
                <div className="flex gap-2">
                   <div className="relative flex-1">
                      <input
                        type="number"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        value={item.amountHT}
                        onChange={(e) => updateItem(item.id, "amountHT", e.target.value)}
                        className="w-full px-3 py-2 pr-10 rounded-lg bg-black text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border focus:border-gold border border-onyx-border/50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">EUR HT</span>
                   </div>
                   <select 
                     value={item.tvaRate} 
                     onChange={e => updateItem(item.id, "tvaRate", Number(e.target.value))}
                     className="px-3 py-2 rounded-lg bg-black text-sm text-foreground border border-onyx-border/50 focus:outline-none focus:border-gold"
                   >
                     <option value={20}>20% (Standard)</option>
                     <option value={10}>10% (Transport)</option>
                     <option value={5.5}>5.5% (Autre)</option>
                   </select>
                </div>
                {items.length > 1 && (
                  <button 
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 w-full py-2 rounded-xl text-xs font-semibold text-muted-foreground border border-dashed border-onyx-border hover:text-foreground hover:border-onyx-border/80 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Ajouter une ligne
          </button>
        </section>

        {/* Remise & Notes */}
        <section className="space-y-4">
           <div className="space-y-2">
             <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Remise commerciale</label>
             <div className="flex gap-2">
               <div className="flex-1 flex items-center gap-2">
                 <input type="number" inputMode="decimal" value={discountValue || ""} onChange={e => setDiscountValue(Number(e.target.value) || 0)} placeholder="0"
                   className="flex-1 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground focus:outline-none focus:border-gold/50" style={{ fontSize: "16px" }} />
               </div>
               <div className="flex">
                 <button type="button" onClick={() => setDiscountType("percent")}
                   className={cn("px-3 py-2 rounded-l-xl text-xs font-semibold", discountType === "percent" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground border border-onyx-border/30")}>%</button>
                 <button type="button" onClick={() => setDiscountType("amount")}
                   className={cn("px-3 py-2 rounded-r-xl text-xs font-semibold", discountType === "amount" ? "bg-gold text-black" : "bg-[#242424] text-muted-foreground border border-onyx-border/30")}>€</button>
               </div>
             </div>
           </div>

          <div>
             <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
               <StickyNote className="h-3.5 w-3.5" strokeWidth={1.5} />
               Référence et notes
             </p>
             <input
               type="text"
               value={form.objet}
               onChange={(e) => update("objet", e.target.value)}
               placeholder="Référence (ex: Prestation ponctuelle)"
               className="w-full px-4 py-2 mb-2 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40"
             />
             <textarea
               rows={2}
               value={form.notes}
               onChange={(e) => update("notes", e.target.value)}
               placeholder="Informations supplémentaires pour le client..."
               className="w-full px-4 py-2 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 resize-none"
             />
          </div>
        </section>

        {/* Live preview */}
        {subtotalHT > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="p-4 rounded-2xl bg-onyx-card border border-gold/20 space-y-1.5"
          >
             <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2.5">
               Total Aperçu
             </p>
             <div className="flex items-center justify-between text-xs">
               <span className="text-muted-foreground">Base HT</span>
               <span className="text-foreground">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(subtotalHT)} &euro;</span>
             </div>
             {discountAmount > 0 && (
               <div className="flex items-center justify-between text-xs">
                 <span className="text-red-400">Remise</span>
                 <span className="text-red-400">-{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(discountAmount)} &euro;</span>
               </div>
             )}
             <div className="h-px bg-onyx-border/30 my-1" />
             <div className="flex items-center justify-between text-xs">
               <span className="text-muted-foreground">Total HT</span>
               <span className="text-foreground font-medium">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(totalHT)} &euro;</span>
             </div>
             {tva10Amount > 0 && (
               <div className="flex items-center justify-between text-xs">
                 <span className="text-muted-foreground">TVA (10%)</span>
                 <span className="text-foreground">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(tva10)} &euro;</span>
               </div>
             )}
             {tva20Amount > 0 && (
               <div className="flex items-center justify-between text-xs">
                 <span className="text-muted-foreground">TVA (20%)</span>
                 <span className="text-foreground">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(tva20)} &euro;</span>
               </div>
             )}
             {tva55Amount > 0 && (
               <div className="flex items-center justify-between text-xs">
                 <span className="text-muted-foreground">TVA (5.5%)</span>
                 <span className="text-foreground">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(tva55)} &euro;</span>
               </div>
             )}
             <div className="h-px bg-onyx-border/30 my-1" />
             <div className="flex items-center justify-between">
               <span className="text-xs font-semibold text-foreground">TOTAL TTC</span>
               {discountAmount > 0 ? (
                 <div className="text-right">
                   <span className="text-muted-foreground line-through text-xs mr-2">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(originalTTC)} &euro;</span>
                   <span className="text-lg font-bold text-gold">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(totalTTC)} &euro;</span>
                 </div>
               ) : (
                 <span className="text-lg font-bold text-gold">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(totalTTC)} &euro;</span>
               )}
             </div>
          </motion.div>
        )}
      </form>

      {/* Fixed bottom CTA */}
      <div className="px-4 py-4 border-t border-onyx-border/30 bg-background">
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-4 rounded-2xl bg-gold text-primary-foreground font-bold hover:bg-gold-light active:scale-[0.98] transition-all gold-glow flex flex-col items-center justify-center gap-0.5"
        >
          <span className="flex items-center gap-2 text-sm">
            <Receipt className="h-4 w-4" strokeWidth={1.5} />
            Générer la Facture
          </span>
          <span className="text-xs font-medium text-primary-foreground/80">
            {items.length} ligne(s) • Conforme Factur-X
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
            onFromBC={() => setStep("fromBC")}
            onNewBC={() => setStep("newBC")}
            onLibre={() => setStep("libre")}
            onClose={handleClose}
          />
        )}
        {open && step === "fromBC" && (
          <FromBCScreen
            onBack={() => setStep("choose")}
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        )}
        {open && step === "libre" && (
          <FactureLibreForm
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

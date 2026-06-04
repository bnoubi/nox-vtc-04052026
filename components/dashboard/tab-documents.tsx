"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
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
  Mail,
  CheckCircle2,
  Copy,
  Play,
  Flag,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useNav } from "./nav-context"
import { WalletDrawer } from "./wallet-drawer"
import { CreateBCFlow } from "./create-bc"
import { RecurringScreen } from "./recurring-screen"
import { TripRequestsScreen } from "./trip-requests-screen"
import { useNox, type TripRequest } from "./nox-context"
import { type BCDocument, type InvoiceDocument, type BCStatus, type InvoiceStatus, type EnterpriseProfile } from "./data"
import { generateInvoicePDF, generateBCPDF, generateBCPDFBlob } from "@/lib/pdf-generator"
import { convertBCToInvoice } from "@/lib/convert-bc-to-invoice"
import { createClient } from "@/lib/supabase/client"

type DocType = "bc" | "facture"
type BCFilter = "tous" | "brouillon" | "en_attente" | "confirme" | "en_cours" | "termine" | "annule" | "converti"


// ── Status configs ───────────────────────────────────────────────

// FEATURE 4 — Cycle de vie complet + couleurs sémantiques
const bcStatusConfig: Record<BCStatus, { label: string; className: string }> = {
  brouillon: {
    label: "Brouillon",
    className: "bg-secondary text-muted-foreground border-onyx-border/40",
  },
  en_attente: {
    label: "En attente",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  confirme: {
    label: "Confirmé",
    className: "bg-gold/10 text-gold border-gold/20",
  },
  en_cours: {
    label: "En cours",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  termine: {
    label: "Terminé",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  annule_client: {
    label: "Annulé (client)",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  annule_chauffeur: {
    label: "Annulé (chauffeur)",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
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

// ── BC Detail Modal ──────────────────────────────────────────────

function BCDetail({
  bc,
  enterprise,
  onClose,
  onShare,
  onInvoice,
  onEdit,
}: {
  bc: BCDocument
  enterprise: EnterpriseProfile
  onClose: () => void
  onShare: (bc: BCDocument) => void
  onInvoice: (bc: BCDocument) => void
  onEdit: (bc: BCDocument) => void
}) {
  const { updateBC, invoices } = useNox()
  const alreadyInvoiced = invoices.some((inv: InvoiceDocument) => inv.bcRef === bc.number)
  const [isLoading, setIsLoading] = useState(false)
  const [showCancelChoice, setShowCancelChoice] = useState(false)
  const status = bcStatusConfig[bc.status] ?? bcStatusConfig.en_attente

  function handleTransition(newStatus: BCStatus, message: string) {
    setIsLoading(true)
    updateBC(bc.id, { status: newStatus })
    toast.success(message)
    setIsLoading(false)
    onClose()
  }

  function handleCancel() {
    handleTransition("annule_client", "Bon de commande annulé")
  }

  function handleDownload() {
    toast.promise(
      new Promise((resolve) => {
        setTimeout(() => {
          generateBCPDF(bc, enterprise)
          resolve(true)
        }, 800)
      }),
      {
        loading: "Préparation du document...",
        success: "Bon de commande prêt !",
        error: "Erreur lors de la génération",
      }
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-background rounded-t-[2.5rem] sm:rounded-[2rem] border border-onyx-border/50 overflow-hidden shadow-2xl"
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-onyx-border/30" />
        </div>

        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("px-2 py-0.5 text-[9px] font-bold rounded-full border uppercase tracking-wider", status.className)}>
                {status.label}
              </span>
              <h2 className="text-sm font-mono text-muted-foreground">{bc.number}</h2>
            </div>
            <h1 className="text-xl font-bold text-foreground">Bon de Commande</h1>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-8 space-y-6 overflow-y-auto max-h-[70vh]">
          <div className="p-5 rounded-3xl bg-onyx-card/50 border border-onyx-border/30 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Client</p>
                <p className="text-sm font-semibold text-foreground">{bc.client}</p>
                {bc.clientPhone && <p className="text-[10px] text-muted-foreground">{bc.clientPhone}</p>}
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Date</p>
                <p className="text-sm font-medium text-foreground">{bc.date}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Chauffeur</p>
                <p className="text-sm font-semibold text-foreground">{bc.driverName ?? "Non spécifié"}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Véhicule</p>
                <p className="text-sm font-medium text-foreground">{bc.vehicleName ?? "Non spécifié"}</p>
              </div>
            </div>

            {bc.trajet && (
              <div className="pt-3 border-t border-onyx-border/20">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-2">Trajet</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2"><span className="text-emerald-500 text-[8px]">●</span><span className="truncate">{bc.trajet.depart}</span></div>
                  <div className="flex items-center gap-2"><span className="text-red-500 text-[8px]">●</span><span className="truncate">{bc.trajet.arrivee}</span></div>
                </div>
                {(bc.trajet.distance || bc.trajet.passengers || bc.trajet.time) && (
                  <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                    {bc.trajet.time && <span>Heure : {bc.trajet.time}</span>}
                    {bc.trajet.distance && <span>{bc.trajet.distance} km</span>}
                    {bc.trajet.passengers && <span>{bc.trajet.passengers} passager(s)</span>}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-onyx-border/20">
              <div className="space-y-1 mb-3">
                 <div className="flex justify-between items-center text-[10px]">
                   <span className="text-muted-foreground">Total HT</span>
                   <span className="text-foreground">{bc.amountHT ? new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.amountHT) : "—"} &euro;</span>
                 </div>
                 {(bc.discountValue ?? 0) > 0 && (
                   <div className="flex justify-between items-center text-[10px]">
                     <span className="text-red-400">Remise ({bc.discountType === "percent" ? `${bc.discountValue}%` : `${bc.discountValue ?? 0}€`})</span>
                     <span className="text-red-400">-{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.discountType === "percent" ? (bc.originalHT || bc.amountHT || 0) * ((bc.discountValue ?? 0) / 100) : (bc.discountValue ?? 0))} &euro;</span>
                   </div>
                 )}
                 {bc.tva10Amount !== undefined && bc.tva10Amount > 0 && (
                   <div className="flex justify-between items-center text-[10px]">
                     <span className="text-muted-foreground">TVA (10%)</span>
                     <span className="text-foreground">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.tva10Amount)} &euro;</span>
                   </div>
                 )}
                 {bc.tva20Amount !== undefined && bc.tva20Amount > 0 && (
                   <div className="flex justify-between items-center text-[10px]">
                     <span className="text-muted-foreground">TVA (20%)</span>
                     <span className="text-foreground">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.tva20Amount)} &euro;</span>
                   </div>
                 )}
                 {bc.tva55Amount !== undefined && bc.tva55Amount > 0 && (
                   <div className="flex justify-between items-center text-[10px]">
                     <span className="text-muted-foreground">TVA (5.5%)</span>
                     <span className="text-foreground">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.tva55Amount)} &euro;</span>
                   </div>
                 )}
                 {(!bc.tva10Amount && !bc.tva20Amount && !bc.tva55Amount) && (
                   <div className="flex justify-between items-center text-[10px]">
                     <span className="text-muted-foreground">TVA ({bc.tvaRate ?? 10}%)</span>
                     <span className="text-foreground">{bc.tva ? new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.tva) : "—"} &euro;</span>
                   </div>
                 )}
              </div>
              <div className="flex justify-between items-end pt-2 border-t border-onyx-border/10">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Total TTC</p>
                  <div>
                    {(bc.discountValue ?? 0) > 0 && (bc.originalTTC ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground line-through mr-2">
                        {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.originalTTC!)} &euro;
                      </span>
                    )}
                    <span className="text-2xl font-black text-gold">
                      {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(bc.amount)} <span className="text-lg">&euro;</span>
                    </span>
                  </div>
                </div>
                <button 
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-[11px] font-bold uppercase tracking-wider hover:bg-gold/20 transition-all flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Télécharger
                </button>
              </div>
            </div>

            {bc.cgvText && (
              <div className="pt-3 border-t border-onyx-border/20">
                <p className="text-[9px] text-muted-foreground/70 uppercase font-black tracking-widest mb-1">Conditions associées</p>
                <div className="text-[9px] text-muted-foreground max-h-16 overflow-y-auto whitespace-pre-wrap scrollbar-hide">
                  {bc.cgvText}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
             <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest ml-1">Actions</p>

             {/* Bouton de transition principal selon le statut */}
             {bc.status === "brouillon" && (
               <button
                 onClick={() => { onEdit(bc); onClose() }}
                 className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-gold/10 border border-gold/30 text-gold text-xs font-semibold hover:bg-gold/20 transition-all"
               >
                 <Pencil className="h-4 w-4" />
                 Reprendre la saisie
               </button>
             )}
             {bc.status === "en_attente" && (
               <button
                 onClick={() => handleTransition("confirme", "Bon de commande confirmé")}
                 disabled={isLoading}
                 className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-gold/10 border border-gold/30 text-gold text-xs font-semibold hover:bg-gold/20 transition-all disabled:opacity-50"
               >
                 <Check className="h-4 w-4" />
                 Confirmer
               </button>
             )}
             {bc.status === "confirme" && !alreadyInvoiced && (
               <button
                 onClick={() => { onInvoice(bc); onClose() }}
                 disabled={isLoading}
                 className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-gold/10 border border-gold/30 text-gold text-xs font-semibold hover:bg-gold/20 transition-all disabled:opacity-50"
               >
                 <Receipt className="h-4 w-4" />
                 Facturer
               </button>
             )}
             {bc.status === "confirme" && alreadyInvoiced && (
               <div className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-onyx-card border border-onyx-border/50 text-muted-foreground text-xs font-semibold opacity-60 cursor-not-allowed">
                 <Receipt className="h-4 w-4" />
                 Facture déjà créée
               </div>
             )}
             {/* DISABLED (workflow simplifié) — pour réactiver, retirer le "false &&" */}
             {false && bc.status === "confirme" && (
               <button
                 onClick={() => handleTransition("en_cours", "Course démarrée")}
                 disabled={isLoading}
                 className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-all disabled:opacity-50"
               >
                 <Play className="h-4 w-4" />
                 Démarrer la course
               </button>
             )}
             {false && bc.status === "en_cours" && (
               <button
                 onClick={() => handleTransition("termine", "Course terminée")}
                 disabled={isLoading}
                 className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all disabled:opacity-50"
               >
                 <Flag className="h-4 w-4" />
                 Terminer la course
               </button>
             )}

             {/* Actions secondaires */}
             {showCancelChoice ? (
               <div className="space-y-2">
                 <p className="text-[10px] text-muted-foreground text-center">Motif d&apos;annulation</p>
                 <div className="grid grid-cols-2 gap-2">
                   <button
                     onClick={() => handleTransition("annule_client", "BC annulé — client")}
                     disabled={isLoading}
                     className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all disabled:opacity-50"
                   >
                     <X className="h-4 w-4" />
                     Client
                   </button>
                   <button
                     onClick={() => handleTransition("annule_chauffeur", "BC annulé — chauffeur")}
                     disabled={isLoading}
                     className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-all disabled:opacity-50"
                   >
                     <XCircle className="h-4 w-4" />
                     Chauffeur
                   </button>
                 </div>
                 <button
                   onClick={() => setShowCancelChoice(false)}
                   className="w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1"
                 >
                   Retour
                 </button>
               </div>
             ) : (
               <div className="grid grid-cols-2 gap-3">
                 <button
                   onClick={() => setShowCancelChoice(true)}
                   disabled={isLoading || bc.status === "annule_client" || bc.status === "annule_chauffeur"}
                   className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-secondary/50 border border-onyx-border/50 text-xs font-semibold text-foreground hover:bg-secondary transition-all disabled:opacity-50"
                 >
                   <X className="h-4 w-4" />
                   Annuler
                 </button>
                 <button
                   onClick={() => onShare(bc)}
                   disabled={isLoading}
                   className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-secondary/50 border border-onyx-border/50 text-xs font-semibold text-foreground hover:bg-secondary transition-all disabled:opacity-50"
                 >
                   <Share2 className="h-4 w-4" />
                   Partager
                 </button>
               </div>
             )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function InvoiceDetail({
  invoice,
  enterprise,
  onClose,
}: {
  invoice: InvoiceDocument
  enterprise: EnterpriseProfile
  onClose: () => void
}) {
  const { updateInvoice } = useNox()
  const status = invoiceStatusConfig[invoice.status]

  function handleMarkAsPaid() {
    updateInvoice(invoice.id, { status: "payee" })
    toast.success("Facture marquée comme payée")
  }

  function handleSend() {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: "Envoi de la facture par e-mail...",
        success: "Facture envoyée avec succès à " + invoice.client,
        error: "Échec de l'envoi",
      }
    )
    if (invoice.status === "brouillon") {
      updateInvoice(invoice.id, { status: "envoyee" })
    }
  }

  function handleDownload() {
    toast.promise(
      new Promise((resolve) => {
        setTimeout(() => {
          generateInvoicePDF(invoice, enterprise)
          resolve(true)
        }, 1000)
      }),
      {
        loading: "Génération du PDF...",
        success: "Facture téléchargée !",
        error: "Échec du téléchargement",
      }
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-background rounded-t-[2.5rem] sm:rounded-[2rem] border border-onyx-border/50 overflow-hidden shadow-2xl"
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-onyx-border/30" />
        </div>

        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("px-2 py-0.5 text-[9px] font-bold rounded-full border uppercase tracking-wider", status.className)}>
                {status.label}
              </span>
              <h2 className="text-sm font-mono text-muted-foreground">{invoice.number}</h2>
            </div>
            <h1 className="text-xl font-bold text-foreground">Facture</h1>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-8 space-y-6 overflow-y-auto max-h-[75vh]">
          <div className="p-6 rounded-[2rem] bg-gradient-to-br from-onyx-card to-onyx-card/40 border border-onyx-border/30 space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Destinataire</p>
                <p className="text-base font-bold text-foreground leading-tight">{invoice.client}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Réf: {invoice.bcRef}</p>
              </div>
              <div className="text-right space-y-1.5">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Échéance</p>
                <p className="text-sm font-bold text-foreground tracking-wide">{invoice.echeance}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] mt-3">Date</p>
                <p className="text-sm font-medium text-foreground tracking-wide">{invoice.date}</p>
              </div>
            </div>

            {(invoice.driverName || invoice.vehicleName || invoice.trajet) && (
              <div className="pt-4 border-t border-onyx-border/20 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {invoice.driverName && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Chauffeur</p>
                      <p className="text-sm font-semibold text-foreground">{invoice.driverName}</p>
                    </div>
                  )}
                  {invoice.vehicleName && (
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Véhicule</p>
                      <p className="text-sm font-medium text-foreground">{invoice.vehicleName}</p>
                    </div>
                  )}
                </div>

                {invoice.trajet && (
                  <div className="pt-3 border-t border-onyx-border/10">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-2">Trajet</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2"><span className="text-emerald-500 text-[8px]">●</span><span className="truncate">{invoice.trajet.depart}</span></div>
                      <div className="flex items-center gap-2"><span className="text-red-500 text-[8px]">●</span><span className="truncate">{invoice.trajet.arrivee}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 pt-6 border-t border-onyx-border/20">
               <div className="flex justify-between items-center text-[11px]">
                 <span className="text-muted-foreground font-medium uppercase tracking-wider">Montant HT</span>
                 <span className="text-foreground font-semibold tabular-nums">{invoice.amountHT ? new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.amountHT) : "—"} &euro;</span>
               </div>
               {(invoice.discountValue ?? 0) > 0 && (
                 <div className="flex justify-between items-center text-[11px]">
                   <span className="text-red-400 font-medium uppercase tracking-wider">Remise</span>
                   <span className="text-red-400 font-semibold tabular-nums">-{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.discountType === "percent" ? (invoice.originalHT || invoice.amountHT || 0) * ((invoice.discountValue ?? 0) / 100) : (invoice.discountValue ?? 0))} &euro;</span>
                 </div>
               )}
               {invoice.tva10Amount !== undefined && invoice.tva10Amount > 0 && (
                 <div className="flex justify-between items-center text-[11px]">
                   <span className="text-muted-foreground font-medium uppercase tracking-wider">TVA (10%)</span>
                   <span className="text-foreground font-semibold tabular-nums">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.tva10Amount)} &euro;</span>
                 </div>
               )}
               {invoice.tva20Amount !== undefined && invoice.tva20Amount > 0 && (
                 <div className="flex justify-between items-center text-[11px]">
                   <span className="text-muted-foreground font-medium uppercase tracking-wider">TVA (20%)</span>
                   <span className="text-foreground font-semibold tabular-nums">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.tva20Amount)} &euro;</span>
                 </div>
               )}
               {invoice.tva55Amount !== undefined && invoice.tva55Amount > 0 && (
                 <div className="flex justify-between items-center text-[11px]">
                   <span className="text-muted-foreground font-medium uppercase tracking-wider">TVA (5.5%)</span>
                   <span className="text-foreground font-semibold tabular-nums">{new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.tva55Amount)} &euro;</span>
                 </div>
               )}
               {(!invoice.tva10Amount && !invoice.tva20Amount && !invoice.tva55Amount) && (
                 <div className="flex justify-between items-center text-[11px]">
                   <span className="text-muted-foreground font-medium uppercase tracking-wider">TVA ({invoice.tvaRate ?? 10}%)</span>
                   <span className="text-foreground font-semibold tabular-nums">{invoice.tva ? new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.tva) : "—"} &euro;</span>
                 </div>
               )}
               <div className="pt-4 border-t border-onyx-border/10 flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Total TTC</p>
                    <div>
                      {invoice.discountValue && invoice.originalTTC && invoice.discountValue > 0 && (
                        <span className="text-sm text-muted-foreground line-through mr-2">
                          {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.originalTTC)} &euro;
                        </span>
                      )}
                      <span className="text-3xl font-black text-gold leading-none">
                        {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(invoice.amount)}<span className="text-xl ml-1">&euro;</span>
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gold text-primary-foreground text-xs font-black uppercase tracking-widest gold-glow hover:bg-gold-light active:scale-[0.98] transition-all"
                  >
                    <FileText className="h-4 w-4" />
                    PDF
                  </button>
               </div>
            </div>
            
            {invoice.cgvText && (
              <div className="pt-4 border-t border-onyx-border/20">
                <p className="text-[9px] text-muted-foreground/70 uppercase font-black tracking-widest mb-1">Conditions associées</p>
                <div className="text-[9px] text-muted-foreground max-h-16 overflow-y-auto whitespace-pre-wrap scrollbar-hide">
                  {invoice.cgvText}
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             <button 
               onClick={handleSend}
               disabled={invoice.status === "payee"}
               className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-secondary/40 border border-onyx-border/50 hover:bg-secondary/60 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <Mail className="h-5 w-5 text-muted-foreground group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Envoyer</span>
             </button>
             <button 
               onClick={handleMarkAsPaid}
               disabled={invoice.status === "payee"}
               className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-secondary/40 border border-onyx-border/50 hover:bg-secondary/60 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <CheckCircle2 className="h-5 w-5 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Payée</span>
             </button>
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
  onView,
  onDuplicate,
  onShare,
  isSelected,
  onToggleSelect,
}: {
  doc: BCDocument
  onInvoice: (bc: BCDocument) => void
  onView: (bc: BCDocument) => void
  onDuplicate: (bc: BCDocument) => void
  onShare: (bc: BCDocument) => void
  isSelected: boolean
  onToggleSelect: (id: string) => void
}) {
  const isSelectable = doc.status === "brouillon"
  const { updateBC, invoices } = useNox()
  const [menuOpen, setMenuOpen] = useState(false)
  const status = bcStatusConfig[doc.status] ?? bcStatusConfig.en_attente
  const canInvoice = doc.status === "confirme" || doc.status === "termine"
  const alreadyInvoiced = invoices.some((inv: InvoiceDocument) => inv.bcRef === doc.number)

  const handleAction = (label: string) => {
    setMenuOpen(false)
    if (label === "Annuler") {
      updateBC(doc.id, { status: "annule_client" })
      toast.success("Bon de commande annulé")
    } else if (label === "Confirmer") {
      updateBC(doc.id, { status: "confirme" })
      toast.success("Bon de commande confirmé")
    } else if (label === "Démarrer") {
      updateBC(doc.id, { status: "en_cours" })
      toast.success("Course démarrée")
    } else if (label === "Terminer") {
      updateBC(doc.id, { status: "termine" })
      toast.success("Course terminée")
    } else if (label === "Partager") {
      onShare(doc)
    } else if (label === "Voir") {
      onView(doc)
    } else if (label === "Dupliquer") {
      onDuplicate(doc)
    }
  }

  // DISABLED (workflow simplifié) — pour réactiver, décommenter les deux lignes ci-dessous
  // doc.status === "confirme" ? { icon: Play, label: "Démarrer" } :
  // doc.status === "en_cours" ? { icon: Flag, label: "Terminer" } :
  const transitionAction =
    doc.status === "en_attente" ? { icon: Check, label: "Confirmer" } :
    null

  return (
    <div
      className={cn(
        "relative p-4 rounded-2xl bg-onyx-card border transition-colors cursor-pointer",
        isSelectable && isSelected ? "border-red-500/40 bg-red-500/5" : "border-onyx-border/50 hover:border-gold/20"
      )}
      onClick={() => onView(doc)}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          {isSelectable && (
            <span onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(doc.id)}
                className="shrink-0 border-onyx-border/60 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
              />
            </span>
          )}
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
            <FileText className="h-3.5 w-3.5 text-gold" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[11px] font-mono text-muted-foreground">{doc.number}</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{doc.client}</p>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
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
          onClick={(e) => { e.stopPropagation(); if (!alreadyInvoiced) onInvoice(doc) }}
          disabled={alreadyInvoiced}
          className={cn(
            "mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all",
            alreadyInvoiced
              ? "bg-onyx-card border border-onyx-border/50 text-muted-foreground cursor-not-allowed opacity-60"
              : "bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 active:scale-[0.98]"
          )}
        >
          <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
          {alreadyInvoiced ? "Facture déjà créée" : "Facturer"}
          {!alreadyInvoiced && <ArrowRight className="h-3 w-3" strokeWidth={1.5} />}
        </button>
      )}

      {/* CTA brouillon — Reprendre la saisie */}
      {doc.status === "brouillon" && (
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(doc) }}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 active:scale-[0.98] transition-all"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
          Reprendre la saisie
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </button>
      )}

      {/* CTA en_attente — Confirmer */}
      {doc.status === "en_attente" && (
        <button
          onClick={(e) => { e.stopPropagation(); updateBC(doc.id, { status: "confirme" }); toast.success("Bon de commande confirmé") }}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 active:scale-[0.98] transition-all"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
          Confirmer
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
        </button>
      )}

      {/* Quick actions menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
          <div className="absolute top-12 right-3 z-20 bg-onyx-card border border-onyx-border rounded-xl py-1 shadow-2xl shadow-black/60 min-w-[150px]">
            {[
              ...(transitionAction ? [{ icon: transitionAction.icon, label: transitionAction.label, highlight: true }] : []),
              { icon: Eye, label: "Voir" },
              { icon: Share2, label: "Partager" },
              { icon: Copy, label: "Dupliquer" },
              { icon: XCircle, label: "Annuler", destructive: true },
            ].map((action) => (
              <button
                key={action.label}
                onClick={(e) => { e.stopPropagation(); handleAction(action.label) }}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3.5 py-2.5 text-xs hover:bg-secondary/50 transition-colors",
                  action.destructive ? "text-red-400" : action.highlight ? "text-gold font-semibold" : "text-foreground",
                )}
              >
                <action.icon
                  className={cn("h-3.5 w-3.5", action.destructive ? "text-red-400" : action.highlight ? "text-gold" : "text-muted-foreground")}
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
  const { updateInvoice } = useNox()
  const [menuOpen, setMenuOpen] = useState(false)
  const status = invoiceStatusConfig[doc.status]

  const handleAction = (label: string) => {
    setMenuOpen(false)
    if (label === "Marquer payée") {
      updateInvoice(doc.id, { status: "payee" })
      toast.success("Facture marquée comme payée")
    } else if (label === "Envoyer") {
      toast.success("Facture envoyée au client")
    }
  }

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
        <span>HT: {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(doc.amountHT || 0)}&euro;</span>
        <span>TVA {doc.tvaRate ?? 10}%: {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(doc.tva || 0)}&euro;</span>
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
                  handleAction(action.label)
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
  const { bcs, invoices, enterprise, plan, tokens, spendToken, deleteBC, refreshInvoices, tripRequests, loadTripRequests, clients, addClient } = useNox()
  const supabase = createClient()
  const [activeType, setActiveType] = useState<DocType>("bc")
  const [search, setSearch] = useState("")
  const [bcStatusFilter, setBcStatusFilter] = useState<BCFilter>("tous")
  const [selectedBCIds, setSelectedBCIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showBCFlow, setShowBCFlow] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [duplicateBC, setDuplicateBC] = useState<BCDocument | null>(null)
  const [invoicingBC, setInvoicingBC] = useState<BCDocument | null>(null)
  const [viewingBC, setViewingBC] = useState<BCDocument | null>(null)
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceDocument | null>(null)
  const [showNoTokens, setShowNoTokens] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [convertingRequest, setConvertingRequest] = useState<TripRequest | null>(null)
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [addingClient, setAddingClient] = useState(false)
  const [pendingPrefillBC, setPendingPrefillBC] = useState<BCDocument | null>(null)
  const [showTripRequests, setShowTripRequests] = useState(false)
  const [openBCFlowOnLink, setOpenBCFlowOnLink] = useState(false)
  const bcIdsBeforeRef = useRef<Set<string>>(new Set())
  const convertingRequestRef = useRef<TripRequest | null>(null)
  const { pendingBcId, clearPendingBcId } = useNav()

  useEffect(() => {
    if (!pendingBcId) return
    const bc = bcs.find((b) => b.id === pendingBcId)
    if (bc) { setViewingBC(bc); setActiveType("bc") }
    clearPendingBcId()
  }, [pendingBcId, bcs, clearPendingBcId])

  useEffect(() => {
    void loadTripRequests()
  }, [loadTripRequests])

  useEffect(() => {
    const req = convertingRequestRef.current
    if (!req) return
    const newBC = bcs.find(b => !bcIdsBeforeRef.current.has(b.id))
    if (!newBC) return
    convertingRequestRef.current = null
    setConvertingRequest(null)
    void (async () => {
      await supabase.from("trip_requests").update({ status: "converted", bc_id: newBC.id }).eq("id", req.id)
      await loadTripRequests()
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bcs])
  const isUnlimited = plan === "DUO" || plan === "TEAM"

  function handleStatusFilterChange(filter: BCFilter) {
    setBcStatusFilter(filter)
    setSelectedBCIds(new Set())
  }

  function toggleBCSelection(id: string) {
    setSelectedBCIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDeleteSelected() {
    setIsDeleting(true)
    const toDelete = Array.from(selectedBCIds).filter(id => {
      const bc = bcs.find(b => b.id === id)
      return bc && bc.status === "brouillon" && !invoices.some(inv => inv.bcRef === bc.number)
    })
    await Promise.all(toDelete.map(id => deleteBC(id)))
    setSelectedBCIds(new Set())
    setShowDeleteConfirm(false)
    setIsDeleting(false)
    toast.success(`${toDelete.length} bon${toDelete.length > 1 ? "s" : ""} supprimé${toDelete.length > 1 ? "s" : ""}`)
  }

  async function handleShareBC(bc: BCDocument) {
    const fileName = `BC_${bc.number}.pdf`
    const loadingId = toast.loading("Préparation du partage...")
    try {
      const blob = await generateBCPDFBlob(bc, enterprise)
      toast.dismiss(loadingId)
      const file = new File([blob], fileName, { type: "application/pdf" })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            title: `Bon de commande ${bc.number}`,
            text: `Bon de commande pour ${bc.client}`,
            files: [file],
          })
          return
        } catch (err) {
          if ((err as Error).name === "AbortError") return
        }
      }
      // Fallback bureau : téléchargement direct
      generateBCPDF(bc, enterprise)
      toast.success("PDF téléchargé — partagez-le depuis vos applications")
    } catch {
      toast.dismiss(loadingId)
      toast.error("Impossible de partager ce document")
    }
  }

  // FEATURE 2 — Ouvrir le formulaire en mode duplication
  function handleDuplicate(bc: BCDocument) {
    setDuplicateBC(bc)
    setShowBCFlow(true)
  }

  function handleConvertRequest(req: TripRequest) {
    if (plan === "SOLO" && tokens <= 0) { setShowNoTokens(true); return }
    const passengerName = [req.passenger_firstname, req.passenger_lastname].filter(Boolean).join(" ")
    const roundToNearest5 = (time: string): string => {
      if (!time) return time
      const clean = time.substring(0, 5)
      const [hours, minutes] = clean.split(":").map(Number)
      const rounded = Math.round(minutes / 5) * 5
      const finalMinutes = rounded === 60 ? 0 : rounded
      const finalHours = rounded === 60 ? (hours + 1) % 24 : hours
      return `${String(finalHours).padStart(2, "0")}:${String(finalMinutes).padStart(2, "0")}`
    }
    const buildPrefill = (clientId?: string): BCDocument => {
      const tripDateTime = req.trip_date && req.trip_time
        ? new Date(`${req.trip_date}T${req.trip_time}`)
        : null
      const isPast = tripDateTime ? tripDateTime < new Date() : false
      if (isPast) {
        toast.warning("La date de la demande de trajet est dépassée. Veuillez choisir une nouvelle date.")
      }
      return {
        id: "", number: "", client: passengerName || "Client", clientId,
        amount: 0, date: new Date().toLocaleDateString("fr-FR"),
        status: "brouillon", type: "bc",
        trajet: {
          depart: req.departure ?? "", arrivee: req.arrival ?? "",
          date: isPast ? "" : (req.trip_date ?? ""),
          time: isPast ? "" : (req.trip_time ? roundToNearest5(req.trip_time) : ""),
          passengers: req.passengers_count, luggage: req.luggage_count,
          stops: req.stops ?? [],
          distance: (req as TripRequest & { estimated_distance?: number }).estimated_distance ?? undefined,
          duree: (req as TripRequest & { estimated_duration?: string }).estimated_duration ?? undefined,
        },
        notes: req.notes ?? undefined,
        passagerNom: passengerName || undefined,
        passagerTelephone: req.passenger_phone ?? undefined,
      }
    }
    const foundClient = clients.find(c =>
      (req.passenger_phone && c.phone && c.phone === req.passenger_phone) ||
      (req.passenger_email && c.email && c.email === req.passenger_email)
    )
    bcIdsBeforeRef.current = new Set(bcs.map(b => b.id))
    setConvertingRequest(req)
    convertingRequestRef.current = req
    if (foundClient) {
      setPendingPrefillBC(buildPrefill(foundClient.id))
      setShowBCFlow(true)
    } else if (passengerName || req.passenger_phone) {
      setPendingPrefillBC(buildPrefill())
      setShowNewClientModal(true)
    } else {
      setPendingPrefillBC(buildPrefill())
      setShowBCFlow(true)
    }
  }

  async function handleGenerateInvoice(bc: BCDocument, tvaRate: number) {
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
      toast("Document généré", {
        description: "1 jeton utilisé",
        icon: <Coins className="h-4 w-4 text-[#D4AF37]" strokeWidth={1.5} />,
        duration: 2500,
      })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const result = await convertBCToInvoice(bc.id, user.id)

    if (!result.success) {
      toast.error("Erreur", {
        description: result.error ?? "Échec création facture",
      })
      setInvoicingBC(null)
      return
    }

    await refreshInvoices()
    setInvoicingBC(null)
    setActiveType("facture")
    toast.success("Facture créée", {
      description: "Visible dans l'onglet Factures",
    })
  }

  const filteredBCs = (() => {
    let list = bcs
    if (bcStatusFilter === "tous") {
      list = list.filter(d => d.status !== "annule_client" && d.status !== "annule_chauffeur")
    } else if (bcStatusFilter === "annule") {
      list = list.filter(d => d.status === "annule_client" || d.status === "annule_chauffeur")
    } else if (bcStatusFilter === "converti") {
      list = list.filter(d => invoices.some((inv: InvoiceDocument) => inv.bcRef === d.number))
    } else {
      list = list.filter(d => d.status === bcStatusFilter)
    }
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(d => d.number.toLowerCase().includes(s) || d.client.toLowerCase().includes(s))
    }
    return list
  })()

  const filteredInvoices = invoices.filter(
    (d: InvoiceDocument) =>
      d.number.toLowerCase().includes(search.toLowerCase()) ||
      d.client.toLowerCase().includes(search.toLowerCase()),
  )

  const currentDocs = activeType === "bc" ? filteredBCs : filteredInvoices
  const totalAmount = currentDocs.reduce((sum, d) => sum + d.amount, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Bandeau solde jetons — Starter uniquement */}
      {plan === "SOLO" && tokens <= 2 && (
        <div className={cn(
          "mx-4 mt-3 mb-1 flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-xs",
          tokens === 0
            ? "bg-red-950/50 border-red-500/30 text-red-300"
            : "bg-orange-950/50 border-orange-500/30 text-orange-300"
        )}>
          <span className="leading-snug">
            {tokens === 0
              ? "🔴 Solde épuisé — Rechargez pour générer vos documents"
              : `⚠️ Il vous reste ${tokens} jeton${tokens > 1 ? "s" : ""} — Pensez à recharger`}
          </span>
          <button
            onClick={() => setWalletOpen(true)}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold uppercase tracking-wide hover:bg-[#D4AF37]/25 transition-colors"
          >
            Recharger
          </button>
        </div>
      )}

      <div className="px-4 pt-2 pb-4">
        <h1 className="text-lg font-bold text-foreground mb-3">Réservations & Factures</h1>

        {/* Type Tabs */}
        <div className="flex gap-2 mb-3">
          {[
            { id: "bc" as DocType, label: "Réservations", icon: FileText, count: filteredBCs.length },
            { id: "facture" as DocType, label: "Factures", icon: Receipt, count: filteredInvoices.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveType(tab.id); setSelectedBCIds(new Set()) }}
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

        {/* Status filter pills — BC only */}
        {activeType === "bc" && (
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 scrollbar-hide">
            {([
              { id: "tous", label: "Tous" },
              { id: "brouillon", label: "Brouillon" },
              { id: "en_attente", label: "En attente" },
              { id: "confirme", label: "Confirmé" },
              { id: "annule", label: "Annulés" },
              { id: "converti", label: "Convertis" },
            ] as { id: BCFilter; label: string }[]).map((pill) => (
              <button
                key={pill.id}
                onClick={() => handleStatusFilterChange(pill.id)}
                className={cn(
                  "shrink-0 px-3 py-1 rounded-full text-[10px] font-semibold border transition-all",
                  bcStatusFilter === pill.id
                    ? "bg-gold/20 border-gold/40 text-gold"
                    : "bg-onyx-card border-onyx-border/40 text-muted-foreground hover:border-onyx-border"
                )}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}
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
        onClick={() => {
          if (plan === "SOLO" && tokens <= 0) { setShowNoTokens(true); return }
          setShowBCFlow(true)
        }}
        className={cn(
          "fixed right-5 z-30 w-12 h-12 rounded-full bg-gold flex items-center justify-center gold-glow active:scale-95 transition-all duration-200",
          selectedBCIds.size > 0 ? "bottom-44" : "bottom-28"
        )}
      >
        <Plus className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
      </button>

      {showBCFlow && (
        <CreateBCFlow
          open={showBCFlow}
          onClose={() => {
            setShowBCFlow(false)
            setDuplicateBC(null)
            setPendingPrefillBC(null)
            setOpenBCFlowOnLink(false)
            convertingRequestRef.current = null
            setConvertingRequest(null)
          }}
          prefillBC={pendingPrefillBC ?? duplicateBC}
          initialStep={openBCFlowOnLink ? "link" : undefined}
          onNavigateToRecurring={() => {
            setShowBCFlow(false)
            setShowRecurring(true)
          }}
          onNavigateToTripRequests={() => {
            setShowBCFlow(false)
            setShowTripRequests(true)
          }}
        />
      )}

      {showRecurring && (
        <div className="absolute inset-0 z-50 bg-background overflow-y-auto">
          <RecurringScreen onBack={() => setShowRecurring(false)} />
        </div>
      )}

      {showTripRequests && createPortal(
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <TripRequestsScreen
            onBack={() => setShowTripRequests(false)}
            onConvertRequest={(req) => {
              setShowTripRequests(false)
              handleConvertRequest(req)
            }}
            onCreateNew={() => {
              setShowTripRequests(false)
              setOpenBCFlowOnLink(true)
              setShowBCFlow(true)
            }}
          />
        </div>,
        document.body
      )}

      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-20">
        {currentDocs.length > 0 ? (
          activeType === "bc" ? (
            filteredBCs.map((doc: BCDocument) => (
              <BCCard key={doc.id} doc={doc} onInvoice={(bc: BCDocument) => setInvoicingBC(bc)} onView={(bc: BCDocument) => setViewingBC(bc)} onDuplicate={handleDuplicate} onShare={handleShareBC} isSelected={selectedBCIds.has(doc.id)} onToggleSelect={toggleBCSelection} />
            ))
          ) : (
            filteredInvoices.map((doc: InvoiceDocument) => (
              <InvoiceCard key={doc.id} doc={doc} onView={(inv: InvoiceDocument) => setViewingInvoice(inv)} />
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

      {/* BC Detail Modal */}
      <AnimatePresence mode="wait">
        {viewingBC && (
          <BCDetail
            bc={viewingBC}
            enterprise={enterprise}
            onClose={() => setViewingBC(null)}
            onShare={handleShareBC}
            onInvoice={(bc: BCDocument) => { setViewingBC(null); setInvoicingBC(bc) }}
            onEdit={(bc: BCDocument) => { setViewingBC(null); setDuplicateBC(bc); setShowBCFlow(true) }}
          />
        )}
      </AnimatePresence>

      {/* Invoice Detail Modal */}
      <AnimatePresence mode="wait">
        {viewingInvoice && (
          <InvoiceDetail
            invoice={viewingInvoice}
            enterprise={enterprise}
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
            className="fixed inset-0 z-[80] flex items-center justify-center px-6 bg-black/60"
            onClick={() => setShowNoTokens(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="w-full max-w-sm rounded-2xl bg-[#1A1A1A] border border-[#D4AF37]/30 shadow-2xl shadow-black/60 p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center mb-4">
                <div className="w-11 h-11 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 flex items-center justify-center">
                  <Coins className="h-5 w-5 text-[#D4AF37]" strokeWidth={1.5} />
                </div>
              </div>

              <p className="text-sm font-semibold text-[#F5F5F5] leading-snug">
                Solde insuffisant
              </p>
              <p className="text-xs text-[#A1A1AA] mt-2 leading-relaxed">
                Il vous reste 0 jeton.<br />
                Rechargez pour continuer à générer vos documents.
              </p>

              <button
                onClick={() => { setShowNoTokens(false); setWalletOpen(true) }}
                className="w-full mt-5 py-2.5 rounded-xl bg-[#D4AF37] text-[#1A1A1A] text-xs font-bold tracking-wide uppercase hover:bg-[#E5C44D] active:scale-[0.97] transition-all"
              >
                Recharger mes jetons
              </button>
              <button
                onClick={() => setShowNoTokens(false)}
                className="w-full mt-2 py-2 text-xs text-[#A1A1AA] hover:text-[#F5F5F5] transition-colors"
              >
                J&apos;ai compris
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action bar — sélection brouillons */}
      <AnimatePresence>
        {selectedBCIds.size > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-onyx-card border border-red-500/30 shadow-2xl shadow-black/60"
          >
            <span className="text-sm font-semibold text-foreground">
              {selectedBCIds.size} sélectionné{selectedBCIds.size > 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedBCIds(new Set())}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground bg-secondary/50 hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 active:scale-[0.97] transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Supprimer la sélection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation suppression */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !isDeleting && setShowDeleteConfirm(false)} />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="relative w-full max-w-sm rounded-2xl bg-onyx-card border border-red-500/30 shadow-2xl shadow-black/60 p-5"
            >
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-400" strokeWidth={1.5} />
                </div>
              </div>
              <p className="text-base font-bold text-foreground text-center mb-1">
                Supprimer {selectedBCIds.size} bon{selectedBCIds.size > 1 ? "s" : ""} ?
              </p>
              <p className="text-xs text-muted-foreground text-center leading-relaxed mb-5">
                Cette action est irréversible. Ces bons seront définitivement supprimés.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl bg-secondary/50 border border-onyx-border/50 text-sm font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  {isDeleting ? "Suppression…" : "Confirmer"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Client Detected Modal */}
      {showNewClientModal && convertingRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-5 bg-black/60"
          onClick={() => { setShowNewClientModal(false); setAddingClient(false) }}>
          <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl border border-onyx-border/40 p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <p className="text-base font-bold text-foreground">👤 Nouveau client détecté</p>
            <p className="text-sm text-muted-foreground">
              {[convertingRequest.passenger_firstname, convertingRequest.passenger_lastname].filter(Boolean).join(" ")}
              {convertingRequest.passenger_phone ? ` — ${convertingRequest.passenger_phone}` : ""}
            </p>
            <p className="text-xs text-muted-foreground/70">Voulez-vous l&apos;ajouter à votre carnet clients ?</p>
            <div className="flex gap-3">
              <button
                disabled={addingClient}
                onClick={async () => {
                  setAddingClient(true)
                  try {
                    const req = convertingRequest
                    const newClientId = await addClient({
                      id: "", type: "particulier",
                      civilite: (req.passenger_civility as "M." | "Mme") || "M.",
                      prenom: req.passenger_firstname ?? "", nom: req.passenger_lastname ?? "",
                      phone: req.passenger_phone ?? "", email: req.passenger_email ?? "",
                      billingAddress: { rue: "", codePostal: "", ville: "" },
                      trips: 0, lastTrip: "", notes: "",
                    })
                    setPendingPrefillBC(prev => prev ? { ...prev, clientId: newClientId ?? undefined } : prev)
                    toast.success("✅ Client ajouté au carnet")
                    await new Promise(r => setTimeout(r, 1000))
                    setShowNewClientModal(false)
                    setAddingClient(false)
                    setShowBCFlow(true)
                  } catch {
                    toast.error("Erreur lors de l'ajout du client")
                    setAddingClient(false)
                  }
                }}
                className={cn(
                  "flex-1 py-3 rounded-xl bg-gold text-black text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                  addingClient ? "opacity-60 cursor-not-allowed" : "hover:bg-gold/90"
                )}
              >
                {addingClient ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ajout en cours...
                  </>
                ) : "Ajouter au carnet"}
              </button>
              <button
                disabled={addingClient}
                onClick={() => { setShowNewClientModal(false); setAddingClient(false); setShowBCFlow(true) }}
                className={cn(
                  "flex-1 py-3 rounded-xl bg-[#242424] border border-onyx-border/30 text-muted-foreground text-sm font-semibold transition-colors",
                  addingClient ? "opacity-50 cursor-not-allowed" : "hover:bg-[#2a2a2a]"
                )}
              >
                Ignorer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

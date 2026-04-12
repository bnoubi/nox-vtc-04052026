"use client"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import {
  ChevronLeft,
  SlidersHorizontal,
  PenLine,
  UploadCloud,
  Check,
  Eye,
  Info,
  FileText,
  Trash2,
  FileUp,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useNox } from "./nox-context"
import { 
  CGVMode, 
  CGVConfig, 
  EnterpriseProfile,
  PaymentTiming,
  PaymentMethod,
  CancellationDelay,
  CancellationFee,
  WaitTime,
  WaitFee,
  NoShowFee,
  PaymentDelay
} from "./data"

// Note: Types moved to data.ts for global persistence and reusability

// ── Default Config ────────────────────────────────────────────

const defaultConfig: CGVConfig = {
  paymentTiming: "before",
  paymentMethods: ["cb", "applepay", "googlepay", "paypal", "especes"],
  cancellationDelay: "2h",
  cancellationFee: "50",
  waitTime: "10",
  waitFee: "0.50",
  noShowFee: "50",
  paymentDelay: "comptant",
}

// ── Standard Template ─────────────────────────────────────────

const standardTemplate = `CONDITIONS GÉNÉRALES DE VENTE — NOX VTC

1. RÉSERVATION ET PAIEMENT
Le paiement est exigé avant l'exécution de la prestation.
Moyens de paiement acceptés : Carte Bancaire, Apple Pay, Google Pay, PayPal, Espèces.
Délai de règlement : Comptant.

2. ANNULATION
Annulation gratuite jusqu'à 2 heures avant la prise en charge.
En cas d'annulation tardive (moins de 2h), une indemnité de 50% du montant TTC sera facturée.

3. TEMPS D'ATTENTE
Un temps d'attente gratuit de 10 minutes est accordé à la prise en charge.
Au-delà, un supplément de 0,50 €/minute sera appliqué.

4. CLIENT ABSENT (NO-SHOW)
En cas d'absence du client au point de prise en charge après le délai d'attente, 50% du montant TTC sera facturé.

5. RESPONSABILITÉ
Le transporteur s'engage à assurer la sécurité et le confort du passager pendant toute la durée du trajet.
Le client s'engage à respecter le véhicule et à informer le chauffeur de tout changement d'itinéraire.

Ces conditions sont conformes à la réglementation VTC en vigueur.`

// ── Animation ─────────────────────────────────────────────────

const slideIn = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
}

// ── Sub Components ────────────────────────────────────────────

function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30">
      <button
        onClick={onBack}
        className="w-9 h-9 rounded-xl bg-onyx-card/60 border border-onyx-border/20 flex items-center justify-center hover:bg-onyx-card active:scale-95 transition-all"
      >
        <ChevronLeft className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
      </button>
      <h2 className="text-base font-bold font-heading text-foreground">{title}</h2>
    </div>
  )
}

function PillToggle<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  labels: Record<T, string>
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95",
            value === opt
              ? "bg-gold/20 text-gold border border-gold/50"
              : "bg-onyx-card text-muted-foreground border border-onyx-border/30 hover:border-onyx-border/50"
          )}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  )
}

function CheckboxGrid({
  options,
  selected,
  onChange,
  labels,
}: {
  options: PaymentMethod[]
  selected: PaymentMethod[]
  onChange: (methods: PaymentMethod[]) => void
  labels: Record<PaymentMethod, string>
}) {
  const toggle = (method: PaymentMethod) => {
    if (selected.includes(method)) {
      onChange(selected.filter((m) => m !== method))
    } else {
      onChange([...selected, method])
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-all active:scale-95",
            selected.includes(opt)
              ? "bg-gold/15 text-gold border border-gold/40"
              : "bg-onyx-card text-muted-foreground border border-onyx-border/30 hover:border-onyx-border/50"
          )}
        >
          <div
            className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-all",
              selected.includes(opt) ? "bg-gold border-gold" : "border-onyx-border/50"
            )}
          >
            {selected.includes(opt) && <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />}
          </div>
          {labels[opt]}
        </button>
      ))}
    </div>
  )
}

function SettingRow({
  label,
  children,
  subLabel,
}: {
  label: string
  children: React.ReactNode
  subLabel?: string
}) {
  return (
    <div className="py-4 border-b border-onyx-border/20 last:border-b-0">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {subLabel && <p className="text-[10px] text-muted-foreground mt-0.5">{subLabel}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Helper Functions ──────────────────────────────────────────

function formatDuration(value: string): string {
  const num = parseInt(value)
  if (value.endsWith("h")) {
    return num === 1 ? "1 heure" : `${num} heures`
  }
  return num === 1 ? "1 minute" : `${num} minutes`
}

function getPaymentMethodsText(methods: PaymentMethod[]): string {
  const labels: Record<PaymentMethod, string> = {
    cb: "CB",
    applepay: "Apple Pay",
    googlepay: "Google Pay",
    paypal: "PayPal",
    virement: "Virement",
    especes: "Espèces",
  }
  return methods.map((m) => labels[m]).join(", ")
}

function getPaymentDelayText(delay: PaymentDelay): string {
  const labels: Record<PaymentDelay, string> = {
    comptant: "Comptant",
    "15j": "15 jours",
    "30j": "30 jours",
  }
  return labels[delay]
}

// ── Main Component ────────────────────────────────────────────

export function CGVSettings({ onBack }: { onBack: () => void }) {
  const { enterprise, updateEnterprise } = useNox()
  
  const [mode, setMode] = useState<CGVMode>(enterprise.cgvMode || "configurator")
  const [config, setConfig] = useState<CGVConfig>(enterprise.cgvConfig || defaultConfig)
  const [freeText, setFreeText] = useState(enterprise.cgvText || "")
  const [importedFile, setImportedFile] = useState<File | null>(null)

  const updateConfig = useCallback(<K extends keyof CGVConfig>(key: K, value: CGVConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportedFile(file)
    }
  }

  const handleSave = () => {
    // Determine the text to save based on mode
    let cgvToSave = ""
    if (mode === "configurator") {
      const paymentTimingText = config.paymentTiming === "before" ? "avant" : "après"
      const methodsText = getPaymentMethodsText(config.paymentMethods)
      const cancellationDelayText = formatDuration(config.cancellationDelay)
      const waitTimeText = formatDuration(config.waitTime + "min").replace("min", "")
      
      cgvToSave = `1. RÉSERVATION ET PAIEMENT: Paiement exigé ${paymentTimingText} l'exécution de la course (${methodsText}). Délai: ${getPaymentDelayText(config.paymentDelay)}.
2. ANNULATION: Gratuite jusqu'à ${cancellationDelayText}. Moins de ${cancellationDelayText}: ${config.cancellationFee}% du montant TTC.
3. ATTENTE: ${waitTimeText} min offertes. Au-delà: ${config.waitFee}€/min.
4. NO-SHOW: ${config.noShowFee}% du montant TTC.`
    } else if (mode === "freetext") {
      cgvToSave = freeText
    } else if (mode === "import" && importedFile) {
      cgvToSave = `CGV Importées: ${importedFile.name}`
    }

    updateEnterprise({
      cgv: cgvToSave,
      cgvMode: mode,
      cgvConfig: config,
      cgvText: freeText
    })

    toast.success("✓ CGV enregistrées et rattachées à vos futurs documents", {
      duration: 3000,
    })
  }

  const loadTemplate = () => {
    setFreeText(standardTemplate)
  }

  // ── Render Preview ──────────────────────────────────────────

  const renderPreview = () => {
    if (mode === "configurator") {
      const paymentTimingText = config.paymentTiming === "before" ? "avant" : "après"
      const methodsText = getPaymentMethodsText(config.paymentMethods)
      const cancellationDelayText = formatDuration(config.cancellationDelay)
      const waitTimeText = formatDuration(config.waitTime + "min").replace("min", "")

      return (
        <ul className="space-y-2.5 text-[12px] text-foreground/90 leading-relaxed">
          <li className="flex gap-2">
            <span className="text-gold">•</span>
            <span>
              Paiement exigé <strong className="text-gold">{paymentTimingText}</strong> l&apos;exécution de la course ({methodsText})
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold">•</span>
            <span>
              Délai de règlement : <strong className="text-gold">{getPaymentDelayText(config.paymentDelay)}</strong>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold">•</span>
            <span>
              Annulation gratuite jusqu&apos;à <strong className="text-gold">{cancellationDelayText}</strong> avant la prise en charge
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold">•</span>
            <span>
              En cas d&apos;annulation tardive (moins de {cancellationDelayText}) : facturation de <strong className="text-gold">{config.cancellationFee}%</strong> du montant TTC
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold">•</span>
            <span>
              Temps d&apos;attente gratuit : <strong className="text-gold">{waitTimeText}</strong> à la prise en charge
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold">•</span>
            <span>
              Au-delà : facturation de <strong className="text-gold">{config.waitFee} €/min</strong> supplémentaire
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold">•</span>
            <span>
              No-show (client absent) : facturation de <strong className="text-gold">{config.noShowFee}%</strong> du montant TTC
            </span>
          </li>
        </ul>
      )
    }

    if (mode === "freetext") {
      return (
        <div className="text-[12px] text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {freeText || <span className="text-muted-foreground italic">Votre texte apparaîtra ici...</span>}
        </div>
      )
    }

    if (mode === "import" && importedFile) {
      return (
        <div className="text-[12px] text-foreground/90">
          <p className="font-medium text-gold mb-1">CGV importées — {importedFile.name}</p>
          <p className="text-muted-foreground">Ce document sera joint automatiquement à tous vos bons de commande.</p>
        </div>
      )
    }

    return <p className="text-[12px] text-muted-foreground italic">Importez un document pour voir l&apos;aperçu...</p>
  }

  return (
    <motion.div
      key="cgv"
      variants={slideIn}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex flex-col h-full"
    >
      <SubScreenHeader title="Mes Conditions de Vente" onBack={onBack} />

      <div className="flex-1 overflow-y-auto pb-40">
        {/* Header Description */}
        <div className="px-4 py-4">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Configurez les conditions de vente qui seront automatiquement intégrées à tous vos bons de commande et factures.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="px-4 space-y-2.5 mb-6">
          {/* Mode 1: Configurator */}
          <button
            onClick={() => setMode("configurator")}
            className={cn(
              "w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98]",
              mode === "configurator"
                ? "bg-gold/10 border-gold/50"
                : "bg-onyx-card/60 border-onyx-border/30 hover:border-onyx-border/50"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  mode === "configurator" ? "bg-gold/20" : "bg-onyx-card"
                )}
              >
                <SlidersHorizontal className={cn("h-5 w-5", mode === "configurator" ? "text-gold" : "text-muted-foreground")} strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("font-semibold text-sm", mode === "configurator" ? "text-gold" : "text-foreground")}>
                    Configurateur guidé
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-gold/20 text-gold text-[9px] font-bold uppercase">
                    Recommandé
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Je paramètre mes conditions en quelques clics</p>
              </div>
              {mode === "configurator" && (
                <div className="w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                  <Check className="h-3 w-3 text-black" strokeWidth={3} />
                </div>
              )}
            </div>
          </button>

          {/* Mode 2: Free Text */}
          <button
            onClick={() => setMode("freetext")}
            className={cn(
              "w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98]",
              mode === "freetext"
                ? "bg-gold/10 border-gold/50"
                : "bg-onyx-card/60 border-onyx-border/30 hover:border-onyx-border/50"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  mode === "freetext" ? "bg-gold/20" : "bg-onyx-card"
                )}
              >
                <PenLine className={cn("h-5 w-5", mode === "freetext" ? "text-gold" : "text-muted-foreground")} strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <span className={cn("font-semibold text-sm", mode === "freetext" ? "text-gold" : "text-foreground")}>
                  Rédiger mes propres CGV
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Je rédige mes conditions de A à Z</p>
              </div>
              {mode === "freetext" && (
                <div className="w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                  <Check className="h-3 w-3 text-black" strokeWidth={3} />
                </div>
              )}
            </div>
          </button>

          {/* Mode 3: Import */}
          <button
            onClick={() => setMode("import")}
            className={cn(
              "w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98]",
              mode === "import"
                ? "bg-gold/10 border-gold/50"
                : "bg-onyx-card/60 border-onyx-border/30 hover:border-onyx-border/50"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  mode === "import" ? "bg-gold/20" : "bg-onyx-card"
                )}
              >
                <UploadCloud className={cn("h-5 w-5", mode === "import" ? "text-gold" : "text-muted-foreground")} strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <span className={cn("font-semibold text-sm", mode === "import" ? "text-gold" : "text-foreground")}>
                  Importer un document
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">J&apos;ai déjà un fichier CGV existant</p>
              </div>
              {mode === "import" && (
                <div className="w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                  <Check className="h-3 w-3 text-black" strokeWidth={3} />
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Active Mode Panel */}
        <div className="px-4 mb-6">
          {mode === "configurator" && (
            <div className="bg-onyx-card/60 rounded-xl border border-onyx-border/30 p-4">
              <SettingRow label="Paiement exigé">
                <PillToggle
                  options={["before", "after"] as PaymentTiming[]}
                  value={config.paymentTiming}
                  onChange={(v) => updateConfig("paymentTiming", v)}
                  labels={{ before: "Avant la course", after: "Après la course" }}
                />
                <div className="mt-3">
                  <p className="text-[10px] text-muted-foreground mb-2">Moyens acceptés</p>
                  <CheckboxGrid
                    options={["cb", "applepay", "googlepay", "paypal", "virement", "especes"]}
                    selected={config.paymentMethods}
                    onChange={(methods) => updateConfig("paymentMethods", methods)}
                    labels={{
                      cb: "CB",
                      applepay: "Apple Pay",
                      googlepay: "Google Pay",
                      paypal: "PayPal",
                      virement: "Virement",
                      especes: "Espèces",
                    }}
                  />
                </div>
              </SettingRow>

              <SettingRow label="Délai de règlement" subLabel="Pour facturation Factur-X">
                <PillToggle
                  options={["comptant", "15j", "30j"] as PaymentDelay[]}
                  value={config.paymentDelay}
                  onChange={(v) => updateConfig("paymentDelay", v)}
                  labels={{ comptant: "Comptant", "15j": "15 jours", "30j": "30 jours" }}
                />
              </SettingRow>

              <SettingRow label="Annulation gratuite jusqu'à">
                <PillToggle
                  options={["1h", "2h", "4h", "24h"] as CancellationDelay[]}
                  value={config.cancellationDelay}
                  onChange={(v) => updateConfig("cancellationDelay", v)}
                  labels={{ "1h": "1h avant", "2h": "2h avant", "4h": "4h avant", "24h": "24h avant" }}
                />
              </SettingRow>

              <SettingRow label="Au-delà du délai, facturation de" subLabel="du montant TTC">
                <PillToggle
                  options={["0", "25", "50", "100"] as CancellationFee[]}
                  value={config.cancellationFee}
                  onChange={(v) => updateConfig("cancellationFee", v)}
                  labels={{ "0": "0%", "25": "25%", "50": "50%", "100": "100%" }}
                />
              </SettingRow>

              <SettingRow label="Temps d'attente gratuit à la prise en charge">
                <PillToggle
                  options={["5", "10", "15", "20"] as WaitTime[]}
                  value={config.waitTime}
                  onChange={(v) => updateConfig("waitTime", v)}
                  labels={{ "5": "5 min", "10": "10 min", "15": "15 min", "20": "20 min" }}
                />
              </SettingRow>

              <SettingRow label="Au-delà, facturation de">
                <PillToggle
                  options={["0.25", "0.50", "0.75", "1.00"] as WaitFee[]}
                  value={config.waitFee}
                  onChange={(v) => updateConfig("waitFee", v)}
                  labels={{ "0.25": "0,25 €/min", "0.50": "0,50 €/min", "0.75": "0,75 €/min", "1.00": "1,00 €/min" }}
                />
              </SettingRow>

              <SettingRow label="Client absent à la prise en charge (No-show)">
                <PillToggle
                  options={["0", "50", "100"] as NoShowFee[]}
                  value={config.noShowFee}
                  onChange={(v) => updateConfig("noShowFee", v)}
                  labels={{ "0": "Non facturé", "50": "50% facturé", "100": "100% facturé" }}
                />
              </SettingRow>
            </div>
          )}

          {mode === "freetext" && (
            <div className="bg-onyx-card/60 rounded-xl border border-onyx-border/30 p-4 space-y-3">
              {/* Load Template Button */}
              <button
                onClick={loadTemplate}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-medium hover:bg-gold/15 active:scale-[0.98] transition-all"
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                Charger le modèle standard NoX
              </button>

              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Rédigez ici vos conditions générales de vente...

Ex : Paiement avant la course. Annulation gratuite jusqu'à 2h avant.
Temps d'attente offert : 10 minutes..."
                className="w-full min-h-[200px] px-4 py-3 rounded-xl bg-[#1A1A1A] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 resize-y focus:outline-none focus:border-gold/50 transition-colors"
              />
              <p className="text-[10px] text-muted-foreground text-right">{freeText.length} caractères</p>
            </div>
          )}

          {mode === "import" && (
            <div className="bg-onyx-card/60 rounded-xl border border-onyx-border/30 p-4">
              {!importedFile ? (
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-gold/30 rounded-xl p-8 text-center hover:border-gold/50 transition-colors">
                    <UploadCloud className="h-10 w-10 text-gold/50 mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-sm text-foreground mb-1">Glissez votre document ici</p>
                    <p className="text-[11px] text-muted-foreground mb-3">ou</p>
                    <span className="inline-block px-4 py-2 rounded-xl bg-gold/20 text-gold text-xs font-medium">
                      Choisir un fichier
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-3">.pdf, .doc, .docx, .txt</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{importedFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(importedFile.size / 1024).toFixed(1)} Ko</p>
                  </div>
                  <button
                    onClick={() => setImportedFile(null)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div className="px-4 mb-6">
          <div className="bg-[#2a2a2a] rounded-t-xl border border-onyx-border/30 border-b-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-onyx-border/20">
              <Eye className="h-4 w-4 text-gold" strokeWidth={1.5} />
              <span className="text-xs font-semibold text-foreground">Aperçu — Conditions & Acceptation</span>
            </div>
            <div className="p-4">{renderPreview()}</div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="px-4 mb-6">
          <div className="flex gap-2.5 p-3 rounded-xl bg-onyx-card/40 border border-onyx-border/20">
            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Les CGV générées sont fournies à titre indicatif. Pour une activité professionnelle, une validation juridique est recommandée.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="fixed bottom-20 left-0 right-0 px-4 py-4 bg-gradient-to-t from-background via-background to-transparent">
        <button
          onClick={handleSave}
          className="w-full h-[52px] rounded-full bg-gold text-black font-bold text-sm flex items-center justify-center gap-2 hover:bg-gold/90 active:scale-[0.98] transition-all gold-glow"
        >
          Enregistrer mes CGV
        </button>
      </div>
    </motion.div>
  )
}

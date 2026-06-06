"use client"

import { useState, useMemo } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { X, UserRoundPlus, Building2, Search, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"
import { toast } from "sonner"
import type { ClientType, Client } from "./data"

interface QuickAddClientModalProps {
  open: boolean
  onClose: () => void
  clients: Client[]
  onClientCreated: (clientId: string, passagerNom?: string, passagerTel?: string) => void
}

export function QuickAddClientModal({ open, onClose, clients, onClientCreated }: QuickAddClientModalProps) {
  const { addClient, updateClient } = useNox()

  const [clientType, setClientType] = useState<ClientType>("particulier")
  const [civilite, setCivilite] = useState<"M." | "Mme">("M.")
  const [prenom, setPrenom] = useState("")
  const [nom, setNom] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  const [societeSearch, setSocieteSearch] = useState("")
  const [selectedSociete, setSelectedSociete] = useState<Client | null>(null)
  const [societeFocused, setSocieteFocused] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})

  const isParticulier = clientType === "particulier"

  const filteredSocietes = useMemo(() => {
    const s = societeSearch.trim().toLowerCase()
    if (!s) return []
    return clients
      .filter(c => c.type === "professionnel" && (c.raisonSociale ?? "").toLowerCase().includes(s))
      .slice(0, 5)
  }, [societeSearch, clients])

  const showCreateSociete = societeSearch.trim().length > 0 && !selectedSociete && filteredSocietes.length === 0

  function resetForm() {
    setClientType("particulier")
    setCivilite("M.")
    setPrenom("")
    setNom("")
    setPhone("")
    setEmail("")
    setSocieteSearch("")
    setSelectedSociete(null)
    setSocieteFocused(false)
    setFieldErrors({})
  }

  function validate(): boolean {
    const errs: Record<string, boolean> = {}
    if (!prenom.trim()) errs.prenom = true
    if (!nom.trim()) errs.nom = true
    if (!phone.trim()) errs.phone = true
    if (!isParticulier && !selectedSociete && !societeSearch.trim()) errs.societe = true
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    if (!validate()) return
    setIsSubmitting(true)

    try {
      if (isParticulier) {
        const newId = await addClient({
          id: `temp-${Date.now()}`,
          type: "particulier",
          civilite,
          prenom: prenom.trim(),
          nom: nom.trim(),
          phone: phone.trim(),
          email: email.trim(),
          billingAddress: { rue: "", codePostal: "", ville: "", pays: "" },
          trips: 0,
          lastTrip: "Jamais",
          notes: "",
        })
        if (!newId) throw new Error()
        onClientCreated(newId)
        toast.success("Client ajouté", { description: `${prenom} ${nom} a été ajouté.` })
        onClose()
        setTimeout(resetForm, 300)
      } else {
        const passagerNom = `${prenom.trim()} ${nom.trim()}`.trim()
        const newContact = {
          id: `contact-${Date.now()}`,
          prenom: prenom.trim(),
          nom: nom.trim(),
          phone: phone.trim(),
        }

        if (selectedSociete) {
          await updateClient(selectedSociete.id, {
            contacts: [...(selectedSociete.contacts ?? []), newContact],
          })
          onClientCreated(selectedSociete.id, passagerNom, phone.trim())
          toast.success("Contact ajouté", {
            description: `${passagerNom} ajouté à ${selectedSociete.raisonSociale}.`,
          })
          onClose()
          setTimeout(resetForm, 300)
        } else {
          const newId = await addClient({
            id: `temp-${Date.now()}`,
            type: "professionnel",
            raisonSociale: societeSearch.trim(),
            phone: phone.trim(),
            email: email.trim(),
            contacts: [newContact],
            billingAddress: { rue: "", codePostal: "", ville: "", pays: "" },
            trips: 0,
            lastTrip: "Jamais",
            notes: "",
          })
          if (!newId) throw new Error()
          onClientCreated(newId, passagerNom, phone.trim())
          toast.success("Société créée", {
            description: `${societeSearch} + ${passagerNom} ont été ajoutés.`,
          })
          onClose()
          setTimeout(resetForm, 300)
        }
      }
    } catch {
      toast.error("Erreur", { description: "Le client n'a pas pu être créé." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputCls =
    "w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
  const labelCls =
    "block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5"

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-end justify-center">
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modale */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-onyx-border/50 flex flex-col"
        style={{ maxHeight: "85vh" }}
      >
        {/* En-tête fixe */}
        <div className="flex-shrink-0 p-5 pb-3">
          <div className="flex justify-center mb-3 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-onyx-border/50" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                {isParticulier
                  ? <UserRoundPlus className="h-4 w-4 text-gold" strokeWidth={1.5} />
                  : <Building2 className="h-4 w-4 text-gold" strokeWidth={1.5} />}
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Nouveau client</h2>
                <p className="text-[10px] text-muted-foreground">Ajout rapide depuis le bon de réservation</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
            >
              <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            </button>
          </div>
          <div className="mt-3 h-px bg-onyx-border/30" />
        </div>

        {/* Corps scrollable */}
        <div className="overflow-y-auto flex-1 px-5">
          <form id="quick-add-form" onSubmit={handleSubmit} className="space-y-4 py-4">

            {/* Type selector */}
            <div>
              <label className={labelCls}>Type de client</label>
              <div className="flex gap-2">
                {([
                  { value: "particulier" as ClientType, label: "Particulier", icon: <UserRoundPlus className="h-3.5 w-3.5" strokeWidth={1.5} /> },
                  { value: "professionnel" as ClientType, label: "Société", icon: <Building2 className="h-3.5 w-3.5" strokeWidth={1.5} /> },
                ] as const).map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { setClientType(t.value); setSelectedSociete(null); setSocieteSearch(""); setFieldErrors({}) }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border transition-all",
                      clientType === t.value
                        ? "bg-gold/15 border-gold/40 text-gold"
                        : "bg-onyx-card border-onyx-border/50 text-muted-foreground hover:border-gold/20"
                    )}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Société search (professionnel only) */}
            {!isParticulier && (
              <div>
                <label className={labelCls}>Société <span className="text-red-500">*</span></label>
                {selectedSociete ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gold/10 border border-gold/30">
                    <Building2 className="h-4 w-4 text-gold flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-sm text-foreground font-medium flex-1 truncate">{selectedSociete.raisonSociale}</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedSociete(null); setSocieteSearch("") }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={societeSearch}
                      onChange={e => { setSocieteSearch(e.target.value); if (e.target.value.trim()) setFieldErrors(prev => { const p = { ...prev }; delete p.societe; return p }) }}
                      onFocus={() => setSocieteFocused(true)}
                      onBlur={() => setTimeout(() => setSocieteFocused(false), 200)}
                      placeholder="Rechercher une société existante..."
                      className={cn("w-full pl-10 pr-4 py-3 rounded-xl bg-onyx-card border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors", fieldErrors.societe ? "border-red-500" : "border-onyx-border/50")}
                      style={{ fontSize: "16px" }}
                    />
                    {societeFocused && societeSearch.trim().length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-[#242424] border border-onyx-border/30 overflow-hidden z-10 divide-y divide-onyx-border/20">
                        {filteredSocietes.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onMouseDown={() => {
                              setSelectedSociete(s)
                              setSocieteSearch(s.raisonSociale ?? "")
                              setSocieteFocused(false)
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                          >
                            <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold flex-shrink-0">
                              {(s.raisonSociale?.[0] ?? "").toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{s.raisonSociale}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {(s.contacts?.length ?? 0)} contact{(s.contacts?.length ?? 0) !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </button>
                        ))}
                        {showCreateSociete && (
                          <button
                            type="button"
                            onMouseDown={() => setSocieteFocused(false)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-gold text-[11px] font-medium hover:bg-gold/5"
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                            Créer « {societeSearch.trim()} »
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {fieldErrors.societe && (
                  <p className="text-xs text-red-400 mt-1">Ce champ est obligatoire</p>
                )}
                {!selectedSociete && !fieldErrors.societe && societeSearch.trim().length === 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Tapez le nom pour rechercher une société existante ou en créer une nouvelle.
                  </p>
                )}
              </div>
            )}

            {/* Civilité (particulier only) */}
            {isParticulier && (
              <div>
                <label className={labelCls}>Civilité</label>
                <div className="flex gap-2">
                  {(["M.", "Mme"] as const).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCivilite(c)}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-xs font-medium border transition-all",
                        civilite === c
                          ? "bg-gold/15 border-gold/40 text-gold"
                          : "bg-onyx-card border-onyx-border/50 text-muted-foreground hover:border-gold/20"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Prénom <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={prenom}
                  onChange={e => { setPrenom(e.target.value); if (e.target.value.trim()) setFieldErrors(prev => { const p = { ...prev }; delete p.prenom; return p }) }}
                  placeholder="Alexandre"
                  className={cn(inputCls, fieldErrors.prenom && "border-red-500")}
                />
                {fieldErrors.prenom && <p className="text-xs text-red-400 mt-1">Ce champ est obligatoire</p>}
              </div>
              <div>
                <label className={labelCls}>Nom <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={nom}
                  onChange={e => { setNom(e.target.value); if (e.target.value.trim()) setFieldErrors(prev => { const p = { ...prev }; delete p.nom; return p }) }}
                  placeholder="Laurent"
                  className={cn(inputCls, fieldErrors.nom && "border-red-500")}
                />
                {fieldErrors.nom && <p className="text-xs text-red-400 mt-1">Ce champ est obligatoire</p>}
              </div>
            </div>

            {/* Téléphone + Email */}
            <div>
              <label className={labelCls}>Téléphone <span className="text-red-500">*</span></label>
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); if (e.target.value.trim()) setFieldErrors(prev => { const p = { ...prev }; delete p.phone; return p }) }}
                placeholder="+33 6 12 34 56 78"
                className={cn(inputCls, fieldErrors.phone && "border-red-500")}
                style={{ fontSize: "16px" }}
              />
              {fieldErrors.phone && <p className="text-xs text-red-400 mt-1">Ce champ est obligatoire</p>}
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="client@example.com"
                className={inputCls}
              />
            </div>

          </form>
        </div>

        {/* Boutons fixes en bas */}
        <div
          className="flex gap-3 p-5 pt-3 flex-shrink-0 border-t border-onyx-border/20"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-muted-foreground hover:border-gold/20 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="quick-add-form"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-gold text-black hover:bg-gold/90 transition-all active:scale-95 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}

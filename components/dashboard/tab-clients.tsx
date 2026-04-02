"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Search,
  ChevronRight,
  Plus,
  Phone,
  MessageSquare,
  FileText,
  Pencil,
  X,
  Mail,
  MapPin,
  StickyNote,
  Building2,
  Users,
  Sparkles,
  History,
  Save,
  Trash2,
  Contact,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AddClientModal } from "./add-client-modal"
import { CreateBCFlow, type BCPrefillClient } from "./create-bc"
import { allClients, type Client, type ClientContact } from "./data"
import { useNav } from "./nav-context"

// ── Helper: Get display name ─────────────────────────────────

function getClientDisplayName(client: Client): string {
  if (client.type === "particulier") {
    return `${client.prenom} ${client.nom}`
  }
  return client.raisonSociale || ""
}

function getClientInitials(client: Client): string {
  if (client.type === "particulier") {
    return `${client.prenom?.[0] || ""}${client.nom?.[0] || ""}`
  }
  const words = (client.raisonSociale || "").split(" ")
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }
  return (client.raisonSociale || "").slice(0, 2).toUpperCase()
}

// ── Client Card ──────────────────────────────────────────────

function ClientCard({
  client,
  onSelect,
}: {
  client: Client
  onSelect: () => void
}) {
  const initials = getClientInitials(client)
  const displayName = getClientDisplayName(client)
  const isPro = client.type === "professionnel"

  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-3 w-full p-3 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/20 transition-colors text-left"
    >
      <div className={cn(
        "w-11 h-11 rounded-full border flex items-center justify-center shrink-0",
        isPro 
          ? "bg-blue-500/10 border-blue-500/30" 
          : "bg-gold/15 border-gold/30"
      )}>
        {isPro ? (
          <Building2 className="h-5 w-5 text-blue-400" strokeWidth={1.5} />
        ) : (
          <span className="text-sm font-bold text-gold">{initials}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">
            {displayName}
          </p>
          {isPro && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
              PRO
            </span>
          )}
          {client.tag && (
            <span
              className={cn(
                "px-1.5 py-0.5 text-[9px] font-medium rounded-full border shrink-0",
                client.tag === "VIP"
                  ? "bg-gold/10 text-gold border-gold/20"
                  : "bg-secondary text-muted-foreground border-onyx-border/50",
              )}
            >
              {client.tag}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-gold font-medium">
            {client.trips} trajets
          </span>
          <span className="text-[10px] text-muted-foreground">
            Dernier : {client.lastTrip}
          </span>
        </div>
      </div>

      <ChevronRight
        className="h-4 w-4 text-muted-foreground shrink-0"
        strokeWidth={1.5}
      />
    </button>
  )
}

// ── Client Detail Slide-over ─────────────────────────────────

function ClientDetail({
  client,
  onClose,
  onCreateBC,
}: {
  client: Client
  onClose: () => void
  onCreateBC: (prefill: BCPrefillClient) => void
}) {
  const initials = getClientInitials(client)
  const displayName = getClientDisplayName(client)
  const isPro = client.type === "professionnel"
  const { switchTab } = useNav()

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editPhone, setEditPhone] = useState(client.phone)
  const [editEmail, setEditEmail] = useState(client.email)
  const [editNotes, setEditNotes] = useState(client.notes)
  const [editPreferences, setEditPreferences] = useState(client.preferences || "")
  const [editContacts, setEditContacts] = useState<ClientContact[]>(client.contacts || [])
  const [editRue, setEditRue] = useState(client.billingAddress.rue)
  const [editCodePostal, setEditCodePostal] = useState(client.billingAddress.codePostal)
  const [editVille, setEditVille] = useState(client.billingAddress.ville)

  function handleCreateBC() {
    const prefill: BCPrefillClient = isPro
      ? {
          civilite: "",
          nom: client.raisonSociale || "",
          prenom: "",
          tel: client.phone,
        }
      : {
          civilite: client.civilite || "M.",
          nom: client.nom || "",
          prenom: client.prenom || "",
          tel: client.phone,
        }
    onClose()
    setTimeout(() => onCreateBC(prefill), 350)
  }

  function handleEdit() {
    setIsEditing(true)
  }

  function handleCancelEdit() {
    // Reset to original values
    setEditPhone(client.phone)
    setEditEmail(client.email)
    setEditNotes(client.notes)
    setEditPreferences(client.preferences || "")
    setEditContacts(client.contacts || [])
    setEditRue(client.billingAddress.rue)
    setEditCodePostal(client.billingAddress.codePostal)
    setEditVille(client.billingAddress.ville)
    setIsEditing(false)
  }

  function handleSaveEdit() {
    // In real app, would save to database
    setIsEditing(false)
  }

  function addContact() {
    setEditContacts([...editContacts, { id: `temp-${Date.now()}`, prenom: "", nom: "", phone: "" }])
  }

  function updateContact(index: number, field: keyof ClientContact, value: string) {
    const updated = [...editContacts]
    updated[index] = { ...updated[index], [field]: value }
    setEditContacts(updated)
  }

  function removeContact(index: number) {
    setEditContacts(editContacts.filter((_, i) => i !== index))
  }

  function handleViewDocument(docId: string) {
    onClose()
    setTimeout(() => {
      switchTab("documents")
    }, 350)
  }

  const fullAddress = client.billingAddress 
    ? `${client.billingAddress.rue}, ${client.billingAddress.codePostal} ${client.billingAddress.ville}`
    : ""

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex justify-end"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-full max-w-md bg-background h-full overflow-y-auto"
      >
        {/* Close */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Fiche Client
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-onyx-card border border-onyx-border/50 flex items-center justify-center hover:border-gold/30 transition-colors"
          >
            <X className="h-4 w-4 text-foreground" strokeWidth={1.5} />
          </button>
        </div>

        {/* Profile header */}
        <div className="flex flex-col items-center px-4 pt-4 pb-6">
          <div className={cn(
            "w-16 h-16 rounded-full border-2 flex items-center justify-center mb-3",
            isPro 
              ? "bg-blue-500/10 border-blue-500/40" 
              : "bg-gold/15 border-gold/40"
          )}>
            {isPro ? (
              <Building2 className="h-7 w-7 text-blue-400" strokeWidth={1.5} />
            ) : (
              <span className="text-xl font-bold text-gold">{initials}</span>
            )}
          </div>
          <h1 className="text-lg font-bold text-foreground text-center">
            {displayName}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
            {isPro && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                PROFESSIONNEL
              </span>
            )}
            {client.tag && (
              <span
                className={cn(
                  "px-2 py-0.5 text-[10px] font-medium rounded-full border",
                  client.tag === "VIP"
                    ? "bg-gold/10 text-gold border-gold/20"
                    : "bg-secondary text-muted-foreground border-onyx-border/50",
                )}
              >
                {client.tag}
              </span>
            )}
            <span className="text-xs text-gold font-medium">
              {client.trips} trajets
            </span>
          </div>
        </div>

        {/* Action buttons or Edit mode buttons */}
        {!isEditing ? (
          <div className="grid grid-cols-4 gap-2 px-4 mb-6">
            {[
              {
                icon: <Phone className="h-4 w-4" strokeWidth={1.5} />,
                label: "Appeler",
                onClick: () => window.open(`tel:${client.phone}`),
              },
              {
                icon: <MessageSquare className="h-4 w-4" strokeWidth={1.5} />,
                label: "SMS",
                onClick: () => window.open(`sms:${client.phone}`),
              },
              {
                icon: <FileText className="h-4 w-4" strokeWidth={1.5} />,
                label: "Créer BC",
                onClick: handleCreateBC,
                highlight: true,
              },
              {
                icon: <Pencil className="h-4 w-4" strokeWidth={1.5} />,
                label: "Modifier",
                onClick: handleEdit,
              },
            ].map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 rounded-2xl border active:scale-[0.97] transition-all",
                  action.highlight
                    ? "bg-gold/10 border-gold/30 hover:border-gold/50"
                    : "bg-onyx-card border-gold/20 hover:border-gold/40",
                )}
              >
                <span className="text-gold">{action.icon}</span>
                <span className={cn(
                  "text-[10px] font-medium",
                  action.highlight ? "text-gold" : "text-foreground",
                )}>
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2 px-4 mb-6">
            <button
              onClick={handleCancelEdit}
              className="flex-1 py-2.5 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm font-medium text-muted-foreground hover:border-gold/20 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex-1 py-2.5 rounded-xl bg-gold text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Save className="h-4 w-4" strokeWidth={1.5} />
              Enregistrer
            </button>
          </div>
        )}

        {/* Préférences Prestige */}
        {(client.preferences || isEditing) && (
          <div className="px-4 mb-5">
            <p className="text-[11px] font-semibold text-gold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" strokeWidth={1.5} />
              Préférences Prestige
            </p>
            {isEditing ? (
              <textarea
                value={editPreferences}
                onChange={(e) => setEditPreferences(e.target.value)}
                placeholder="Ex: Eau plate Evian, Température 21°C, Silence souhaité..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-gold/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50 resize-none transition-colors"
              />
            ) : (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-gold/5 to-gold/10 border border-gold/20">
                <p className="text-sm text-gold leading-relaxed">
                  {client.preferences}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Professional Info */}
        {isPro && !isEditing && (
          <div className="px-4 mb-5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Informations Entreprise
            </p>
            <div className="rounded-2xl bg-onyx-card border border-onyx-border/50 overflow-hidden divide-y divide-onyx-border/30">
              {client.siren && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[10px] text-muted-foreground uppercase">SIREN</span>
                  <span className="text-xs text-foreground font-mono">{client.siren}</span>
                </div>
              )}
              {client.tvaIntra && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[10px] text-muted-foreground uppercase">TVA Intracom.</span>
                  <span className="text-xs text-foreground font-mono">{client.tvaIntra}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contacts for professionals */}
        {isPro && (
          <div className="px-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-3 w-3" strokeWidth={1.5} />
                Contacts / Passagers ({isEditing ? editContacts.length : (client.contacts?.length || 0)})
              </p>
              {isEditing && (
                <button
                  onClick={addContact}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gold/10 border border-gold/30 text-gold text-[10px] font-medium hover:bg-gold/20 transition-colors"
                >
                  <Plus className="h-3 w-3" strokeWidth={2} />
                  Ajouter
                </button>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                {editContacts.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/70 italic py-2">
                    Aucun contact ajouté
                  </p>
                ) : (
                  editContacts.map((contact, index) => (
                    <div key={contact.id} className="p-3 rounded-xl bg-onyx-card border border-onyx-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-gold font-medium">Contact {index + 1}</span>
                        <button
                          onClick={() => removeContact(index)}
                          className="p-1 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="text"
                          value={contact.prenom}
                          onChange={(e) => updateContact(index, "prenom", e.target.value)}
                          placeholder="Prénom"
                          className="w-full px-3 py-2 rounded-lg bg-background border border-onyx-border/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                        />
                        <input
                          type="text"
                          value={contact.nom}
                          onChange={(e) => updateContact(index, "nom", e.target.value)}
                          placeholder="Nom"
                          className="w-full px-3 py-2 rounded-lg bg-background border border-onyx-border/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                        />
                      </div>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => updateContact(index, "phone", e.target.value)}
                        placeholder="Téléphone"
                        className="w-full px-3 py-2 rounded-lg bg-background border border-onyx-border/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                      />
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {(client.contacts?.length || 0) === 0 ? (
                  <p className="text-[11px] text-muted-foreground/70 italic py-2">
                    Aucun contact associé
                  </p>
                ) : (
                  client.contacts?.map((contact) => (
                    <div key={contact.id} className="flex items-center gap-3 p-3 rounded-xl bg-onyx-card border border-onyx-border/50">
                      <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gold">
                          {contact.prenom[0]}{contact.nom[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{contact.prenom} {contact.nom}</p>
                        <p className="text-[10px] text-muted-foreground">{contact.phone}</p>
                      </div>
                      <button 
                        onClick={() => window.open(`tel:${contact.phone}`)}
                        className="p-2 rounded-lg hover:bg-gold/10 text-gold transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Contact info */}
        <div className="px-4 mb-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Coordonnées
          </p>
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Téléphone</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Adresse</label>
                <input
                  type="text"
                  value={editRue}
                  onChange={(e) => setEditRue(e.target.value)}
                  placeholder="Rue"
                  className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors mb-2"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editCodePostal}
                    onChange={(e) => setEditCodePostal(e.target.value)}
                    placeholder="Code postal"
                    maxLength={5}
                    className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                  />
                  <input
                    type="text"
                    value={editVille}
                    onChange={(e) => setEditVille(e.target.value)}
                    placeholder="Ville"
                    className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/40 transition-colors"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-onyx-card border border-onyx-border/50 overflow-hidden divide-y divide-onyx-border/30">
              <div className="flex items-center gap-3 px-4 py-3">
                <Phone className="h-4 w-4 text-gold shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-foreground">{client.phone}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Mail className="h-4 w-4 text-gold shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-foreground truncate">
                  {client.email}
                </span>
              </div>
              {fullAddress && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <MapPin className="h-4 w-4 text-gold shrink-0" strokeWidth={1.5} />
                  <span className="text-xs text-foreground">{fullAddress}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="px-4 mb-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Notes
          </p>
          {isEditing ? (
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground focus:outline-none focus:border-gold/40 resize-none transition-colors"
            />
          ) : (
            <div className="p-4 rounded-2xl bg-onyx-card border border-onyx-border/50">
              <div className="flex items-start gap-2">
                <StickyNote
                  className="h-4 w-4 text-gold shrink-0 mt-0.5"
                  strokeWidth={1.5}
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {client.notes}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Historique Express */}
        {!isEditing && client.tripHistory && client.tripHistory.length > 0 && (
          <div className="px-4 pb-20">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <History className="h-3 w-3" strokeWidth={1.5} />
              Historique Express
            </p>
            <div className="rounded-2xl bg-onyx-card border border-onyx-border/50 overflow-hidden divide-y divide-onyx-border/30">
              {client.tripHistory.slice(0, 3).map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => handleViewDocument(trip.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gold/5 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{trip.trajet}</p>
                    <p className="text-[10px] text-muted-foreground">{trip.date}</p>
                  </div>
                  <span className="text-sm font-bold text-gold">{trip.montant} €</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
        )}

        {isEditing && <div className="h-20" />}
      </motion.div>
    </motion.div>
  )
}

// ── Clients Tab ──────────────────────────────────────────────

export function ClientsTab() {
  const [search, setSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [bcPrefill, setBcPrefill] = useState<BCPrefillClient | null>(null)
  const [showBCFlow, setShowBCFlow] = useState(false)

  function handleCreateBCFromClient(prefill: BCPrefillClient) {
    setBcPrefill(prefill)
    setShowBCFlow(true)
  }

  function handleCloseBCFlow() {
    setShowBCFlow(false)
    setBcPrefill(null)
  }

  const filtered = allClients.filter((c) => {
    const searchLower = search.toLowerCase()
    const displayName = getClientDisplayName(c).toLowerCase()
    return displayName.includes(searchLower) || c.email.toLowerCase().includes(searchLower)
  })

  const proCount = filtered.filter(c => c.type === "professionnel").length
  const partCount = filtered.filter(c => c.type === "particulier").length

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-4">
        <h1 className="text-lg font-bold text-foreground mb-3">Clients</h1>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-onyx-card border border-onyx-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/40 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 mt-2">
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} client{filtered.length > 1 ? "s" : ""}
          </p>
          {proCount > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-medium">
              <Building2 className="h-3 w-3" strokeWidth={1.5} />
              {proCount} pro
            </span>
          )}
          {partCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {partCount} particulier{partCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-20">
        {filtered.length > 0 ? (
          filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onSelect={() => setSelectedClient(client)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun client trouvé
            </p>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-28 right-5 z-30 w-12 h-12 rounded-full bg-gold flex items-center justify-center gold-glow active:scale-95 transition-transform"
      >
        <Plus className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
      </button>

      <AddClientModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      <CreateBCFlow
        open={showBCFlow}
        onClose={handleCloseBCFlow}
        prefillClient={bcPrefill}
      />

      <AnimatePresence>
        {selectedClient && (
          <ClientDetail
            client={selectedClient}
            onClose={() => setSelectedClient(null)}
            onCreateBC={handleCreateBCFromClient}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

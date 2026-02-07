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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AddClientModal } from "./add-client-modal"

interface Client {
  id: string
  firstName: string
  lastName: string
  trips: number
  lastTrip: string
  phone: string
  email: string
  address: string
  notes: string
  tag?: "VIP" | "R\u00e9gulier"
}

const clients: Client[] = [
  {
    id: "1",
    firstName: "Alexandre",
    lastName: "Laurent",
    trips: 24,
    lastTrip: "06/02/2026",
    phone: "+33 6 12 34 56 78",
    email: "a.laurent@email.com",
    address: "8 Rue de Rivoli, Paris 1er",
    notes: "Client fidèle. Préfère les Mercedes. Toujours ponctuel.",
    tag: "VIP",
  },
  {
    id: "2",
    firstName: "Sophie",
    lastName: "Beaumont",
    trips: 12,
    lastTrip: "05/02/2026",
    phone: "+33 6 98 76 54 32",
    email: "s.beaumont@email.com",
    address: "Le Bristol Paris, Rue du Fbg St-Honoré",
    notes: "Demande souvent un siège enfant. Trajets aéroport fréquents.",
    tag: "R\u00e9gulier",
  },
  {
    id: "3",
    firstName: "Philippe",
    lastName: "Moreau",
    trips: 8,
    lastTrip: "28/01/2026",
    phone: "+33 6 55 44 33 22",
    email: "p.moreau@cabinet-moreau.fr",
    address: "Gare de Lyon, Paris 12e",
    notes: "Avocat. Trajets professionnels uniquement.",
  },
  {
    id: "4",
    firstName: "Claire",
    lastName: "Dubois",
    trips: 31,
    lastTrip: "04/02/2026",
    phone: "+33 6 11 22 33 44",
    email: "c.dubois@luxe.com",
    address: "16 Av. Montaigne, Paris 8e",
    notes: "Directrice achats. Facturation entreprise mensuelle.",
    tag: "VIP",
  },
  {
    id: "5",
    firstName: "Marc",
    lastName: "Petit",
    trips: 5,
    lastTrip: "20/01/2026",
    phone: "+33 6 77 88 99 00",
    email: "marc.petit@gmail.com",
    address: "Gare du Nord, Paris 10e",
    notes: "Nouveau client. À fidéliser.",
  },
  {
    id: "6",
    firstName: "Isabelle",
    lastName: "Garcia",
    trips: 15,
    lastTrip: "02/02/2026",
    phone: "+33 6 44 55 66 77",
    email: "i.garcia@design.fr",
    address: "7 Rue de Passy, Paris 16e",
    notes: "Paiement CB uniquement. Trajets réguliers week-end.",
    tag: "R\u00e9gulier",
  },
]

function ClientCard({
  client,
  onSelect,
}: {
  client: Client
  onSelect: () => void
}) {
  const initials = `${client.firstName[0]}${client.lastName[0]}`

  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-3 w-full p-3 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/20 transition-colors text-left"
    >
      <div className="w-11 h-11 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-gold">{initials}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">
            {client.firstName} {client.lastName}
          </p>
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

function ClientDetail({
  client,
  onClose,
}: {
  client: Client
  onClose: () => void
}) {
  const initials = `${client.firstName[0]}${client.lastName[0]}`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex justify-end"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Slide-over panel */}
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
          <div className="w-16 h-16 rounded-full bg-gold/15 border-2 border-gold/40 flex items-center justify-center mb-3">
            <span className="text-xl font-bold text-gold">{initials}</span>
          </div>
          <h1 className="text-lg font-bold text-foreground">
            {client.firstName} {client.lastName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
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

        {/* Action buttons */}
        <div className="grid grid-cols-4 gap-2 px-4 mb-6">
          {[
            {
              icon: <Phone className="h-4 w-4" strokeWidth={1.5} />,
              label: "Appeler",
            },
            {
              icon: <MessageSquare className="h-4 w-4" strokeWidth={1.5} />,
              label: "SMS",
            },
            {
              icon: <FileText className="h-4 w-4" strokeWidth={1.5} />,
              label: "Cr\u00e9er BC",
            },
            {
              icon: <Pencil className="h-4 w-4" strokeWidth={1.5} />,
              label: "Modifier",
            },
          ].map((action) => (
            <button
              key={action.label}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-onyx-card border border-gold/20 hover:border-gold/40 hover:gold-glow-sm active:scale-[0.97] transition-all"
            >
              <span className="text-gold">{action.icon}</span>
              <span className="text-[10px] font-medium text-foreground">
                {action.label}
              </span>
            </button>
          ))}
        </div>

        {/* Contact info */}
        <div className="px-4 mb-5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Coordonn{"é"}es
          </p>
          <div className="rounded-2xl bg-onyx-card border border-onyx-border/50 overflow-hidden divide-y divide-onyx-border/30">
            <div className="flex items-center gap-3 px-4 py-3">
              <Phone
                className="h-4 w-4 text-gold shrink-0"
                strokeWidth={1.5}
              />
              <span className="text-xs text-foreground">{client.phone}</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Mail
                className="h-4 w-4 text-gold shrink-0"
                strokeWidth={1.5}
              />
              <span className="text-xs text-foreground truncate">
                {client.email}
              </span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <MapPin
                className="h-4 w-4 text-gold shrink-0"
                strokeWidth={1.5}
              />
              <span className="text-xs text-foreground">{client.address}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="px-4 pb-20">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Notes
          </p>
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
        </div>
      </motion.div>
    </motion.div>
  )
}

export function ClientsTab() {
  const [search, setSearch] = useState("")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const filtered = clients.filter(
    (c) =>
      c.firstName.toLowerCase().includes(search.toLowerCase()) ||
      c.lastName.toLowerCase().includes(search.toLowerCase()),
  )

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

        <p className="text-[11px] text-muted-foreground mt-2">
          {filtered.length} client{filtered.length > 1 ? "s" : ""}
        </p>
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
              Aucun client trouv{"é"}
            </p>
          </div>
        )}
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-28 right-5 z-30 w-12 h-12 rounded-full bg-gold flex items-center justify-center gold-glow active:scale-95 transition-transform"
      >
        <Plus
          className="h-5 w-5 text-primary-foreground"
          strokeWidth={2}
        />
      </button>

      {/* Add Client Modal */}
      <AddClientModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      {/* Client Detail Slide-over */}
      <AnimatePresence>
        {selectedClient && (
          <ClientDetail
            client={selectedClient}
            onClose={() => setSelectedClient(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

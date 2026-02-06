"use client"

import { useState } from "react"
import { Search, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Client {
  id: string
  firstName: string
  lastName: string
  trips: number
  lastTrip: string
  phone: string
  tag?: "VIP" | "Régulier"
}

const clients: Client[] = [
  {
    id: "1",
    firstName: "Alexandre",
    lastName: "Laurent",
    trips: 24,
    lastTrip: "06/02/2026",
    phone: "+33 6 12 34 56 78",
    tag: "VIP",
  },
  {
    id: "2",
    firstName: "Sophie",
    lastName: "Beaumont",
    trips: 12,
    lastTrip: "05/02/2026",
    phone: "+33 6 98 76 54 32",
    tag: "Régulier",
  },
  {
    id: "3",
    firstName: "Philippe",
    lastName: "Moreau",
    trips: 8,
    lastTrip: "28/01/2026",
    phone: "+33 6 55 44 33 22",
  },
  {
    id: "4",
    firstName: "Claire",
    lastName: "Dubois",
    trips: 31,
    lastTrip: "04/02/2026",
    phone: "+33 6 11 22 33 44",
    tag: "VIP",
  },
  {
    id: "5",
    firstName: "Marc",
    lastName: "Petit",
    trips: 5,
    lastTrip: "20/01/2026",
    phone: "+33 6 77 88 99 00",
  },
  {
    id: "6",
    firstName: "Isabelle",
    lastName: "Garcia",
    trips: 15,
    lastTrip: "02/02/2026",
    phone: "+33 6 44 55 66 77",
    tag: "Régulier",
  },
]

function ClientCard({ client }: { client: Client }) {
  const initials = `${client.firstName[0]}${client.lastName[0]}`

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-onyx-card border border-onyx-border/50 hover:border-gold/20 transition-colors">
      {/* Initials circle */}
      <div className="w-11 h-11 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-gold">{initials}</span>
      </div>

      {/* Info */}
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

      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
    </div>
  )
}

export function ClientsTab() {
  const [search, setSearch] = useState("")

  const filtered = clients.filter(
    (c) =>
      c.firstName.toLowerCase().includes(search.toLowerCase()) ||
      c.lastName.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2 pb-4">
        <h1 className="text-lg font-bold text-foreground mb-3">Clients</h1>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-onyx-card border border-onyx-border/50 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/40 transition-colors"
          />
        </div>

        <p className="text-[11px] text-muted-foreground mt-2">
          {filtered.length} client{filtered.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Client List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-8">
        {filtered.length > 0 ? (
          filtered.map((client) => <ClientCard key={client.id} client={client} />)
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">Aucun client trouvé</p>
          </div>
        )}
      </div>
    </div>
  )
}

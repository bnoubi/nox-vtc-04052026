"use client"

import { useState, useEffect, useMemo } from "react"
import {
  ChevronLeft, ChevronRight, Plus, RefreshCw, Loader2,
  Search, Building2, Users, X, MapPin, Navigation,
  Car, Euro, User, FileText,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useNox } from "./nox-context"
import { QuickAddClientModal } from "./quick-add-client-modal"
import { type Client } from "./data"

// ── Types ────────────────────────────────────────────────────────────────────

interface RecurringContract {
  id: string
  label: string | null
  passenger_name: string | null
  departure: string
  arrival: string
  days_of_week: number[]
  time: string
  status: "active" | "paused" | "ended"
  created_at: string
}

type BillingMode = "per_trip" | "monthly_invoice" | "monthly_summary"

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]

function formatRecurrence(days: number[], time: string): string {
  if (!days || days.length === 0) return time
  const sorted = [...days].sort((a, b) => a - b)
  return `${sorted.map(d => DAY_LABELS[d] ?? "?").join("/")} · ${time}`
}

const statusConfig = {
  active: { label: "Actif", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  paused: { label: "En pause", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  ended: { label: "Terminé", className: "bg-[#2a2a2a] text-muted-foreground border-onyx-border/30" },
}

const today = new Date().toISOString().split("T")[0]

// ── Section ──────────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode
}) {
  return (
    <div className="border border-onyx-border/30 rounded-xl bg-[#1a1a1a] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-onyx-border/20">
        <Icon className="h-4 w-4 text-gold" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="px-4 pb-4 pt-3 space-y-3">{children}</div>
    </div>
  )
}

// ── CreateRecurringContract ───────────────────────────────────────────────────

function CreateRecurringContract({ onBack, onSuccess }: {
  onBack: () => void
  onSuccess: () => void
}) {
  const { clients, drivers, vehicles } = useNox()

  // Section 1
  const [label, setLabel] = useState("")
  const [notes, setNotes] = useState("")

  // Section 2 — client/passager
  const [selectedClientId, setSelectedClientId] = useState("")
  const [clientSearch, setClientSearch] = useState("")
  const [clientFocused, setClientFocused] = useState(false)
  const [inlineSelectedCompany, setInlineSelectedCompany] = useState<Client | null>(null)
  const [passagerNom, setPassagerNom] = useState("")
  const [passagerTelephone, setPassagerTelephone] = useState("")
  const [passengerSearch, setPassengerSearch] = useState("")
  const [showQuickAddClient, setShowQuickAddClient] = useState(false)
  const [showAllClients, setShowAllClients] = useState(false)
  const [modalClientSearch, setModalClientSearch] = useState("")

  // Section 3 — trajet
  const [departure, setDeparture] = useState("")
  const [arrival, setArrival] = useState("")
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [durationDisplay, setDurationDisplay] = useState("")
  const [isCalculating, setIsCalculating] = useState(false)

  // Section 4 — chauffeur/véhicule
  const [selectedDriverId, setSelectedDriverId] = useState("")
  const [selectedVehicleId, setSelectedVehicleId] = useState("")

  // Section 5 — tarif
  const [pricePerTrip, setPricePerTrip] = useState("")
  const [billingMode, setBillingMode] = useState<BillingMode>("monthly_invoice")

  // Section 6 — période
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [openEnded, setOpenEnded] = useState(false)
  const [country, setCountry] = useState("FR")
  const [excludeHolidays, setExcludeHolidays] = useState(true)

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Computed
  const selectedClient = clients?.find(c => c.id === selectedClientId) ?? null

  const filteredClients = useMemo(() => {
    const list = clients ?? []
    const s = clientSearch.trim().toLowerCase()
    const filtered = s
      ? list.filter(c => {
          const name = `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().trim()
          const company = (c.raisonSociale ?? "").toLowerCase()
          return name.includes(s) || company.includes(s) ||
            (c.phone ?? "").includes(s) || (c.email ?? "").toLowerCase().includes(s)
        })
      : list
    return [...filtered].sort((a, b) => {
      const na = a.type === "particulier" ? `${a.prenom ?? ""} ${a.nom ?? ""}`.trim() : (a.raisonSociale ?? "")
      const nb = b.type === "particulier" ? `${b.prenom ?? ""} ${b.nom ?? ""}`.trim() : (b.raisonSociale ?? "")
      return na.localeCompare(nb, "fr")
    })
  }, [clientSearch, clients])

  const modalFilteredClients = useMemo(() => {
    const list = clients ?? []
    const s = modalClientSearch.trim().toLowerCase()
    const filtered = s
      ? list.filter(c => {
          const name = `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().trim()
          const company = (c.raisonSociale ?? "").toLowerCase()
          return name.includes(s) || company.includes(s) ||
            (c.phone ?? "").includes(s) || (c.email ?? "").toLowerCase().includes(s)
        })
      : list
    return [...filtered].sort((a, b) => {
      const na = a.type === "particulier" ? `${a.prenom ?? ""} ${a.nom ?? ""}`.trim() : (a.raisonSociale ?? "")
      const nb = b.type === "particulier" ? `${b.prenom ?? ""} ${b.nom ?? ""}`.trim() : (b.raisonSociale ?? "")
      return na.localeCompare(nb, "fr")
    })
  }, [modalClientSearch, clients])

  const filteredPassengers = useMemo(() => {
    if (!selectedClient?.contacts) return []
    if (!passengerSearch.trim()) return selectedClient.contacts
    const s = passengerSearch.toLowerCase()
    return selectedClient.contacts.filter(c =>
      `${c.prenom ?? ""} ${c.nom ?? ""}`.toLowerCase().includes(s) ||
      (c.phone ?? "").includes(s)
    )
  }, [selectedClient, passengerSearch])

  // Auto-clear errors
  useEffect(() => {
    if (selectedClientId) setErrors(prev => { const e = { ...prev }; delete e.client; return e })
  }, [selectedClientId])
  useEffect(() => {
    if (departure.trim()) setErrors(prev => { const e = { ...prev }; delete e.departure; return e })
  }, [departure])
  useEffect(() => {
    if (arrival.trim()) setErrors(prev => { const e = { ...prev }; delete e.arrival; return e })
  }, [arrival])

  async function calculateDistance() {
    if (!departure || !arrival) return
    setIsCalculating(true)
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) throw new Error("Clé API manquante")
      const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify({
          origin: { address: departure },
          destination: { address: arrival },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      })
      if (!res.ok) throw new Error(`Routes API ${res.status}`)
      const data = await res.json()
      if (data.routes?.[0]) {
        const route = data.routes[0]
        const km = Math.round((route.distanceMeters ?? 0) / 1000)
        const rawSec = parseInt((route.duration ?? "0s").replace("s", ""), 10)
        if (km > 0) setDistanceKm(km)
        if (rawSec > 0) {
          const h = Math.floor(rawSec / 3600)
          const m = Math.floor((rawSec % 3600) / 60)
          setDurationDisplay(h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`)
        }
      }
    } catch {
      // silencieux — pas de valeur trompeuse
    } finally {
      setIsCalculating(false)
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!label.trim()) e.label = "Le label est obligatoire"
    if (!selectedClientId) e.client = "Veuillez sélectionner un client"
    if (!departure.trim()) e.departure = "L'adresse de départ est obligatoire"
    if (!arrival.trim()) e.arrival = "L'adresse d'arrivée est obligatoire"
    if (!selectedDriverId) e.driver = "Veuillez sélectionner un chauffeur"
    if (!selectedVehicleId) e.vehicle = "Veuillez sélectionner un véhicule"
    if (!pricePerTrip || parseFloat(pricePerTrip) <= 0) e.price = "Le prix par trajet est obligatoire"
    if (!startDate) e.startDate = "La date de début est obligatoire"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (!validate()) return
    // Étape 2 — à implémenter (configuration récurrence)
    alert("Étape 2 (configuration de la récurrence) — à venir")
  }

  const inputClass = (err?: string) => cn(
    "w-full px-3 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50",
    err ? "border-red-500" : "border-onyx-border/30"
  )

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* En-tête */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d] sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Nouveau contrat récurrent</h1>
          <p className="text-[10px] text-muted-foreground">Étape 1/4 — Informations générales</p>
        </div>
      </div>

      {/* Formulaire */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">

        {/* Section 1 — Infos générales */}
        <Section title="Informations générales" icon={FileText}>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Label du contrat <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={e => { setLabel(e.target.value); if (e.target.value.trim()) setErrors(prev => { const er = { ...prev }; delete er.label; return er }) }}
              placeholder="Ex: Transport scolaire Dupont, Mission Entreprise Durand..."
              className={inputClass(errors.label)}
              style={{ fontSize: "16px" }}
            />
            {errors.label && <p className="text-xs text-red-500">{errors.label}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Notes <span className="text-muted-foreground/50 normal-case">(optionnel)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Instructions particulières, code portail, informations complémentaires..."
              rows={3}
              className={cn(inputClass(), "resize-none")}
              style={{ fontSize: "16px" }}
            />
          </div>
        </Section>

        {/* Section 2 — Client & Passager */}
        <Section title="Client & Passager" icon={Building2}>
          {/* Bouton ajout nouveau client */}
          <button
            type="button"
            onClick={() => setShowQuickAddClient(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#242424] border border-dashed border-gold/30 text-gold text-[11px] font-medium hover:bg-gold/5 hover:border-gold/50 transition-all"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Ajouter un nouveau client
          </button>

          {/* Recherche client */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Rechercher un client <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setInlineSelectedCompany(null) }}
                  onFocus={() => setClientFocused(true)}
                  onBlur={() => setTimeout(() => setClientFocused(false), 200)}
                  placeholder="Nom, société, téléphone..."
                  className={cn("w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50", errors.client ? "border-red-500" : "border-onyx-border/30")}
                  style={{ fontSize: "16px" }}
                />
              </div>
              <button
                type="button"
                onClick={() => { setShowAllClients(true); setModalClientSearch("") }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-[11px] text-muted-foreground hover:border-gold/30 hover:text-gold transition-colors whitespace-nowrap"
              >
                <Users className="h-3.5 w-3.5" />
                Voir tous
              </button>
            </div>
            {errors.client && <p className="text-xs text-red-500">{errors.client}</p>}
          </div>

          {/* Dropdown inline */}
          {(clientFocused || clientSearch.trim() || !!inlineSelectedCompany) && !selectedClientId && (
            <div className="max-h-[200px] overflow-y-auto rounded-xl bg-[#242424] border border-onyx-border/30 divide-y divide-onyx-border/20">
              {inlineSelectedCompany ? (
                <>
                  <button type="button" className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left"
                    onClick={() => setInlineSelectedCompany(null)}>
                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground truncate">{inlineSelectedCompany.raisonSociale}</span>
                  </button>
                  <button type="button" className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                    onClick={() => { setSelectedClientId(inlineSelectedCompany.id); setClientSearch(""); setClientFocused(false); setInlineSelectedCompany(null) }}>
                    <div className="w-8 h-8 rounded-full bg-onyx-card border border-onyx-border/30 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Sans passager distinct</p>
                      <p className="text-[10px] text-muted-foreground">Société = client et passager</p>
                    </div>
                  </button>
                  {inlineSelectedCompany.contacts!.map(contact => (
                    <button key={contact.id} type="button" className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                      onClick={() => {
                        setSelectedClientId(inlineSelectedCompany.id)
                        setPassagerNom(`${contact.prenom ?? ""} ${contact.nom ?? ""}`.trim())
                        if (contact.phone) setPassagerTelephone(contact.phone)
                        setClientSearch(""); setClientFocused(false); setInlineSelectedCompany(null)
                      }}>
                      <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold flex-shrink-0">
                        {(contact.prenom?.[0] ?? "").toUpperCase()}{(contact.nom?.[0] ?? "").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{contact.prenom} {contact.nom}</p>
                        {contact.phone && <p className="text-[10px] text-muted-foreground truncate">{contact.phone}</p>}
                      </div>
                    </button>
                  ))}
                </>
              ) : filteredClients.length === 0 ? (
                <p className="px-4 py-3 text-[11px] text-muted-foreground italic">
                  {(clients ?? []).length === 0 ? "Aucun client enregistré" : "Aucun résultat"}
                </p>
              ) : (
                filteredClients.slice(0, 8).map(c => (
                  <button key={c.id} type="button" className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left"
                    onClick={() => {
                      if (c.type === "professionnel" && (c.contacts?.length ?? 0) > 0) {
                        setInlineSelectedCompany(c)
                      } else {
                        setSelectedClientId(c.id); setClientSearch(""); setClientFocused(false)
                      }
                    }}>
                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold flex-shrink-0">
                      {c.type === "particulier"
                        ? `${c.prenom?.[0] ?? ""}${c.nom?.[0] ?? ""}`.toUpperCase()
                        : (c.raisonSociale?.[0] ?? "").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.type === "particulier" ? `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() : (c.raisonSociale ?? "")}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {c.type === "professionnel"
                          ? `${c.contacts?.length ?? 0} passager${(c.contacts?.length ?? 0) !== 1 ? "s" : ""}`
                          : (c.phone ?? "")}
                      </p>
                    </div>
                    {c.type === "professionnel" && (c.contacts?.length ?? 0) > 0 && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Client sélectionné */}
          {selectedClient && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#242424] border border-gold/20 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedClient.type === "particulier"
                      ? `${selectedClient.prenom ?? ""} ${selectedClient.nom ?? ""}`.trim()
                      : (selectedClient.raisonSociale ?? "")}
                  </p>
                  <button
                    onClick={() => { setSelectedClientId(""); setPassagerNom(""); setPassagerTelephone(""); setPassengerSearch("") }}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Modifier
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">{selectedClient.phone ?? ""} • {selectedClient.email ?? ""}</p>
                {selectedClient.type === "professionnel" && selectedClient.siren && (
                  <p className="text-[11px] text-gold">SIREN : {selectedClient.siren}</p>
                )}
              </div>

              {/* Passager distinct pour les sociétés */}
              {selectedClient.type === "professionnel" && (
                <div className="space-y-2 pt-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Passager transporté <span className="text-muted-foreground/50 normal-case">(si différent du client payeur)</span>
                  </label>
                  {selectedClient.contacts && selectedClient.contacts.length > 0 && !passagerNom && (
                    <div className="space-y-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          value={passengerSearch}
                          onChange={e => setPassengerSearch(e.target.value)}
                          placeholder="Rechercher un passager existant..."
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                          style={{ fontSize: "16px" }}
                        />
                      </div>
                      {passengerSearch.trim() && (
                        <div className="rounded-xl bg-[#242424] border border-onyx-border/30 overflow-hidden">
                          {filteredPassengers.length > 0 ? filteredPassengers.map(contact => (
                            <button key={contact.id} type="button"
                              onClick={() => { setPassagerNom(`${contact.prenom ?? ""} ${contact.nom ?? ""}`.trim()); if (contact.phone) setPassagerTelephone(contact.phone); setPassengerSearch("") }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left border-b border-onyx-border/20 last:border-0">
                              <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[10px] font-bold shrink-0">
                                {(contact.prenom?.[0] ?? "").toUpperCase()}{(contact.nom?.[0] ?? "").toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{contact.prenom} {contact.nom}</p>
                                {contact.phone && <p className="text-[10px] text-muted-foreground truncate">{contact.phone}</p>}
                              </div>
                            </button>
                          )) : (
                            <p className="px-3 py-2.5 text-[11px] text-muted-foreground/60 italic">Aucun passager trouvé</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <input type="text" value={passagerNom} onChange={e => setPassagerNom(e.target.value)}
                    placeholder="Nom du passager"
                    className={inputClass()}
                    style={{ fontSize: "16px" }} />
                  <input type="tel" value={passagerTelephone} onChange={e => setPassagerTelephone(e.target.value)}
                    placeholder="Téléphone du passager"
                    className={inputClass()}
                    style={{ fontSize: "16px" }} />
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Section 3 — Trajet */}
        <Section title="Trajet" icon={Navigation}>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Adresse de départ <span className="text-red-500">*</span>
            </label>
            <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border focus-within:border-gold/50", errors.departure ? "border-red-500" : "border-onyx-border/30")}>
              <MapPin className="h-4 w-4 text-green-400 flex-shrink-0" strokeWidth={1.5} />
              <PlacesAutocomplete value={departure} onChange={v => { setDeparture(v); setDistanceKm(null); setDurationDisplay("") }}
                placeholder="Rechercher une adresse..."
                addressMode="full"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                style={{ fontSize: "16px" }} />
              {departure && <button type="button" onClick={() => { setDeparture(""); setDistanceKm(null); setDurationDisplay("") }} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="h-4 w-4" /></button>}
            </div>
            {errors.departure && <p className="text-xs text-red-500">{errors.departure}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Adresse d'arrivée <span className="text-red-500">*</span>
            </label>
            <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#242424] border focus-within:border-gold/50", errors.arrival ? "border-red-500" : "border-onyx-border/30")}>
              <MapPin className="h-4 w-4 text-red-400 flex-shrink-0" strokeWidth={1.5} />
              <PlacesAutocomplete value={arrival} onChange={v => { setArrival(v); setDistanceKm(null); setDurationDisplay("") }}
                placeholder="Rechercher une adresse..."
                addressMode="full"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                style={{ fontSize: "16px" }} />
              {arrival && <button type="button" onClick={() => { setArrival(""); setDistanceKm(null); setDurationDisplay("") }} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="h-4 w-4" /></button>}
            </div>
            {errors.arrival && <p className="text-xs text-red-500">{errors.arrival}</p>}
          </div>

          {departure && arrival && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void calculateDistance()}
                disabled={isCalculating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#242424] border border-onyx-border/30 text-[11px] text-muted-foreground hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50"
              >
                {isCalculating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
                Calculer la distance
              </button>
              {distanceKm !== null && (
                <p className="text-[11px] text-gold font-medium">
                  {distanceKm} km{durationDisplay ? ` · ${durationDisplay}` : ""}
                </p>
              )}
            </div>
          )}
        </Section>

        {/* Section 4 — Chauffeur & Véhicule */}
        <Section title="Chauffeur & Véhicule" icon={Car}>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Chauffeur <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDriverId}
              onChange={e => { setSelectedDriverId(e.target.value); setErrors(prev => { const er = { ...prev }; delete er.driver; return er }) }}
              className={cn("w-full px-3 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground focus:outline-none focus:border-gold/50", errors.driver ? "border-red-500" : "border-onyx-border/30")}
              style={{ fontSize: "16px" }}
            >
              <option value="" disabled>Sélectionner un chauffeur...</option>
              {(drivers ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {errors.driver && <p className="text-xs text-red-500">{errors.driver}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Véhicule <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedVehicleId}
              onChange={e => { setSelectedVehicleId(e.target.value); setErrors(prev => { const er = { ...prev }; delete er.vehicle; return er }) }}
              className={cn("w-full px-3 py-2.5 rounded-xl bg-[#242424] border text-sm text-foreground focus:outline-none focus:border-gold/50", errors.vehicle ? "border-red-500" : "border-onyx-border/30")}
              style={{ fontSize: "16px" }}
            >
              <option value="" disabled>Sélectionner un véhicule...</option>
              {(vehicles ?? []).map(v => <option key={v.id} value={v.id}>{v.marque ? `${v.marque} ` : ""}{v.modele} — {v.immatriculation}</option>)}
            </select>
            {errors.vehicle && <p className="text-xs text-red-500">{errors.vehicle}</p>}
          </div>
        </Section>

        {/* Section 5 — Tarif & Facturation */}
        <Section title="Tarif & Facturation" icon={Euro}>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Prix par trajet (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pricePerTrip}
              onChange={e => { setPricePerTrip(e.target.value); if (parseFloat(e.target.value) > 0) setErrors(prev => { const er = { ...prev }; delete er.price; return er }) }}
              placeholder="0.00"
              className={inputClass(errors.price)}
              style={{ fontSize: "16px" }}
            />
            <p className="text-[10px] text-muted-foreground">Prix convenu avec le client pour chaque trajet</p>
            {errors.price && <p className="text-xs text-red-500">{errors.price}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Mode de facturation <span className="text-red-500">*</span>
            </label>
            {([
              { value: "per_trip", label: "Un BC par trajet", desc: "Chaque course génère un bon de réservation" },
              { value: "monthly_invoice", label: "Facture groupée mensuelle", desc: "Tous les trajets du mois = 1 facture" },
              { value: "monthly_summary", label: "Bon mensuel récapitulatif", desc: "1 bon listant tous les trajets et horaires" },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBillingMode(opt.value)}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors",
                  billingMode === opt.value
                    ? "bg-gold/10 border-gold/40"
                    : "bg-[#242424] border-onyx-border/30 hover:border-gold/20"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center",
                  billingMode === opt.value ? "border-gold" : "border-muted-foreground/40"
                )}>
                  {billingMode === opt.value && <div className="w-2 h-2 rounded-full bg-gold" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Section 6 — Période */}
        <Section title="Période" icon={User}>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Date de début <span className="text-red-500">*</span>
            </label>
            <div className="overflow-hidden max-w-full">
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={e => { setStartDate(e.target.value); setErrors(prev => { const er = { ...prev }; delete er.startDate; return er }) }}
                className={cn(inputClass(errors.startDate), "max-w-full box-border")}
                style={{ fontSize: "16px" }}
              />
            </div>
            {errors.startDate && <p className="text-xs text-red-500">{errors.startDate}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Date de fin</label>
            <div className="overflow-hidden max-w-full">
              <input
                type="date"
                value={endDate}
                min={startDate || today}
                disabled={openEnded}
                onChange={e => setEndDate(e.target.value)}
                className={cn(inputClass(), "max-w-full box-border", openEnded && "opacity-40 cursor-not-allowed")}
                style={{ fontSize: "16px" }}
              />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <Checkbox
                checked={openEnded}
                onCheckedChange={v => { setOpenEnded(!!v); if (v) setEndDate("") }}
              />
              <span className="text-[11px] text-muted-foreground">Sans date de fin (contrat ouvert)</span>
            </label>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pays</label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className={inputClass()}
              style={{ fontSize: "16px" }}
            >
              <option value="FR">🇫🇷 France</option>
              <option value="BE">🇧🇪 Belgique</option>
              <option value="CH">🇨🇭 Suisse</option>
              <option value="LU">🇱🇺 Luxembourg</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox
              checked={excludeHolidays}
              onCheckedChange={v => setExcludeHolidays(!!v)}
            />
            <span className="text-[11px] text-muted-foreground">Exclure les jours fériés</span>
          </label>
        </Section>

        {/* Bouton Suivant */}
        <div className="px-0 pb-32 pt-2">
          <button
            type="button"
            onClick={handleNext}
            className="w-full py-4 rounded-2xl bg-gold text-black font-bold text-base active:scale-[0.98] transition-all"
          >
            Suivant — Configurer la récurrence →
          </button>
        </div>
      </div>

      {/* Modal "Voir tous les clients" */}
      {showAllClients && (
        <div className="fixed inset-0 z-[10000] bg-black/70 flex flex-col" onClick={() => setShowAllClients(false)}>
          <div className="mt-auto w-full max-h-[80vh] bg-[#1a1a1a] rounded-t-3xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2" />
            <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/20">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={modalClientSearch}
                  onChange={e => setModalClientSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#242424] border border-onyx-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50"
                  style={{ fontSize: "16px" }}
                  autoFocus
                />
              </div>
              <button onClick={() => setShowAllClients(false)} className="p-2 rounded-lg hover:bg-white/5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <p className="px-4 py-2 text-[10px] text-muted-foreground">
              {(clients ?? []).length} client{(clients ?? []).length !== 1 ? "s" : ""} enregistré{(clients ?? []).length !== 1 ? "s" : ""}
            </p>
            <div className="flex-1 overflow-y-auto divide-y divide-onyx-border/20 pb-4">
              {modalFilteredClients.length === 0 ? (
                <p className="px-4 py-4 text-[11px] text-muted-foreground italic">Aucun résultat</p>
              ) : modalFilteredClients.map(c => (
                <button key={c.id} type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left"
                  onClick={() => {
                    if (c.type === "professionnel" && (c.contacts?.length ?? 0) > 0) {
                      setInlineSelectedCompany(c)
                    } else {
                      setSelectedClientId(c.id)
                      setClientSearch("")
                    }
                    setShowAllClients(false)
                  }}>
                  <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold flex-shrink-0">
                    {c.type === "particulier"
                      ? `${c.prenom?.[0] ?? ""}${c.nom?.[0] ?? ""}`.toUpperCase()
                      : (c.raisonSociale?.[0] ?? "").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {c.type === "particulier" ? `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() : (c.raisonSociale ?? "")}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {c.type === "professionnel"
                        ? `${c.contacts?.length ?? 0} passager${(c.contacts?.length ?? 0) !== 1 ? "s" : ""}`
                        : (c.phone ?? "")}
                    </p>
                  </div>
                  {c.type === "professionnel" && (c.contacts?.length ?? 0) > 0 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout client */}
      <QuickAddClientModal
        open={showQuickAddClient}
        onClose={() => setShowQuickAddClient(false)}
        clients={clients ?? []}
        onClientCreated={(clientId) => {
          setSelectedClientId(clientId)
          setShowQuickAddClient(false)
        }}
      />
    </div>
  )
}

// ── RecurringScreen ───────────────────────────────────────────────────────────

interface RecurringScreenProps {
  onBack: () => void
}

export function RecurringScreen({ onBack }: RecurringScreenProps) {
  const supabase = createClient()
  const [contracts, setContracts] = useState<RecurringContract[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateContract, setShowCreateContract] = useState(false)

  async function loadContracts() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from("recurring_contracts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    setContracts((data as RecurringContract[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadContracts() }, [])

  return (
    <div className="flex flex-col h-full bg-background">
      {/* En-tête */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-onyx-border/30 bg-[#0d0d0d]">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-white/5">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Trajets Récurrents</h1>
          <p className="text-[10px] text-muted-foreground">Courses régulières planifiées</p>
        </div>
        <button
          onClick={() => setShowCreateContract(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold text-black text-[11px] font-bold hover:bg-gold/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Nouveau contrat
        </button>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-gold animate-spin" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-onyx-card border border-onyx-border/50 flex items-center justify-center mb-4">
              <RefreshCw className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Aucun trajet récurrent pour le moment.
            </p>
            <p className="text-[11px] text-muted-foreground mb-5">
              Créez votre premier contrat pour automatiser vos courses régulières.
            </p>
            <button
              onClick={() => setShowCreateContract(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold text-black text-sm font-semibold hover:bg-gold/90 transition-colors"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Créer un contrat
            </button>
          </div>
        ) : (
          contracts.map(contract => {
            const cfg = statusConfig[contract.status] ?? statusConfig.ended
            return (
              <div key={contract.id} className="p-4 rounded-2xl bg-[#1a1a1a] border border-onyx-border/30 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <RefreshCw className="h-4 w-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{contract.label || "Trajet sans nom"}</p>
                      {contract.passenger_name && (
                        <p className="text-[11px] text-muted-foreground truncate">{contract.passenger_name}</p>
                      )}
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", cfg.className)}>
                    {cfg.label}
                  </span>
                </div>
                <div className="pl-[52px] space-y-1">
                  <p className="text-[11px] text-muted-foreground truncate">{contract.departure} → {contract.arrival}</p>
                  <p className="text-[11px] text-gold font-medium">{formatRecurrence(contract.days_of_week, contract.time)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Formulaire pleine page */}
      {showCreateContract && (
        <div className="absolute inset-0 z-50 bg-background overflow-y-auto">
          <CreateRecurringContract
            onBack={() => setShowCreateContract(false)}
            onSuccess={() => {
              setShowCreateContract(false)
              void loadContracts()
            }}
          />
        </div>
      )}
    </div>
  )
}

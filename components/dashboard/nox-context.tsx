"use client"

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Driver, Vehicle, Client, EnterpriseProfile, TarifBase, TarifForfait, TarifSupplement, TrancheHoraire, TariffGrid,
  BCDocument, InvoiceDocument, InvoiceStatus, Plan,
  defaultTarifBase, defaultForfaits, defaultSupplements, defaultTranches,
  PLAN_LIMITS,
  TaxConfig, getTaxConfig, getVatMention, isVatApplicable, getLegalSellerIdentity,
} from "./data"

// Profil entreprise vide — chaque nouveau compte démarre sans données pré-remplies
const emptyEnterprise: EnterpriseProfile = {
  name: "",
  denomination: "",
  siren: "",
  tva: "",
  tvaIntra: "",
  evtcNumber: "",
  adresse: "",
  zipCode: "",
  city: "",
  pays: "",
  email: "",
  phone: "",
}

export interface UserProfile {
  prenom: string
  nom: string
  email: string
  phone: string
}

export interface TripRequest {
  id: string
  token: string
  expires_at: string
  used_at: string | null
  status: 'pending' | 'filled' | 'converted' | 'expired' | 'cancelled'
  passenger_civility: string | null
  passenger_firstname: string | null
  passenger_lastname: string | null
  passenger_phone: string | null
  passenger_email: string | null
  departure: string | null
  arrival: string | null
  stops: string[]
  trip_date: string | null
  trip_time: string | null
  passengers_count: number
  luggage_count: number
  notes: string | null
  language: string
  bc_id: string | null
  created_at: string
  updated_at: string
}

interface NoxContextType {
  enterprise: EnterpriseProfile
  userProfile: UserProfile
  refreshUserProfile: () => Promise<void>
  refreshInvoices: () => Promise<void>
  drivers: Driver[]
  vehicles: Vehicle[]
  clients: Client[]
  bcs: BCDocument[]
  invoices: InvoiceDocument[]
  tarifBase: TarifBase
  forfaits: TarifForfait[]
  supplements: TarifSupplement[]
  tranches: TrancheHoraire[]
  applyWeekend: boolean
  applyHolidays: boolean
  userId: string | null
  plan: Plan
  tokens: number
  subscriptionStatus: string
  trialEndsAt: string | null
  onboardingStatus: string
  driverCount: number
  vehicleCount: number
  upgrade: (target?: Plan) => void
  addTokens: (n: number) => void
  spendToken: () => boolean
  refreshTokens: () => Promise<void>
  legalProfile: {
    mustDisplayVatExemption: boolean
    mustDisplayVatNumber: boolean
    isInvoiceWithoutVat: boolean
    sellerLegalIdentity: string
    vatMention: string | null
    taxConfig: TaxConfig
  }
  validateDocumentCompliance: (draft: Partial<BCDocument>) => string[]
  updateEnterprise: (data: Partial<EnterpriseProfile>) => void
  addDriver: (driver: Driver) => void
  updateDriver: (id: string, data: Partial<Driver>) => void
  deleteDriver: (id: string) => void
  addVehicle: (vehicle: Vehicle) => void
  updateVehicle: (id: string, data: Partial<Vehicle>) => void
  deleteVehicle: (id: string) => void
  addClient: (client: Client) => Promise<string | null>
  updateClient: (id: string, data: Partial<Client>) => void
  deleteClient: (id: string) => void
  addBC: (bc: BCDocument) => Promise<{ id: string; numero: string } | null>
  updateBC: (id: string, data: Partial<BCDocument>) => void
  saveDraftBC: (data: Partial<BCDocument>) => Promise<string | null>
  deleteBC: (id: string) => Promise<void>
  addInvoice: (invoice: InvoiceDocument, consumeToken?: boolean) => Promise<boolean>
  updateInvoice: (id: string, data: Partial<InvoiceDocument>) => void
  deleteInvoice: (id: string) => void
  tariffGrids: TariffGrid[]
  addTariffGrid: (grid: TariffGrid) => void
  updateTariffGrid: (id: string, data: Partial<TariffGrid>) => void
  deleteTariffGrid: (id: string) => void
  updateTarifs: (base: TarifBase, forfaits: TarifForfait[], supplements: TarifSupplement[], tranches?: TrancheHoraire[], applyWeekend?: boolean, applyHolidays?: boolean) => void
  tariffSettings: {
    base: TarifBase
    forfaits: TarifForfait[]
    supplements: TarifSupplement[]
    tranches: TrancheHoraire[]
    applyWeekend: boolean
    applyHolidays: boolean
  }
  tripRequests: TripRequest[]
  loadTripRequests: () => Promise<void>
}

const NoxContext = createContext<NoxContextType | undefined>(undefined)

// Purge l'ancienne clé globale non-isolée si elle existe encore
function purgeGlobalStorageIfNeeded() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("nox_vtc_storage_v1")
  }
}

export function NoxProvider({ children }: { children: React.ReactNode }) {
  // Single stable Supabase browser client — avoids session desync across functions
  const supabase = useMemo(() => createClient(), [])

  const [isLoaded, setIsLoaded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // ─── Données métier : état initial VIDE pour tout nouveau compte ───
  const [enterprise, setEnterprise] = useState<EnterpriseProfile>(emptyEnterprise)
  const [userProfile, setUserProfile] = useState<UserProfile>({ prenom: "", nom: "", email: "", phone: "" })
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [bcs, setBcs] = useState<BCDocument[]>([])
  const [invoices, setInvoices] = useState<InvoiceDocument[]>([])

  const refreshUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("prenom_representant_legal, nom_representant_legal, telephone")
        .eq("user_id", user.id)
        .single()
      setUserProfile({
        email: user.email || "",
        prenom: data?.prenom_representant_legal || "",
        nom: data?.nom_representant_legal || "",
        phone: data?.telephone || ""
      })
    }
  }

  const refreshInvoices = useCallback(async () => {
    if (!userId) return
    const { data: dbInvoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
    if (dbInvoices) {
      setInvoices(dbInvoices.map(inv => ({
        id: inv.id,
        number: inv.numero || "",
        client: inv.client_nom || "",
        clientPhone: inv.client_telephone || undefined,
        amount: Number(inv.montant_ttc) || 0,
        amountHT: inv.montant_ht != null ? Number(inv.montant_ht) : undefined,
        tva: inv.tva != null ? Number(inv.tva) : undefined,
        items: inv.items || undefined,
        baseHT: inv.base_ht != null ? Number(inv.base_ht) : undefined,
        supplementsHT: inv.supplements_ht != null ? Number(inv.supplements_ht) : undefined,
        tva10Amount: inv.tva_10_amount != null ? Number(inv.tva_10_amount) : undefined,
        tva20Amount: inv.tva_20_amount != null ? Number(inv.tva_20_amount) : undefined,
        tva55Amount: inv.tva_5_5_amount != null ? Number(inv.tva_5_5_amount) : undefined,
        tvaOtherAmount: inv.tva_other_amount != null ? Number(inv.tva_other_amount) : undefined,
        discountValue: inv.discount_value != null ? Number(inv.discount_value) : undefined,
        discountType: inv.discount_type || undefined,
        originalHT: inv.original_ht != null ? Number(inv.original_ht) : undefined,
        originalTTC: inv.original_ttc != null ? Number(inv.original_ttc) : undefined,
        date: inv.date_emission ? new Date(inv.date_emission).toLocaleDateString("fr-FR") : "",
        echeance: inv.echeance ? new Date(inv.echeance).toLocaleDateString("fr-FR") : "",
        status: (inv.status as InvoiceStatus) || "brouillon",
        type: "facture" as const,
        bcRef: inv.bc_ref || "",
        driverName: inv.driver_nom || undefined,
        driverPhone: inv.driver_phone || undefined,
        driverCarteVTC: inv.driver_carte_vtc || undefined,
        vehicleName: inv.vehicle_nom || undefined,
        vehiclePlate: inv.vehicle_immatriculation || undefined,
        vehicleTypeEnergie: inv.vehicle_type_energie || undefined,
        passagerNom: inv.passager_nom || undefined,
        passagerTelephone: inv.passager_telephone || undefined,
        clientType: inv.client_type || undefined,
        clientSiren: inv.client_siren || undefined,
        clientAddress: inv.client_address || undefined,
        supplementsList: Array.isArray(inv.supplements_list) ? inv.supplements_list : undefined,
        trajet: inv.trajet || undefined,
        notes: inv.notes || undefined,
        cgvText: inv.cgv_text || undefined,
      })))
    }
  }, [userId, supabase])

  // ─── Config fonctionnelle : valeurs par défaut système (tarification) ───
  const [tariffGrids, setTariffGrids] = useState<TariffGrid[]>([])
  const [tarifBase, setTarifBase] = useState<TarifBase>(defaultTarifBase)
  const [forfaits, setForfaits] = useState<TarifForfait[]>(defaultForfaits)
  const [supplements, setSupplements] = useState<TarifSupplement[]>(defaultSupplements)
  const [tranches, setTranches] = useState<TrancheHoraire[]>(defaultTranches)
  const [applyWeekend, setApplyWeekend] = useState(true)
  const [applyHolidays, setApplyHolidays] = useState(true)
  const [plan, setPlan] = useState<Plan>("SOLO")
  const [tokens, setTokens] = useState(0)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("active")
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [onboardingStatus, setOnboardingStatus] = useState("not_started")
  const [tripRequests, setTripRequests] = useState<TripRequest[]>([])

  // ─── Étape 1 : Récupérer l'utilisateur connecté, puis charger SES données ───
  useEffect(() => {
    let isMounted = true

    async function initStore() {
      purgeGlobalStorageIfNeeded()

      const { data: { user } } = await supabase.auth.getUser()

      if (!isMounted) return
      if (!user) {
        // Pas de session — on ne charge rien, on reste vide
        setIsLoaded(true)
        return
      }

      const uid = user.id
      setUserId(uid)

      // Plan depuis subscriptions (source de vérité absolue)
      try {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan, status, trial_ends_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (sub?.plan) setPlan(sub.plan as Plan)
        if (sub?.status) setSubscriptionStatus(sub.status)
        if (sub?.trial_ends_at) setTrialEndsAt(sub.trial_ends_at)
      } catch (err) {}

      // Solde de jetons depuis wallets (source de vérité absolue)
      try {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", uid)
          .single()
        if (wallet) setTokens(wallet.balance ?? 0)
      } catch (err) {}

      await refreshUserProfile()

      try {
        const { data: entProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", uid)
          .single()
          
        if (entProfile) {
          setEnterprise(prev => ({
            ...prev,
            name: entProfile.nom_entreprise || prev.name,
            denomination: entProfile.nom_entreprise || prev.denomination,
            siren: entProfile.siret || prev.siren,
            tva: entProfile.tva || prev.tva,
            tvaIntra: entProfile.tva || prev.tvaIntra,
            // BUG 1 FIX — evtcNumber lu depuis registre_vtc (jamais stocké dans bcs)
            evtcNumber: entProfile.registre_vtc || prev.evtcNumber,
            registreVTC: entProfile.registre_vtc || prev.registreVTC,
            dateRegistre: entProfile.date_registre_vtc || prev.dateRegistre,
            dateAssurance: entProfile.date_assurance_pro || prev.dateAssurance,
            adresse: entProfile.adresse || prev.adresse,
            bankName: entProfile.banque || prev.bankName,
            iban: entProfile.iban || prev.iban,
            bic: entProfile.bic || prev.bic,
            logo: entProfile.logo_url || prev.logo,
            brandColor: entProfile.brand_color || prev.brandColor,
            statutJuridique: entProfile.statut_juridique || prev.statutJuridique,
            prenomRepresentantLegal: entProfile.prenom_representant_legal || prev.prenomRepresentantLegal,
            nomRepresentantLegal: entProfile.nom_representant_legal || prev.nomRepresentantLegal,
            zipCode: entProfile.code_postal || prev.zipCode,
            city: entProfile.ville || prev.city,
            complementAdresse: entProfile.complement_adresse || prev.complementAdresse,
            pays: entProfile.pays || prev.pays,
            cgvMode: entProfile.cgv_mode || prev.cgvMode,
            cgvConfig: entProfile.cgv_config || prev.cgvConfig,
            cgvText: entProfile.cgv_text || prev.cgvText,
            isMicroEntrepreneur: entProfile.is_micro_entrepreneur ?? false,
            vatMode: (entProfile.vat_mode as 'franchise' | 'normal') || undefined,
            vatExemptionMention: entProfile.vat_exemption_mention || undefined,
            legalNoticeText: entProfile.legal_notice_text || undefined,
          }))
        }
      } catch (err) {
        console.warn("[NoxStore] Could not load backend data", err)
      }

      // ─── Chargement Drivers (Supabase) ───
      try {
        const { data: dbDrivers, error: drvErr } = await supabase
          .from("drivers")
          .select("*")
          .eq("user_id", uid)
        if (dbDrivers) {
          setDrivers(dbDrivers.map(d => {
            // Reconstituer name depuis prenom + nom (source de vérité SQL)
            const fullNameDb = [d.prenom, d.nom].filter(Boolean).join(' ')
            const displayName = fullNameDb || d.name || ''
            const nameParts = displayName.trim().split(' ')
            const initials = nameParts.length >= 2
              ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
              : displayName.substring(0, 2).toUpperCase()
            return {
              id: d.id,
              name: displayName,
              initials,
              online: d.actif || false,
              carteProExpiration: d.date_expiration_carte_vtc || '',
              carteProNumber: d.numero_carte_vtc || '',
              apacExpiration: d.date_expiration_apac || '',
              apacNumber: d.numero_apac || '',
              rcProExpiration: d.date_expiration_rc_pro || '',
              rcProNumber: d.numero_rc_pro || '',
              phone: d.telephone || '',
              email: d.email || '',
              permisNumber: d.numero_permis || '',
              permisExpiration: d.date_expiration_permis || ''
            }
          }))
        }
      } catch (err) {
      }

      // ─── Chargement Vehicles (Supabase) ───
      try {
        const { data: dbVehicles, error: vehErr } = await supabase
          .from("vehicles")
          .select("*")
          .eq("user_id", uid)
        if (dbVehicles) {
          setVehicles(dbVehicles.map(v => ({
            id: v.id,
            marque: v.marque || "",
            modele: v.modele || "",
            immatriculation: v.immatriculation || "",
            inService: v.in_service || false,
            date_mise_en_circulation: v.date_mise_en_circulation || "",
            type_energie: v.type_energie,
            category: v.category,
            color: v.color || "",
            assuranceTransportExpiration: v.assurance_transport_expiration || "",
            controleTechniqueExpiration: v.controle_technique_expiration || ""
          })))
        }
      } catch (err) {
      }

      // ─── Chargement Clients (Supabase) ───
      try {
        const { data: dbClients, error: cliErr } = await supabase
          .from("clients")
          .select("*")
          .eq("user_id", uid)
        if (dbClients) {
          setClients(dbClients.map(c => ({
            id: c.id,
            type: c.type || "particulier",
            civilite: c.civilite || "M.",
            prenom: c.prenom || "",
            nom: c.nom || "",
            raisonSociale: c.raison_sociale || "",
            siren: c.siren || "",
            tvaIntra: c.tva_intra || "",
            phone: c.telephone || "",
            email: c.email || "",
            billingAddress: {
              rue: c.adresse || "",
              codePostal: c.code_postal || "",
              ville: c.ville || "",
              pays: c.pays || "",
            },
            contacts: c.contacts || [],
            notes: c.notes || "",
            tag: c.tag || "",
            trips: c.trips || 0,
            lastTrip: c.last_trip || "",
            tripHistory: [],
            preferences: c.preferences || "",
          })))
        }
      } catch (err) {
      }

      // ─── Chargement BCs (Supabase) ───
      try {
        const { data: dbBcs, error: bcsErr } = await supabase
          .from("bcs")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
        if (dbBcs) {
          setBcs(dbBcs.map(b => ({
            id: b.id,
            number: b.numero || "",
            clientId: b.client_id || undefined,
            driverId: b.driver_id || undefined,
            client: b.client_nom || "",
            clientPhone: b.client_telephone || undefined,
            passagerNom: b.passager_nom || undefined,
            passagerTelephone: b.passager_telephone || undefined,
            amount: Number(b.montant_ttc) || 0,
            amountHT: Number(b.montant_ht) || 0,
            tva: Number(b.tva) || 0,
            baseHT: Number(b.base_ht) || 0,
            supplementsHT: Number(b.supplements_ht) || 0,
            tva10Amount: Number(b.tva_10_amount) || 0,
            tva20Amount: Number(b.tva_20_amount) || 0,
            tvaRate: b.tva_rate ?? undefined,
            discountValue: Number(b.discount_value) || 0,
            discountType: b.discount_type || "percent",
            originalHT: Number(b.original_ht) || 0,
            originalTTC: Number(b.original_ttc) || 0,
            supplementsList: b.supplements_list ?? undefined,
            date: b.date_emission
              ? new Date(b.date_emission).toLocaleDateString("fr-FR")
              : "",
            status: b.status || "en_attente",
            type: "bc",
            trajet: b.trajet ?? undefined,
            driverName: b.driver_nom || undefined,
            driverPhone: b.driver_telephone || undefined,
            driverCarteVTC: b.driver_carte_vtc || undefined,
            vehicleId: b.vehicle_id || undefined,
            vehicleName: b.vehicle_nom || undefined,
            vehiclePlate: b.vehicle_immatriculation || undefined,
            notes: b.notes || undefined,
            cgvText: b.cgv_text || undefined,
            cgvInclure: b.cgv_inclure ?? true,
            customerAcceptedAt: b.customer_accepted_at || undefined,
            cgvVersionAccepted: b.cgv_version_accepted || undefined,
            signatairesNom: b.signataire_nom || undefined,
            acceptanceMention: b.acceptance_mention || undefined,
            mode_horaire: (b.mode_horaire as 'depart' | 'arrivee') || 'depart',
            heure_arrivee_souhaitee: b.heure_arrivee_souhaitee || null,
          })))
        }
      } catch (err) {
      }

      // ─── Chargement Invoices (Supabase) ───
      try {
        const { data: dbInvoices } = await supabase
          .from("invoices")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
        if (dbInvoices) {
          setInvoices(dbInvoices.map(inv => ({
            id: inv.id,
            number: inv.numero || "",
            // Lien BC source
            bcId: inv.bc_id || undefined,
            bcRef: inv.bc_ref || "",
            // Client
            clientId: inv.client_id || undefined,
            client: inv.client_nom || "",
            clientPhone: inv.client_telephone || undefined,
            clientType: inv.client_type || undefined,
            clientSiren: inv.client_siren || undefined,
            clientAddress: inv.client_address || undefined,
            // Passager
            passagerNom: inv.passager_nom || undefined,
            passagerTelephone: inv.passager_telephone || undefined,
            // Chauffeur
            driverId: inv.driver_id || undefined,
            driverName: inv.driver_nom || undefined,
            driverPhone: inv.driver_phone || undefined,
            driverCarteVTC: inv.driver_carte_vtc || undefined,
            // Véhicule
            vehicleId: inv.vehicle_id || undefined,
            vehicleName: inv.vehicle_nom || undefined,
            vehiclePlate: inv.vehicle_immatriculation || undefined,
            vehicleTypeEnergie: inv.vehicle_type_energie || undefined,
            // Montants
            amount: Number(inv.montant_ttc) || 0,
            amountHT: inv.montant_ht != null ? Number(inv.montant_ht) : undefined,
            tva: inv.tva != null ? Number(inv.tva) : undefined,
            tvaRate: inv.tva_rate != null ? Number(inv.tva_rate) : undefined,
            tvaMode: inv.tva_mode || undefined,
            items: inv.items || undefined,
            baseHT: inv.base_ht != null ? Number(inv.base_ht) : undefined,
            supplementsHT: inv.supplements_ht != null ? Number(inv.supplements_ht) : undefined,
            tva10Amount: inv.tva_10_amount != null ? Number(inv.tva_10_amount) : undefined,
            tva20Amount: inv.tva_20_amount != null ? Number(inv.tva_20_amount) : undefined,
            tva55Amount: inv.tva_5_5_amount != null ? Number(inv.tva_5_5_amount) : undefined,
            tvaOtherAmount: inv.tva_other_amount != null ? Number(inv.tva_other_amount) : undefined,
            discountValue: inv.discount_value != null ? Number(inv.discount_value) : undefined,
            discountType: inv.discount_type || undefined,
            originalHT: inv.original_ht != null ? Number(inv.original_ht) : undefined,
            originalTTC: inv.original_ttc != null ? Number(inv.original_ttc) : undefined,
            // Divers
            date: inv.date_emission ? new Date(inv.date_emission).toLocaleDateString("fr-FR") : "",
            echeance: inv.echeance ? new Date(inv.echeance).toLocaleDateString("fr-FR") : "",
            status: (inv.status as InvoiceStatus) || "brouillon",
            type: "facture" as const,
            supplementsList: Array.isArray(inv.supplements_list) ? inv.supplements_list : undefined,
            trajet: inv.trajet || undefined,
            notes: inv.notes || undefined,
            cgvText: inv.cgv_text || undefined,
          })))
        }
      } catch (err) {
      }

      // ─── Chargement Tariffs (Supabase) ───
      try {
        const { data: dbTariffs } = await supabase
          .from("tariffs")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: true })
        if (dbTariffs && dbTariffs.length > 0) {
          const grids: TariffGrid[] = dbTariffs.map(row => ({
            id: row.id,
            name: row.name || "default",
            baseRate: Number(row.base_rate) || defaultTarifBase.priseEnCharge,
            perKm: Number(row.per_km) || defaultTarifBase.prixKm,
            perHour: Number(row.per_hour) || defaultTarifBase.prixAttente,
            courseMinimum: row.forfaits?.courseMinimum ?? defaultTarifBase.courseMinimum,
            supplements: Array.isArray(row.supplements) ? row.supplements : [],
            forfaits: Array.isArray(row.forfaits?.items) ? row.forfaits.items : [],
            tranches: Array.isArray(row.forfaits?.tranches) ? row.forfaits.tranches : defaultTranches,
            applyWeekend: row.forfaits?.applyWeekend ?? true,
            applyHolidays: row.forfaits?.applyHolidays ?? true,
            isDefault: row.is_default ?? false,
          }))
          setTariffGrids(grids)
          const defaultGrid = grids.find(g => g.isDefault) || grids[0]
          setTarifBase({
            priseEnCharge: defaultGrid.baseRate,
            prixKm: defaultGrid.perKm,
            prixAttente: defaultGrid.perHour,
            courseMinimum: defaultGrid.courseMinimum,
          })
          if (defaultGrid.supplements.length > 0) setSupplements(defaultGrid.supplements)
          if (defaultGrid.forfaits.length > 0) setForfaits(defaultGrid.forfaits)
          if (defaultGrid.tranches.length > 0) setTranches(defaultGrid.tranches)
          setApplyWeekend(defaultGrid.applyWeekend)
          setApplyHolidays(defaultGrid.applyHolidays)
        }
      } catch (err) {
      }

      // ─── Chargement TripRequests ───
      try {
        const { data: dbTripRequests } = await supabase
          .from("trip_requests")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(100)
        if (dbTripRequests) setTripRequests(dbTripRequests as TripRequest[])
      } catch (err) {}

      setIsLoaded(true)
    }

    initStore()

    // Keep userId in sync if the session is refreshed or revoked outside this component
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      setUserId(session?.user?.id ?? null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  // Polling post-paiement Stripe : ?refresh=1 dans l'URL signale un retour de checkout
  const stripeReturnRef = useRef(
    typeof window !== 'undefined' && window.location.search.includes('refresh=1')
  )

  useEffect(() => {
    if (!stripeReturnRef.current || !isLoaded || !userId) return
    stripeReturnRef.current = false
    window.history.replaceState({}, '', '/')

    let attempts = 0
    const poll = async () => {
      attempts++
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', userId)
        .single()
      if (sub?.plan && sub.plan !== 'SOLO') {
        setPlan(sub.plan as Plan)
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', userId)
          .single()
        if (wallet) setTokens(wallet.balance ?? 0)
      } else if (attempts < 5) {
        setTimeout(poll, 1500)
      }
    }
    setTimeout(poll, 500)
  }, [isLoaded, userId, supabase])

  // ─── Mutations données métier ───
  const updateEnterprise = async (data: Partial<EnterpriseProfile>) => {
    try {
      if (!userId) {
        return
      }

      // Map safely using defaults to avoid injecting undefined/inconsistent shapes into DB
      const dbPayload = {
        user_id: userId,
        nom_entreprise: data.name !== undefined ? (data.name || null) : (enterprise.name || null),
        siret: data.siren !== undefined ? (data.siren || null) : (enterprise.siren || null),
        tva: data.tva !== undefined ? (data.tva || null) : (enterprise.tva || null),
        adresse: data.adresse !== undefined ? (data.adresse || null) : (enterprise.adresse || null),
        banque: data.bankName !== undefined ? (data.bankName || null) : (enterprise.bankName || null),
        iban: data.iban !== undefined ? (data.iban || null) : (enterprise.iban || null),
        bic: data.bic !== undefined ? (data.bic || null) : (enterprise.bic || null),
        registre_vtc: data.registreVTC !== undefined ? (data.registreVTC || null) : (enterprise.registreVTC || null),
        date_registre_vtc: data.dateRegistre !== undefined ? (data.dateRegistre || null) : (enterprise.dateRegistre || null),
        date_assurance_pro: data.dateAssurance !== undefined ? (data.dateAssurance || null) : (enterprise.dateAssurance || null),
        logo_url: data.logo !== undefined ? (data.logo || null) : (enterprise.logo || null),
        brand_color: data.brandColor !== undefined ? (data.brandColor || null) : (enterprise.brandColor || null),
        statut_juridique: data.statutJuridique !== undefined ? (data.statutJuridique || null) : (enterprise.statutJuridique || null),
        prenom_representant_legal: data.prenomRepresentantLegal !== undefined ? (data.prenomRepresentantLegal || null) : (enterprise.prenomRepresentantLegal || null),
        nom_representant_legal: data.nomRepresentantLegal !== undefined ? (data.nomRepresentantLegal || null) : (enterprise.nomRepresentantLegal || null),
        code_postal: data.zipCode !== undefined ? (data.zipCode || null) : (enterprise.zipCode || null),
        ville: data.city !== undefined ? (data.city || null) : (enterprise.city || null),
        complement_adresse: data.complementAdresse !== undefined ? (data.complementAdresse || null) : (enterprise.complementAdresse || null),
        pays: data.pays !== undefined ? (data.pays || null) : (enterprise.pays || null),
        cgv_mode: data.cgvMode !== undefined ? (data.cgvMode || null) : (enterprise.cgvMode || null),
        cgv_config: data.cgvConfig !== undefined ? (data.cgvConfig || null) : (enterprise.cgvConfig || null),
        cgv_text: data.cgvText !== undefined ? (data.cgvText || null) : (enterprise.cgvText || null),
        is_micro_entrepreneur: data.isMicroEntrepreneur !== undefined ? data.isMicroEntrepreneur : (enterprise.isMicroEntrepreneur ?? false),
        vat_mode: data.vatMode !== undefined ? (data.vatMode || null) : (enterprise.vatMode || null),
        vat_exemption_mention: data.vatExemptionMention !== undefined ? (data.vatExemptionMention || null) : (enterprise.vatExemptionMention || null),
        legal_notice_text: data.legalNoticeText !== undefined ? (data.legalNoticeText || null) : (enterprise.legalNoticeText || null),
      }

      const { data: dbData, error } = await supabase
        .from('profiles')
        .upsert(dbPayload, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) {
        return
      }

      // Atomically rebuild state with strict shape from DB only (no partial injections)
      // This eliminates the root cause of the crash which occurred if spreading `data` corrupted the object
      if (dbData) {
        setEnterprise(prev => {
          const freshState = {
            ...prev,
            name: dbData.nom_entreprise || "",
            denomination: dbData.nom_entreprise || "",
            siren: dbData.siret || "",
            tva: dbData.tva || "",
            tvaIntra: dbData.tva || "",
            // BUG 1 FIX — evtcNumber lu depuis registre_vtc
            evtcNumber: dbData.registre_vtc || prev.evtcNumber || "",
            registreVTC: dbData.registre_vtc || "",
            dateRegistre: dbData.date_registre_vtc || "",
            dateAssurance: dbData.date_assurance_pro || "",
            adresse: dbData.adresse || "",
            bankName: dbData.banque || "",
            iban: dbData.iban || "",
            bic: dbData.bic || "",
            logo: dbData.logo_url || "",
            brandColor: dbData.brand_color || "",
            statutJuridique: dbData.statut_juridique || "",
            prenomRepresentantLegal: dbData.prenom_representant_legal || "",
            nomRepresentantLegal: dbData.nom_representant_legal || "",
            zipCode: dbData.code_postal || "",
            city: dbData.ville || "",
            complementAdresse: dbData.complement_adresse || "",
            pays: dbData.pays || "",
            cgvMode: dbData.cgv_mode || prev.cgvMode,
            cgvConfig: dbData.cgv_config || prev.cgvConfig,
            cgvText: dbData.cgv_text || prev.cgvText,
            isMicroEntrepreneur: dbData.is_micro_entrepreneur ?? prev.isMicroEntrepreneur ?? false,
            vatMode: (dbData.vat_mode as 'franchise' | 'normal') || prev.vatMode,
            vatExemptionMention: dbData.vat_exemption_mention || prev.vatExemptionMention,
            legalNoticeText: dbData.legal_notice_text || prev.legalNoticeText,
          }
          return freshState
        })
      }
    } catch (e) {
    }
  }
  const addDriver = async (driver: Driver) => {
    if (!userId) {
      return
    }

    // ─── Extraction prenom / nom depuis driver.name (split sur le premier espace) ───
    // La colonne prenom est NOT NULL dans public.drivers
    const fullName = (driver.name || '').trim()
    const spaceIdx = fullName.indexOf(' ')
    const prenom = spaceIdx >= 0 ? fullName.substring(0, spaceIdx).trim() : fullName
    const nom    = spaceIdx >= 0 ? fullName.substring(spaceIdx + 1).trim() : ''

    // Colonnes réelles de public.drivers (schéma exact)
    const payloadFinal = {
      user_id: userId,
      prenom: prenom || null,                                          // NOT NULL
      nom: nom || null,                                                // NOT NULL (peut être vide si prénom seul)
      name: fullName || null,                                          // colonne name optionnelle
      actif: driver.online ?? false,
      telephone: driver.phone || null,
      email: driver.email || null,
      numero_carte_vtc: driver.carteProNumber || null,
      date_expiration_carte_vtc: driver.carteProExpiration || null,
      numero_apac: driver.apacNumber || null,
      date_expiration_apac: driver.apacExpiration || null,
      numero_permis: driver.permisNumber || null,
      date_expiration_permis: driver.permisExpiration || null,
      numero_rc_pro: driver.rcProNumber || null,
      date_expiration_rc_pro: driver.rcProExpiration || null,
    }
    try {
      // ─── INSERT minimal sans .select() ───
      const { error } = await supabase
        .from('drivers')
        .insert([payloadFinal])

      if (error) {
        return
      }

      // ─── Reload complet de la liste depuis Supabase ───
      const { data: rows } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userId)

      if (rows) {
        setDrivers(rows.map(d => {
          // Reconstituer name depuis prenom + nom (source de vérité SQL)
          const fullNameDb = [d.prenom, d.nom].filter(Boolean).join(' ')
          const nameParts = fullNameDb.trim().split(' ')
          const initials = nameParts.length >= 2
            ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
            : fullNameDb.substring(0, 2).toUpperCase()
          return {
            id: d.id,
            name: fullNameDb || d.name || '',
            initials,
            online: d.actif || false,
            carteProExpiration: d.date_expiration_carte_vtc || '',
            carteProNumber: d.numero_carte_vtc || '',
            apacExpiration: d.date_expiration_apac || '',
            apacNumber: d.numero_apac || '',
            rcProExpiration: d.date_expiration_rc_pro || '',
            rcProNumber: d.numero_rc_pro || '',
            phone: d.telephone || '',
            email: d.email || '',
            permisNumber: d.numero_permis || '',
            permisExpiration: d.date_expiration_permis || ''
          }
        }))
      }
    } catch (e) {
    }
  }

  const updateDriver = async (id: string, data: Partial<Driver>) => {
    if (!userId) return
    // ─── Extraction prenom / nom si name est mis à jour ───
    const payload: any = {}
    if (data.name !== undefined) {
      const fullName = (data.name || '').trim()
      const spaceIdx = fullName.indexOf(' ')
      payload.prenom = spaceIdx >= 0 ? fullName.substring(0, spaceIdx).trim() : fullName
      payload.nom    = spaceIdx >= 0 ? fullName.substring(spaceIdx + 1).trim() : ''
      payload.name   = fullName || null
    }
    // initials n'existe pas en base — ignoré
    if (data.online !== undefined) payload.actif = data.online
    if (data.carteProExpiration !== undefined) payload.date_expiration_carte_vtc = data.carteProExpiration || null
    if (data.carteProNumber !== undefined) payload.numero_carte_vtc = data.carteProNumber || null
    if (data.apacExpiration !== undefined) payload.date_expiration_apac = data.apacExpiration || null
    if (data.apacNumber !== undefined) payload.numero_apac = data.apacNumber || null
    if (data.rcProExpiration !== undefined) payload.date_expiration_rc_pro = data.rcProExpiration || null
    if (data.rcProNumber !== undefined) payload.numero_rc_pro = data.rcProNumber || null
    if (data.phone !== undefined) payload.telephone = data.phone || null
    if (data.email !== undefined) payload.email = data.email || null
    if (data.permisNumber !== undefined) payload.numero_permis = data.permisNumber || null
    if (data.permisExpiration !== undefined) payload.date_expiration_permis = data.permisExpiration || null

    try {
      const { data: dbData, error } = await supabase.from('drivers').update(payload).eq('id', id).eq('user_id', userId).select().single()
      if (error) {
        return
      }
      if (dbData) {
        setDrivers(prev => prev.map(d => d.id === id ? { ...d, ...data } : d))
      }
    } catch (e) {
    }
  }

  const deleteDriver = async (id: string) => {
    if (!userId) return
    try {
      const { error } = await supabase.from('drivers').delete().eq('id', id).eq('user_id', userId)
      if (error) {
        return
      }
      setDrivers(prev => prev.filter(d => d.id !== id))
    } catch (e) {
    }
  }

  const addVehicle = async (vehicle: Vehicle) => {
    if (!userId) {
      return
    }

    const payloadFinal = {
      user_id: userId,
      marque: vehicle.marque || null,
      modele: vehicle.modele || null,
      immatriculation: vehicle.immatriculation || null,
      in_service: vehicle.inService || false,
      date_mise_en_circulation: vehicle.date_mise_en_circulation || null,
      type_energie: vehicle.type_energie || null,
      category: vehicle.category || null,
      color: vehicle.color || null,
      assurance_transport_expiration: vehicle.assuranceTransportExpiration || null,
      controle_technique_expiration: vehicle.controleTechniqueExpiration || null
    }
    try {
      // ─── INSERT minimal sans .select() ───
      const { error } = await supabase
        .from('vehicles')
        .insert([payloadFinal])

      if (error) {
        return
      }

      // ─── Reload complet de la liste depuis Supabase ───
      const { data: rows } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)

      if (rows) {
        setVehicles(rows.map(v => ({
          id: v.id,
          marque: v.marque || '',
          modele: v.modele || '',
          immatriculation: v.immatriculation || '',
          inService: v.in_service || false,
          date_mise_en_circulation: v.date_mise_en_circulation || '',
          type_energie: v.type_energie as any,
          category: v.category as any,
          color: v.color || '',
          assuranceTransportExpiration: v.assurance_transport_expiration || '',
          controleTechniqueExpiration: v.controle_technique_expiration || ''
        })))
      }
    } catch (e) {
    }
  }

  const updateVehicle = async (id: string, data: Partial<Vehicle>) => {
    if (!userId) return
    const payload: any = {}
    if (data.marque !== undefined) payload.marque = data.marque || null
    if (data.modele !== undefined) payload.modele = data.modele || null
    if (data.immatriculation !== undefined) payload.immatriculation = data.immatriculation || null
    if (data.inService !== undefined) payload.in_service = data.inService
    if (data.date_mise_en_circulation !== undefined) payload.date_mise_en_circulation = data.date_mise_en_circulation || null
    if (data.type_energie !== undefined) payload.type_energie = data.type_energie || null
    if (data.category !== undefined) payload.category = data.category || null
    if (data.color !== undefined) payload.color = data.color || null
    if (data.assuranceTransportExpiration !== undefined) payload.assurance_transport_expiration = data.assuranceTransportExpiration || null
    if (data.controleTechniqueExpiration !== undefined) payload.controle_technique_expiration = data.controleTechniqueExpiration || null

    try {
      const { data: dbData, error } = await supabase.from('vehicles').update(payload).eq('id', id).eq('user_id', userId).select().single()
      if (error) {
        return
      }
      if (dbData) {
        setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...data } : v))
      }
    } catch (e) {
    }
  }

  const deleteVehicle = async (id: string) => {
    if (!userId) return
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', id).eq('user_id', userId)
      if (error) {
        return
      }
      setVehicles(prev => prev.filter(v => v.id !== id))
    } catch (e) {
    }
  }
  const addClient = async (client: Client): Promise<string | null> => {
    try {
      if (!userId) {
        return null
      }

      const { data: c, error } = await supabase
        .from("clients")
        .insert([{
          user_id: userId,
          type: client.type || "particulier",
          civilite: client.civilite || null,
          nom: client.nom || null,
          prenom: client.prenom || null,
          raison_sociale: client.raisonSociale || null,
          siren: client.siren || null,
          tva_intra: client.tvaIntra || null,
          email: client.email || null,
          telephone: client.phone || null,
          adresse: client.billingAddress?.rue || null,
          code_postal: client.billingAddress?.codePostal || null,
          ville: client.billingAddress?.ville || null,
          pays: client.billingAddress?.pays || null,
          contacts: client.contacts ?? [],
          notes: client.notes || null,
          tag: client.tag || null,
          preferences: client.preferences || null,
        }])
        .select()
        .single()

      if (error) {
        return null
      }

      setClients(prev => [...prev, {
        id: c.id,
        type: c.type || "particulier",
        civilite: c.civilite || "M.",
        prenom: c.prenom || "",
        nom: c.nom || "",
        raisonSociale: c.raison_sociale || "",
        siren: c.siren || "",
        tvaIntra: c.tva_intra || "",
        phone: c.telephone || "",
        email: c.email || "",
        billingAddress: {
          rue: c.adresse || "",
          codePostal: c.code_postal || "",
          ville: c.ville || "",
          pays: c.pays || "",
        },
        contacts: c.contacts || [],
        notes: c.notes || "",
        tag: c.tag || "",
        trips: c.trips || 0,
        lastTrip: c.last_trip || "",
        tripHistory: [],
        preferences: c.preferences || "",
      }])

      return c.id
    } catch (e) {
      return null
    }
  }

  const updateClient = async (id: string, data: Partial<Client>) => {
    if (!userId) return
    const payload: any = {}
    if (data.civilite !== undefined) payload.civilite = data.civilite || null
    if (data.nom !== undefined) payload.nom = data.nom || null
    if (data.prenom !== undefined) payload.prenom = data.prenom || null
    if (data.raisonSociale !== undefined) payload.raison_sociale = data.raisonSociale || null
    if (data.phone !== undefined) payload.telephone = data.phone || null
    if (data.email !== undefined) payload.email = data.email || null
    if (data.notes !== undefined) payload.notes = data.notes || null
    if (data.preferences !== undefined) payload.preferences = data.preferences || null
    if (data.contacts !== undefined) payload.contacts = data.contacts || []
    if (data.tag !== undefined) payload.tag = data.tag || null
    if (data.billingAddress !== undefined) {
      payload.adresse = data.billingAddress.rue || null
      payload.code_postal = data.billingAddress.codePostal || null
      payload.ville = data.billingAddress.ville || null
      payload.pays = data.billingAddress.pays || null
    }
    try {
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", id)
        .eq("user_id", userId)
      if (error) {
        return
      }
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    } catch (e) {
    }
  }

  const deleteClient = async (id: string) => {
    if (!userId) return
    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
      if (error) {
        return
      }
      setClients(prev => prev.filter(c => c.id !== id))
    } catch (e) {
    }
  }

  const addBC = async (bc: BCDocument): Promise<{ id: string; numero: string } | null> => {
    if (!userId) return null
    const { data: numeroData } = await supabase.rpc('generate_bc_numero')
    const numero = numeroData as string
    const now = new Date()
    const payload = {
      user_id: userId,
      numero,
      status: bc.status || "en_attente",
      date_emission: now.toISOString().split("T")[0],
      client_id: bc.clientId || null,
      client_nom: bc.client || null,
      client_telephone: bc.clientPhone || null,
      passager_nom: bc.passagerNom || null,
      passager_telephone: bc.passagerTelephone || null,
      driver_id: bc.driverId || null,
      driver_nom: bc.driverName || null,
      driver_carte_vtc: bc.driverCarteVTC || null,
      vehicle_id: bc.vehicleId || null,
      vehicle_nom: bc.vehicleName || null,
      vehicle_immatriculation: bc.vehiclePlate || null,
      trajet: bc.trajet || {},
      montant_ht: bc.amountHT || 0,
      tva_rate: 10,
      tva: bc.tva || 0,
      montant_ttc: bc.amount || 0,
      base_ht: bc.baseHT || 0,
      supplements_ht: bc.supplementsHT || 0,
      tva_10_amount: bc.tva10Amount || 0,
      tva_20_amount: bc.tva20Amount || 0,
      discount_value: bc.discountValue || 0,
      discount_type: bc.discountType || "percent",
      original_ht: bc.originalHT || 0,
      original_ttc: bc.originalTTC || 0,
      supplements_list: bc.supplementsList || [],
      notes: bc.notes || null,
      cgv_text: bc.cgvText || null,
      cgv_inclure: bc.cgvInclure !== undefined ? bc.cgvInclure : true,
      mode_horaire: bc.mode_horaire || 'depart',
      heure_arrivee_souhaitee: bc.heure_arrivee_souhaitee || null,
    }
    try {
      const { data, error } = await supabase
        .from("bcs")
        .insert([payload])
        .select()
        .single()
      if (error) {
        return null
      }
      if (data) {
        setBcs(prev => [{ ...bc, id: data.id, number: data.numero }, ...prev])
        return { id: data.id as string, numero: data.numero as string }
      }
      return null
    } catch (e) {
      return null
    }
  }

  const updateBC = async (id: string, data: Partial<BCDocument>) => {
    if (!userId) return
    const payload: any = {}
    if (data.status !== undefined) payload.status = data.status
    if (data.notes !== undefined) payload.notes = data.notes || null
    if (data.amount !== undefined) payload.montant_ttc = data.amount
    if (data.amountHT !== undefined) payload.montant_ht = data.amountHT
    if (data.tva !== undefined) payload.tva = data.tva
    try {
      const { error } = await supabase
        .from("bcs")
        .update(payload)
        .eq("id", id)
        .eq("user_id", userId)
      if (error) {
        return
      }
      setBcs(prev => prev.map(b => b.id === id ? { ...b, ...data } : b))
    } catch (e) {
    }
  }
  // FEATURE 3 — Auto-save brouillon : upsert (1 seul brouillon actif par utilisateur)
  const saveDraftBC = async (data: Partial<BCDocument>): Promise<string | null> => {
    if (!userId) return null
    try {
      // Chercher un brouillon existant pour cet utilisateur
      const { data: existing } = await supabase
        .from("bcs")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "brouillon")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing?.id) {
        // Mettre à jour le brouillon existant
        const patchPayload: Record<string, unknown> = { status: "brouillon" }
        if (data.client !== undefined) patchPayload.client_nom = data.client || null
        if (data.clientId !== undefined) patchPayload.client_id = data.clientId || null
        if (data.trajet !== undefined) patchPayload.trajet = data.trajet || null
        if (data.driverName !== undefined) patchPayload.driver_nom = data.driverName || null
        if (data.notes !== undefined) patchPayload.notes = data.notes || null
        const { error } = await supabase
          .from("bcs")
          .update(patchPayload)
          .eq("id", existing.id)
          .eq("user_id", userId)
        if (!error) {
          setBcs(prev => prev.map(b => b.id === existing.id ? { ...b, ...data } : b))
          return existing.id
        }
      } else {
        // Créer un nouveau brouillon
        const now = new Date()
        const insertPayload = {
          user_id: userId,
          numero: `DRAFT-${now.getTime()}`,
          status: "brouillon",
          date_emission: now.toISOString().split("T")[0],
          client_nom: data.client || null,
          client_id: data.clientId || null,
          trajet: data.trajet || null,
          driver_nom: data.driverName || null,
          montant_ttc: 0,
          montant_ht: 0,
          notes: data.notes || null,
        }
        const { data: inserted, error } = await supabase
          .from("bcs")
          .insert([insertPayload])
          .select("id, numero")
          .single()
        if (!error && inserted?.id) {
          const newDraft: BCDocument = {
            id: inserted.id,
            number: inserted.numero,
            client: data.client || "",
            clientId: data.clientId,
            amount: 0,
            date: now.toLocaleDateString("fr-FR"),
            status: "brouillon",
            type: "bc",
            trajet: data.trajet,
            driverName: data.driverName,
            notes: data.notes,
          }
          setBcs(prev => [newDraft, ...prev])
          return inserted.id
        }
      }
    } catch (e) {
      console.warn("[NoxStore] saveDraftBC failed", e)
    }
    return null
  }

  const deleteBC = async (id: string) => {
    if (!userId) return
    try {
      const { error } = await supabase.from("bcs").delete().eq("id", id).eq("user_id", userId)
      if (error) return
      setBcs(prev => prev.filter(b => b.id !== id))
    } catch (e) {
    }
  }

  const addInvoice = async (invoice: InvoiceDocument, consumeToken: boolean = false): Promise<boolean> => {
    if (!userId) return false
    if (consumeToken && plan === "SOLO" && tokens <= 0) {
      toast.error("Jetons insuffisants. Rechargez votre compte pour générer une facture.")
      return false
    }
    try {
      const { count } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
      const now = new Date()
      const seq = String((count ?? 0) + 1).padStart(4, "0")
      const numero = `F-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${seq}`
      const parts = (invoice.echeance || "").split("/")
      const echeanceISO = parts.length === 3
        ? `${parts[2]}-${parts[1]}-${parts[0]}`
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      const payload = {
        user_id: userId,
        numero,
        status: invoice.status || "brouillon",
        date_emission: now.toISOString().split("T")[0],
        echeance: echeanceISO,
        // Lien BC source
        bc_ref: invoice.bcRef || null,
        bc_id: invoice.bcId || null,
        // Client
        client_id: invoice.clientId || null,
        client_nom: invoice.client || null,
        client_type: invoice.clientType || null,
        client_siren: invoice.clientSiren || null,
        client_address: invoice.clientAddress || null,
        // Chauffeur
        driver_id: invoice.driverId || null,
        driver_nom: invoice.driverName || null,
        // Véhicule
        vehicle_id: invoice.vehicleId || null,
        vehicle_nom: invoice.vehicleName || null,
        vehicle_immatriculation: invoice.vehiclePlate || null,
        // Montants
        items: invoice.items || null,
        montant_ht: invoice.amountHT ?? 0,
        montant_ttc: invoice.amount ?? 0,
        tva: invoice.tva ?? 0,
        tva_mode: invoice.tvaMode || null,
        base_ht: invoice.baseHT ?? null,
        supplements_ht: invoice.supplementsHT ?? null,
        tva_10_amount: invoice.tva10Amount ?? null,
        tva_20_amount: invoice.tva20Amount ?? null,
        tva_5_5_amount: invoice.tva55Amount ?? null,
        tva_other_amount: invoice.tvaOtherAmount ?? null,
        discount_value: invoice.discountValue ?? null,
        discount_type: invoice.discountType ?? null,
        original_ht: invoice.originalHT ?? null,
        original_ttc: invoice.originalTTC ?? null,
        // Divers
        notes: invoice.notes || null,
        trajet: invoice.trajet || null,
      }
      const { data, error } = await supabase
        .from("invoices")
        .insert([payload])
        .select()
        .single()
      if (error) {
        console.error("addInvoice error:", error)
        toast.error(`[${error.code}] ${error.message}`, { duration: 10000 })
        return false
      }
      if (data) {
        setInvoices(prev => [{ ...invoice, id: data.id, number: data.numero }, ...prev])
      }
      if (consumeToken && plan === "SOLO") {
        const newBalance = tokens - 1
        setTokens(newBalance)
        const { error: wErr } = await supabase
          .from("wallets")
          .update({ balance: newBalance })
          .eq("user_id", userId)
        if (wErr) setTokens(p => p + 1)
        await supabase
          .from("token_transactions")
          .insert({
            user_id: userId,
            type: "debit",
            amount: -1,
            description: `Facture ${data?.numero ?? invoice.number}`,
          })
      }
      return true
    } catch (e) {
      return false
    }
  }

  const updateInvoice = async (id: string, data: Partial<InvoiceDocument>) => {
    if (!userId) return
    const payload: Record<string, unknown> = {}
    if (data.status !== undefined) payload.status = data.status
    if (data.notes !== undefined) payload.notes = data.notes || null
    if (data.amount !== undefined) payload.montant_ttc = data.amount
    if (data.amountHT !== undefined) payload.montant_ht = data.amountHT
    if (data.tva !== undefined) payload.tva = data.tva
    try {
      const { error } = await supabase
        .from("invoices")
        .update(payload)
        .eq("id", id)
        .eq("user_id", userId)
      if (error) return
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))
    } catch (e) {
    }
  }

  const deleteInvoice = async (id: string) => {
    if (!userId) return
    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
      if (error) return
      setInvoices(prev => prev.filter(i => i.id !== id))
    } catch (e) {
    }
  }

  const updateTarifs = async (base: TarifBase, f: TarifForfait[], s: TarifSupplement[], t?: TrancheHoraire[], aw?: boolean, ah?: boolean) => {
    const newTranches = t ?? tranches
    const newAW = aw !== undefined ? aw : applyWeekend
    const newAH = ah !== undefined ? ah : applyHolidays
    setTarifBase(base)
    setForfaits(f)
    setSupplements(s)
    if (t) setTranches(t)
    if (aw !== undefined) setApplyWeekend(aw)
    if (ah !== undefined) setApplyHolidays(ah)
    if (!userId) return
    const forfaitsPayload = {
      items: f,
      tranches: newTranches,
      courseMinimum: base.courseMinimum,
      applyWeekend: newAW,
      applyHolidays: newAH,
    }
    try {
      const { data: existing } = await supabase
        .from("tariffs")
        .select("id")
        .eq("user_id", userId)
        .eq("is_default", true)
        .maybeSingle()
      if (existing?.id) {
        const { error } = await supabase
          .from("tariffs")
          .update({
            base_rate: base.priseEnCharge,
            per_km: base.prixKm,
            per_hour: base.prixAttente,
            supplements: s,
            forfaits: forfaitsPayload,
          })
          .eq("id", existing.id)
          .eq("user_id", userId)
        if (!error) {
          setTariffGrids(prev => prev.map(g => g.isDefault ? {
            ...g,
            baseRate: base.priseEnCharge, perKm: base.prixKm, perHour: base.prixAttente,
            courseMinimum: base.courseMinimum, supplements: s, forfaits: f,
            tranches: newTranches, applyWeekend: newAW, applyHolidays: newAH,
          } : g))
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("tariffs")
          .insert([{
            user_id: userId,
            name: "default",
            base_rate: base.priseEnCharge,
            per_km: base.prixKm,
            per_hour: base.prixAttente,
            supplements: s,
            forfaits: forfaitsPayload,
            is_default: true,
          }])
          .select()
          .single()
        if (!error && inserted) {
          setTariffGrids(prev => [...prev, {
            id: inserted.id, name: "default",
            baseRate: base.priseEnCharge, perKm: base.prixKm, perHour: base.prixAttente,
            courseMinimum: base.courseMinimum, supplements: s, forfaits: f,
            tranches: newTranches, applyWeekend: newAW, applyHolidays: newAH,
            isDefault: true,
          }])
        }
      }
    } catch (e) {
    }
  }

  const addTariffGrid = async (grid: TariffGrid) => {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from("tariffs")
        .insert([{
          user_id: userId,
          name: grid.name,
          base_rate: grid.baseRate,
          per_km: grid.perKm,
          per_hour: grid.perHour,
          supplements: grid.supplements,
          forfaits: {
            items: grid.forfaits,
            tranches: grid.tranches,
            courseMinimum: grid.courseMinimum,
            applyWeekend: grid.applyWeekend,
            applyHolidays: grid.applyHolidays,
          },
          is_default: grid.isDefault,
        }])
        .select()
        .single()
      if (error) return
      if (data) setTariffGrids(prev => [...prev, { ...grid, id: data.id }])
    } catch (e) {
    }
  }

  const updateTariffGrid = async (id: string, data: Partial<TariffGrid>) => {
    if (!userId) return
    const payload: Record<string, unknown> = {}
    if (data.name !== undefined) payload.name = data.name
    if (data.isDefault !== undefined) payload.is_default = data.isDefault
    if (data.baseRate !== undefined) payload.base_rate = data.baseRate
    if (data.perKm !== undefined) payload.per_km = data.perKm
    if (data.perHour !== undefined) payload.per_hour = data.perHour
    if (data.supplements !== undefined) payload.supplements = data.supplements
    if (data.forfaits !== undefined || data.tranches !== undefined || data.courseMinimum !== undefined || data.applyWeekend !== undefined || data.applyHolidays !== undefined) {
      const existing = tariffGrids.find(g => g.id === id)
      if (existing) {
        payload.forfaits = {
          items: data.forfaits ?? existing.forfaits,
          tranches: data.tranches ?? existing.tranches,
          courseMinimum: data.courseMinimum ?? existing.courseMinimum,
          applyWeekend: data.applyWeekend ?? existing.applyWeekend,
          applyHolidays: data.applyHolidays ?? existing.applyHolidays,
        }
      }
    }
    try {
      const { error } = await supabase
        .from("tariffs")
        .update(payload)
        .eq("id", id)
        .eq("user_id", userId)
      if (error) return
      setTariffGrids(prev => prev.map(g => g.id === id ? { ...g, ...data } : g))
    } catch (e) {
    }
  }

  const deleteTariffGrid = async (id: string) => {
    if (!userId) return
    try {
      const { error } = await supabase
        .from("tariffs")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
      if (error) return
      setTariffGrids(prev => prev.filter(g => g.id !== id))
    } catch (e) {
    }
  }

  const upgrade = async (target?: Plan) => {
    if (!userId) return
    const newPlan: Plan = target ?? (plan === "SOLO" ? "DUO" : "TEAM")
    const { error } = await supabase
      .from("subscriptions")
      .upsert({ user_id: userId, plan: newPlan }, { onConflict: "user_id" })
    if (!error) setPlan(newPlan)
  }

  const addTokens = async (n: number) => {
    if (!userId) return
    const newBalance = tokens + n
    const { error } = await supabase
      .from("wallets")
      .upsert({ user_id: userId, balance: newBalance }, { onConflict: "user_id" })
    if (!error) setTokens(newBalance)
  }

  const spendToken = () => {
    if (tokens <= 0) return false
    const newBalance = tokens - 1
    setTokens(newBalance)
    if (userId) {
      supabase.from("wallets")
        .upsert({ user_id: userId, balance: newBalance }, { onConflict: "user_id" })
        .then(({ error }) => { if (error) setTokens(p => p + 1) })
    }
    return true
  }

  const loadTripRequests = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from("trip_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(plan === "SOLO" ? 10 : 100)
    if (data) setTripRequests(data as TripRequest[])
  }, [userId, plan, supabase])

  const refreshTokens = useCallback(async () => {
    if (!userId) return
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single()
    if (wallet) setTokens(wallet.balance ?? 0)
  }, [userId, supabase])

  const driverCount = drivers.length
  const vehicleCount = vehicles.length

  const tariffSettings = React.useMemo(() => ({
    base: tarifBase,
    forfaits,
    supplements,
    tranches,
    applyWeekend,
    applyHolidays
  }), [tarifBase, forfaits, supplements, tranches, applyWeekend, applyHolidays])

  const legalProfile = useMemo(() => {
    const taxConfig = getTaxConfig(enterprise)
    return {
      mustDisplayVatExemption: taxConfig.isMicroEntrepreneur,
      mustDisplayVatNumber: !taxConfig.isMicroEntrepreneur && !!enterprise.tvaIntra,
      isInvoiceWithoutVat: taxConfig.isMicroEntrepreneur,
      sellerLegalIdentity: getLegalSellerIdentity(enterprise),
      vatMention: getVatMention(enterprise),
      taxConfig,
    }
  }, [enterprise])

  const validateDocumentCompliance = useCallback((draft: Partial<BCDocument>): string[] => {
    const errors: string[] = []
    if (!draft.client) errors.push("Nom du client requis")
    if (!draft.clientPhone && !draft.passagerTelephone) errors.push("Telephone client requis")
    if (!draft.trajet?.date) errors.push("Date du trajet requise")
    if (!draft.trajet?.time) errors.push("Heure de prise en charge requise")
    if (!draft.trajet?.depart || draft.trajet.depart === "Non renseigne") errors.push("Adresse de depart requise")
    if (!draft.trajet?.arrivee || draft.trajet.arrivee === "Non renseigne") errors.push("Adresse d'arrivee requise")
    return errors
  }, [])

  return (
    <NoxContext.Provider value={{
      enterprise, userProfile, refreshUserProfile, refreshInvoices, drivers, vehicles, clients, bcs, invoices, tarifBase, forfaits, supplements,
      userId, plan, tokens, subscriptionStatus, trialEndsAt, onboardingStatus, driverCount, vehicleCount,
      upgrade, addTokens, spendToken, refreshTokens,
      updateEnterprise, addDriver, updateDriver, deleteDriver, addVehicle, updateVehicle, deleteVehicle,
      addClient, updateClient, deleteClient, addBC, updateBC, saveDraftBC, deleteBC, addInvoice, updateInvoice, deleteInvoice,
      tariffGrids, addTariffGrid, updateTariffGrid, deleteTariffGrid, updateTarifs,
      tranches, applyWeekend, applyHolidays,
      tariffSettings,
      legalProfile, validateDocumentCompliance,
      tripRequests, loadTripRequests,
    }}>
      {children}
    </NoxContext.Provider>
  )
}

export function useNox() {
  const context = useContext(NoxContext)
  if (context === undefined) throw new Error("useNox must be used within a NoxProvider")
  return context
}

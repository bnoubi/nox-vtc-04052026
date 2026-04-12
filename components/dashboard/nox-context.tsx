"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { 
  Driver, Vehicle, Client, EnterpriseProfile, TarifBase, TarifForfait, TarifSupplement, TrancheHoraire,
  BCDocument, InvoiceDocument, Plan,
  defaultTarifBase, defaultForfaits, defaultSupplements, defaultTranches,
  PLAN_LIMITS
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
  email: "",
  phone: "",
}

interface NoxContextType {
  enterprise: EnterpriseProfile
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
  plan: Plan
  tokens: number
  onboardingStatus: string
  driverCount: number
  vehicleCount: number
  upgrade: (target?: Plan) => void
  addTokens: (n: number) => void
  spendToken: () => boolean
  updateEnterprise: (data: Partial<EnterpriseProfile>) => void
  addDriver: (driver: Driver) => void
  updateDriver: (id: string, data: Partial<Driver>) => void
  deleteDriver: (id: string) => void
  addVehicle: (vehicle: Vehicle) => void
  updateVehicle: (id: string, data: Partial<Vehicle>) => void
  deleteVehicle: (id: string) => void
  addClient: (client: Client) => void
  updateClient: (id: string, data: Partial<Client>) => void
  deleteClient: (id: string) => void
  addBC: (bc: BCDocument) => void
  updateBC: (id: string, data: Partial<BCDocument>) => void
  addInvoice: (invoice: InvoiceDocument) => void
  updateInvoice: (id: string, data: Partial<InvoiceDocument>) => void
  updateTarifs: (base: TarifBase, forfaits: TarifForfait[], supplements: TarifSupplement[], tranches?: TrancheHoraire[], applyWeekend?: boolean, applyHolidays?: boolean) => void
  tariffSettings: {
    base: TarifBase
    forfaits: TarifForfait[]
    supplements: TarifSupplement[]
    tranches: TrancheHoraire[]
    applyWeekend: boolean
    applyHolidays: boolean
  }
}

const NoxContext = createContext<NoxContextType | undefined>(undefined)

// Clé de stockage isolée par user_id — garantit l'isolation stricte inter-comptes
function getStorageKey(userId: string): string {
  return `nox_vtc_u_${userId}_v1`
}

// Purge l'ancienne clé globale non-isolée si elle existe encore
function purgeGlobalStorageIfNeeded() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("nox_vtc_storage_v1")
  }
}

export function NoxProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // ─── Données métier : état initial VIDE pour tout nouveau compte ───
  const [enterprise, setEnterprise] = useState<EnterpriseProfile>(emptyEnterprise)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [bcs, setBcs] = useState<BCDocument[]>([])
  const [invoices, setInvoices] = useState<InvoiceDocument[]>([])

  // ─── Config fonctionnelle : valeurs par défaut système (tarification) ───
  const [tarifBase, setTarifBase] = useState<TarifBase>(defaultTarifBase)
  const [forfaits, setForfaits] = useState<TarifForfait[]>(defaultForfaits)
  const [supplements, setSupplements] = useState<TarifSupplement[]>(defaultSupplements)
  const [tranches, setTranches] = useState<TrancheHoraire[]>(defaultTranches)
  const [applyWeekend, setApplyWeekend] = useState(true)
  const [applyHolidays, setApplyHolidays] = useState(true)
  const [plan, setPlan] = useState<Plan>("SOLO")
  const [tokens, setTokens] = useState(0)
  const [onboardingStatus, setOnboardingStatus] = useState("not_started")

  // ─── Étape 1 : Récupérer l'utilisateur connecté, puis charger SES données ───
  useEffect(() => {
    let isMounted = true

    async function initStore() {
      purgeGlobalStorageIfNeeded()

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!isMounted) return
      if (!user) {
        // Pas de session — on ne charge rien, on reste vide
        setIsLoaded(true)
        return
      }

      const uid = user.id
      setUserId(uid)

      // Fetch from actual backend profiles
      try {
        const { data: profile } = await supabase
          .from("user_accounts")
          .select("plan, tokens, onboarding_status")
          .eq("id", uid)
          .single()

        if (profile) {
          if (profile.plan) setPlan(profile.plan as Plan)
          if (profile.tokens !== undefined) setTokens(profile.tokens)
          if (profile.onboarding_status) setOnboardingStatus(profile.onboarding_status)
        }

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
            adresse: entProfile.adresse || prev.adresse,
            bankName: entProfile.banque || prev.bankName,
            iban: entProfile.iban || prev.iban,
            bic: entProfile.bic || prev.bic,
            registreVTC: entProfile.registre_vtc || prev.registreVTC,
            dateRegistre: entProfile.date_registre_vtc || prev.dateRegistre,
            dateAssurance: entProfile.date_assurance_pro || prev.dateAssurance,
            logo: entProfile.logo_url || prev.logo,
            brandColor: entProfile.brand_color || prev.brandColor,
            statutJuridique: entProfile.statut_juridique || prev.statutJuridique,
            prenomRepresentantLegal: entProfile.prenom_representant_legal || prev.prenomRepresentantLegal,
            nomRepresentantLegal: entProfile.nom_representant_legal || prev.nomRepresentantLegal,
            zipCode: entProfile.code_postal || prev.zipCode,
            city: entProfile.ville || prev.city,
            complementAdresse: entProfile.complement_adresse || prev.complementAdresse
          }))
        }
      } catch (err) {
        console.warn("[NoxStore] Could not load backend data", err)
      }

      // Charger les données propres à CET utilisateur depuis son espace isolé
      const storageKey = getStorageKey(uid)
      const savedData = localStorage.getItem(storageKey)

      if (savedData) {
        try {
          const parsed = JSON.parse(savedData)
          // Données métier : ne charger que si existantes pour cet utilisateur
          if (Array.isArray(parsed.drivers)) setDrivers(parsed.drivers)
          if (Array.isArray(parsed.vehicles)) setVehicles(parsed.vehicles)
          if (Array.isArray(parsed.clients)) setClients(parsed.clients)
          if (Array.isArray(parsed.bcs)) setBcs(parsed.bcs)
          if (Array.isArray(parsed.invoices)) setInvoices(parsed.invoices)
          // Config fonctionnelle
          if (parsed.tarifBase) setTarifBase(parsed.tarifBase)
          if (Array.isArray(parsed.forfaits)) setForfaits(parsed.forfaits)
          if (Array.isArray(parsed.supplements)) setSupplements(parsed.supplements)
          if (Array.isArray(parsed.tranches)) setTranches(parsed.tranches)
          if (parsed.applyWeekend !== undefined) setApplyWeekend(parsed.applyWeekend)
          if (parsed.applyHolidays !== undefined) setApplyHolidays(parsed.applyHolidays)
          // We intentionally do not override plan and tokens with local storage 
          // if we want the DB to be the source of truth, but we keep it as fallback
          if (!plan && parsed.plan) setPlan(parsed.plan)
          if (tokens === 0 && parsed.tokens) setTokens(parsed.tokens)
        } catch (e) {
          console.error("[NoxStore] Failed to parse user storage", e)
        }
      }

      setIsLoaded(true)
    }

    initStore()
    return () => { isMounted = false }
  }, [])

  // ─── Étape 2 : Persister uniquement dans l'espace de l'utilisateur connecté ───
  useEffect(() => {
    if (!isLoaded || !userId) return
    const storageKey = getStorageKey(userId)
    localStorage.setItem(storageKey, JSON.stringify({
      drivers, vehicles, clients, bcs, invoices, // Enterprise is now in Supabase
      tarifBase, forfaits, supplements, tranches,
      applyWeekend, applyHolidays, plan, tokens
    }))
  }, [
    isLoaded, userId,
    drivers, vehicles, clients, bcs, invoices,
    tarifBase, forfaits, supplements, tranches,
    applyWeekend, applyHolidays, plan, tokens
  ])

  // ─── Mutations données métier ───
  const updateEnterprise = async (data: Partial<EnterpriseProfile>) => {
    try {
      if (!userId) {
        console.error("[NoxStore] Cannot update enterprise: No userId identified")
        return
      }

      // Snapshot prior to mutation
      console.log("[NoxStore] updateEnterprise initiated with data:", data)

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
        complement_adresse: data.complementAdresse !== undefined ? (data.complementAdresse || null) : (enterprise.complementAdresse || null)
      }

      console.log("[NoxStore] Upserting payload:", dbPayload)

      const supabase = createClient()
      const { data: dbData, error } = await supabase
        .from('profiles')
        .upsert(dbPayload, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) {
        console.error("[NoxStore] Failed to sync enterprise data:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        return
      }
      
      console.log("[NoxStore] Supabase returned successful DB row:", dbData)

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
            adresse: dbData.adresse || "",
            bankName: dbData.banque || "",
            iban: dbData.iban || "",
            bic: dbData.bic || "",
            registreVTC: dbData.registre_vtc || "",
            dateRegistre: dbData.date_registre_vtc || "",
            dateAssurance: dbData.date_assurance_pro || "",
            logo: dbData.logo_url || "",
            brandColor: dbData.brand_color || "",
            statutJuridique: dbData.statut_juridique || "",
            prenomRepresentantLegal: dbData.prenom_representant_legal || "",
            nomRepresentantLegal: dbData.nom_representant_legal || "",
            zipCode: dbData.code_postal || "",
            city: dbData.ville || "",
            complementAdresse: dbData.complement_adresse || ""
          }
          console.log("[NoxStore] Setting new Enterprise stable state:", freshState)
          return freshState
        })
      }
    } catch (e) {
      console.error("[NoxStore] Uncaught exception in updateEnterprise:", e)
    }
  }
  const addDriver = (driver: Driver) => setDrivers((prev: Driver[]) => [driver, ...prev])
  const updateDriver = (id: string, data: Partial<Driver>) => setDrivers((prev: Driver[]) => prev.map(d => d.id === id ? { ...d, ...data } : d))
  const deleteDriver = (id: string) => setDrivers((prev: Driver[]) => prev.filter(d => d.id !== id))
  const addVehicle = (vehicle: Vehicle) => setVehicles((prev: Vehicle[]) => [vehicle, ...prev])
  const updateVehicle = (id: string, data: Partial<Vehicle>) => setVehicles((prev: Vehicle[]) => prev.map(v => v.id === id ? { ...v, ...data } : v))
  const deleteVehicle = (id: string) => setVehicles((prev: Vehicle[]) => prev.filter(v => v.id !== id))
  const addClient = (client: Client) => setClients((prev: Client[]) => [client, ...prev])
  const updateClient = (id: string, data: Partial<Client>) => setClients((prev: Client[]) => prev.map(c => c.id === id ? { ...c, ...data } : c))
  const deleteClient = (id: string) => setClients((prev: Client[]) => prev.filter(c => c.id !== id))
  const addBC = (bc: BCDocument) => setBcs((prev: BCDocument[]) => [bc, ...prev])
  const updateBC = (id: string, data: Partial<BCDocument>) => setBcs((prev: BCDocument[]) => prev.map(b => b.id === id ? { ...b, ...data } : b))
  const addInvoice = (invoice: InvoiceDocument) => setInvoices((prev: InvoiceDocument[]) => [invoice, ...prev])
  const updateInvoice = (id: string, data: Partial<InvoiceDocument>) => setInvoices((prev: InvoiceDocument[]) => prev.map(i => i.id === id ? { ...i, ...data } : i))

  const updateTarifs = (base: TarifBase, f: TarifForfait[], s: TarifSupplement[], t?: TrancheHoraire[], aw?: boolean, ah?: boolean) => {
    setTarifBase(base)
    setForfaits(f)
    setSupplements(s)
    if (t) setTranches(t)
    if (aw !== undefined) setApplyWeekend(aw)
    if (ah !== undefined) setApplyHolidays(ah)
  }

  const upgrade = (target?: Plan) => {
    if (target) {
      setPlan(target)
    } else {
      setPlan((prev: Plan) => (prev === "SOLO" ? "DUO" : "TEAM"))
    }
  }

  const addTokens = (n: number) => setTokens((prev: number) => prev + n)
  const spendToken = () => {
    if (tokens > 0) {
      setTokens((prev: number) => prev - 1)
      return true
    }
    return false
  }

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

  return (
    <NoxContext.Provider value={{
      enterprise, drivers, vehicles, clients, bcs, invoices, tarifBase, forfaits, supplements,
      plan, tokens, onboardingStatus, driverCount, vehicleCount,
      upgrade, addTokens, spendToken,
      updateEnterprise, addDriver, updateDriver, deleteDriver, addVehicle, updateVehicle, deleteVehicle,
      addClient, updateClient, deleteClient, addBC, updateBC, addInvoice, updateInvoice, updateTarifs,
      tranches, applyWeekend, applyHolidays,
      tariffSettings
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

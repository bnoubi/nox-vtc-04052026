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

export interface UserProfile {
  prenom: string
  nom: string
  email: string
  phone: string
}

interface NoxContextType {
  enterprise: EnterpriseProfile
  userProfile: UserProfile
  refreshUserProfile: () => Promise<void>
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
  const [userProfile, setUserProfile] = useState<UserProfile>({ prenom: "", nom: "", email: "", phone: "" })
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [bcs, setBcs] = useState<BCDocument[]>([])
  const [invoices, setInvoices] = useState<InvoiceDocument[]>([])

  const refreshUserProfile = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from("user_accounts").select("prenom, nom, phone").eq("id", user.id).single()
      setUserProfile({
        email: user.email || "",
        prenom: data?.prenom || "",
        nom: data?.nom || "",
        phone: data?.phone || ""
      })
    }
  }

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
        
        await refreshUserProfile()

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

      // ─── Chargement Drivers (Supabase) ───
      try {
        const { data: dbDrivers, error: drvErr } = await supabase
          .from("drivers")
          .select("*")
          .eq("user_id", uid)
        if (drvErr) console.error("[NoxStore] Error loading drivers:", drvErr)
        else if (dbDrivers) {
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
        console.error("[NoxStore] Uncaught error loading drivers", err)
      }

      // ─── Chargement Vehicles (Supabase) ───
      try {
        const { data: dbVehicles, error: vehErr } = await supabase
          .from("vehicles")
          .select("*")
          .eq("user_id", uid)
        if (vehErr) console.error("[NoxStore] Error loading vehicles:", vehErr)
        else if (dbVehicles) {
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
        console.error("[NoxStore] Uncaught error loading vehicles", err)
      }

      // ─── Chargement Clients (Supabase) ───
      try {
        const { data: dbClients, error: cliErr } = await supabase
          .from("clients")
          .select("*")
          .eq("user_id", uid)
        if (cliErr) console.error("[NoxStore] Error loading clients:", cliErr)
        else if (dbClients) {
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
        console.error("[NoxStore] Uncaught error loading clients", err)
      }

      // ─── Chargement BCs (Supabase) ───
      try {
        const { data: dbBcs, error: bcsErr } = await supabase
          .from("bcs")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
        if (bcsErr) console.error("[NoxStore] Error loading bcs:", bcsErr)
        else if (dbBcs) {
          setBcs(dbBcs.map(b => ({
            id: b.id,
            number: b.numero || "",
            client: b.client_nom || "",
            clientPhone: b.client_telephone || undefined,
            clientId: b.client_id || undefined,
            amount: Number(b.montant_ttc) || 0,
            amountHT: Number(b.montant_ht) || 0,
            tva: Number(b.tva) || 0,
            baseHT: Number(b.base_ht) || 0,
            supplementsHT: Number(b.supplements_ht) || 0,
            tva10Amount: Number(b.tva_10_amount) || 0,
            tva20Amount: Number(b.tva_20_amount) || 0,
            discountValue: Number(b.discount_value) || 0,
            discountType: b.discount_type || "percent",
            originalHT: Number(b.original_ht) || 0,
            originalTTC: Number(b.original_ttc) || 0,
            supplementsList: b.supplements_list || [],
            date: b.date_emission
              ? new Date(b.date_emission).toLocaleDateString("fr-FR")
              : "",
            status: b.status || "en_attente",
            type: "bc",
            trajet: b.trajet || {},
            driverName: b.driver_nom || undefined,
            driverCarteVTC: b.driver_carte_vtc || undefined,
            vehicleName: b.vehicle_nom || undefined,
            vehiclePlate: b.vehicle_immatriculation || undefined,
            notes: b.notes || undefined,
            cgvText: b.cgv_text || undefined,
          })))
        }
      } catch (err) {
        console.error("[NoxStore] Uncaught error loading bcs", err)
      }

            // Charger les données propres à CET utilisateur depuis son espace isolé
      const storageKey = getStorageKey(uid)
      const savedData = localStorage.getItem(storageKey)

      if (savedData) {
        try {
          const parsed = JSON.parse(savedData)
          // Données métier : ne charger que si existantes pour cet utilisateur
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
      // clients & bcs sont dans Supabase — plus en localStorage
      invoices,
      tarifBase, forfaits, supplements, tranches,
      applyWeekend, applyHolidays, plan, tokens
    }))
  }, [
    isLoaded, userId,
    clients, bcs, invoices,
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
  const addDriver = async (driver: Driver) => {
    console.log('DEBUG CONTEXT: addDriver called', driver)
    const supabase = createClient()

    console.log('=== DEBUG INSERT DRIVER ===')
    console.log('context userId:', userId)
    const sessionResult = await supabase.auth.getSession()
    const sessionUserId = sessionResult.data.session?.user?.id
    console.log('session user.id:', sessionUserId)
    console.log('userId === session.user.id ?', userId === sessionUserId)

    if (!userId) {
      console.error('[NoxStore] addDriver: userId is null or undefined — ABORT')
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
    console.log('payload driver:', payloadFinal)

    try {
      // ─── INSERT minimal sans .select() ───
      const { error, status, statusText } = await supabase
        .from('drivers')
        .insert([payloadFinal])

      console.log('drivers insert status:', status, statusText)
      console.log('drivers insert error:', JSON.stringify(error, null, 2))

      if (error) {
        console.error('[NoxStore] ❌ addDriver INSERT FAILED:', error.message, '| code:', error.code, '| hint:', error.hint)
        return
      }

      // ─── Reload complet de la liste depuis Supabase ───
      const { data: rows, error: selectError } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userId)
      console.log('drivers post-insert select rows:', rows)
      console.log('drivers post-insert select error:', selectError)

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
      console.error('[NoxStore] Uncaught exception in addDriver', e)
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
      const supabase = createClient()
      const { data: dbData, error } = await supabase.from('drivers').update(payload).eq('id', id).eq('user_id', userId).select().single()
      if (error) {
        console.error("[NoxStore] Error updating driver:", error)
        return
      }
      if (dbData) {
        setDrivers(prev => prev.map(d => d.id === id ? { ...d, ...data } : d))
      }
    } catch (e) {
      console.error("[NoxStore] Uncaught error updating driver", e)
    }
  }

  const deleteDriver = async (id: string) => {
    if (!userId) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('drivers').delete().eq('id', id).eq('user_id', userId)
      if (error) {
        console.error("[NoxStore] Error deleting driver:", error)
        return
      }
      setDrivers(prev => prev.filter(d => d.id !== id))
    } catch (e) {
      console.error("[NoxStore] Uncaught error deleting driver", e)
    }
  }

  const addVehicle = async (vehicle: Vehicle) => {
    console.log('DEBUG CONTEXT: addVehicle called', vehicle)
    const supabase = createClient()

    console.log('=== DEBUG INSERT VEHICLE ===')
    console.log('context userId:', userId)
    const sessionResult = await supabase.auth.getSession()
    const sessionUserId = sessionResult.data.session?.user?.id
    console.log('session user.id:', sessionUserId)
    console.log('userId === session.user.id ?', userId === sessionUserId)

    if (!userId) {
      console.error('[NoxStore] addVehicle: userId is null or undefined — ABORT')
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
    console.log('payload vehicle:', payloadFinal)

    try {
      // ─── INSERT minimal sans .select() ───
      const { error, status, statusText } = await supabase
        .from('vehicles')
        .insert([payloadFinal])

      console.log('vehicles insert status:', status, statusText)
      console.log('vehicles insert error:', JSON.stringify(error, null, 2))

      if (error) {
        console.error('[NoxStore] ❌ addVehicle INSERT FAILED:', error.message, '| code:', error.code, '| hint:', error.hint)
        return
      }

      // ─── Reload complet de la liste depuis Supabase ───
      const { data: rows, error: selectError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
      console.log('vehicles post-insert select rows:', rows)
      console.log('vehicles post-insert select error:', selectError)

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
      console.error('[NoxStore] Uncaught exception in addVehicle', e)
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
      const supabase = createClient()
      const { data: dbData, error } = await supabase.from('vehicles').update(payload).eq('id', id).eq('user_id', userId).select().single()
      if (error) {
        console.error("[NoxStore] Error updating vehicle:", error)
        return
      }
      if (dbData) {
        setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...data } : v))
      }
    } catch (e) {
      console.error("[NoxStore] Uncaught error updating vehicle", e)
    }
  }

  const deleteVehicle = async (id: string) => {
    if (!userId) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('vehicles').delete().eq('id', id).eq('user_id', userId)
      if (error) {
        console.error("[NoxStore] Error deleting vehicle:", error)
        return
      }
      setVehicles(prev => prev.filter(v => v.id !== id))
    } catch (e) {
      console.error("[NoxStore] Uncaught error deleting vehicle", e)
    }
  }
  const addClient = async (client: Client) => {
    if (!userId) return
    const supabase = createClient()
    const payload = {
      user_id: userId,
      type: client.type || "particulier",
      civilite: client.civilite || null,
      prenom: client.prenom || null,
      nom: client.nom || null,
      raison_sociale: client.raisonSociale || null,
      siren: client.siren || null,
      tva_intra: client.tvaIntra || null,
      telephone: client.phone || null,
      email: client.email || null,
      adresse: client.billingAddress?.rue || null,
      code_postal: client.billingAddress?.codePostal || null,
      ville: client.billingAddress?.ville || null,
      contacts: client.contacts || [],
      notes: client.notes || null,
      tag: client.tag || null,
      preferences: client.preferences || null,
    }
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert([payload])
        .select()
        .single()
      if (error) {
        console.error("[NoxStore] addClient FAILED:", error.message)
        return
      }
      if (data) {
        setClients(prev => [{ ...client, id: data.id }, ...prev])
      }
    } catch (e) {
      console.error("[NoxStore] Uncaught error in addClient", e)
    }
  }

  const updateClient = async (id: string, data: Partial<Client>) => {
    if (!userId) return
    const supabase = createClient()
    const payload: any = {}
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
    }
    try {
      const { error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", id)
        .eq("user_id", userId)
      if (error) {
        console.error("[NoxStore] updateClient FAILED:", error.message)
        return
      }
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    } catch (e) {
      console.error("[NoxStore] Uncaught error in updateClient", e)
    }
  }

  const deleteClient = async (id: string) => {
    if (!userId) return
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
      if (error) {
        console.error("[NoxStore] deleteClient FAILED:", error.message)
        return
      }
      setClients(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      console.error("[NoxStore] Uncaught error in deleteClient", e)
    }
  }

  const addBC = async (bc: BCDocument) => {
    if (!userId) return
    const supabase = createClient()
    const { count } = await supabase
      .from("bcs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
    const now = new Date()
    const seq = String((count ?? 0) + 1).padStart(4, "0")
    const numero = `BC-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${seq}`
    const payload = {
      user_id: userId,
      numero,
      status: bc.status || "en_attente",
      date_emission: now.toISOString().split("T")[0],
      client_id: (bc as any).clientId || null,
      client_nom: bc.client || null,
      client_telephone: bc.clientPhone || null,
      driver_id: (bc as any).driverId || null,
      driver_nom: bc.driverName || null,
      driver_carte_vtc: bc.driverCarteVTC || null,
      vehicle_id: (bc as any).vehicleId || null,
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
    }
    try {
      const { data, error } = await supabase
        .from("bcs")
        .insert([payload])
        .select()
        .single()
      if (error) {
        console.error("[NoxStore] addBC FAILED:", error.message)
        return
      }
      if (data) {
        setBcs(prev => [{ ...bc, id: data.id, number: data.numero }, ...prev])
      }
    } catch (e) {
      console.error("[NoxStore] Uncaught error in addBC", e)
    }
  }

  const updateBC = async (id: string, data: Partial<BCDocument>) => {
    if (!userId) return
    const supabase = createClient()
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
        console.error("[NoxStore] updateBC FAILED:", error.message)
        return
      }
      setBcs(prev => prev.map(b => b.id === id ? { ...b, ...data } : b))
    } catch (e) {
      console.error("[NoxStore] Uncaught error in updateBC", e)
    }
  }
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
      enterprise, userProfile, refreshUserProfile, drivers, vehicles, clients, bcs, invoices, tarifBase, forfaits, supplements,
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

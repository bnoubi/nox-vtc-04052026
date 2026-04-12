export interface Driver {
  id: string
  name: string
  initials: string
  online: boolean
  carteProExpiration: string // ISO date string
  carteProNumber?: string // Numero de carte professionnelle VTC
  apacExpiration: string // Attestation Préfectorale - ISO date string
  rcProExpiration: string // RC Professionnelle - ISO date string
  phone?: string
}

// Forfait tarifaire (trajets fixes)
export interface TarifForfait {
  id: string
  name: string
  price: number
}

export type Plan = "SOLO" | "DUO" | "TEAM"

export const PLAN_LIMITS: Record<Plan, { drivers: number; vehicles: number }> = {
  SOLO: { drivers: 1, vehicles: 1 },
  DUO: { drivers: 2, vehicles: 2 },
  TEAM: { drivers: 10, vehicles: 10 },
}

export type CGVMode = "configurator" | "freetext" | "import"
export type PaymentTiming = "before" | "after"
export type PaymentMethod = "cb" | "applepay" | "googlepay" | "paypal" | "virement" | "especes"
export type CancellationDelay = "1h" | "2h" | "4h" | "24h"
export type CancellationFee = "0" | "25" | "50" | "100"
export type WaitTime = "5" | "10" | "15" | "20"
export type WaitFee = "0.25" | "0.50" | "0.75" | "1.00"
export type NoShowFee = "0" | "50" | "100"
export type PaymentDelay = "comptant" | "15j" | "30j"

export interface CGVConfig {
  paymentTiming: PaymentTiming
  paymentMethods: PaymentMethod[]
  cancellationDelay: CancellationDelay
  cancellationFee: CancellationFee
  waitTime: WaitTime
  waitFee: WaitFee
  noShowFee: NoShowFee
  paymentDelay: PaymentDelay
}

// Profil entreprise (emetteur des documents)
export interface EnterpriseProfile {
  name: string
  denomination: string
  siren: string
  tva: string
  tvaIntra: string
  evtcNumber: string 
  registreVTC?: string
  dateRegistre?: string
  dateAssurance?: string
  statutJuridique?: string
  prenomRepresentantLegal?: string
  nomRepresentantLegal?: string
  adresse: string
  complementAdresse?: string
  zipCode: string
  city: string
  email: string
  phone: string
  logo?: string
  brandColor?: string
  iban?: string
  bic?: string
  bankName?: string
  cgv?: string
  cgvMode?: CGVMode
  cgvConfig?: CGVConfig
  cgvText?: string
}

export type BCStatus = "signe" | "en_attente" | "brouillon" | "annule"
export type InvoiceStatus = "brouillon" | "envoyee" | "payee"

export interface BCDocument {
  id: string
  number: string
  client: string
  clientPhone?: string
  amount: number
  amountHT?: number
  tva?: number
  tvaRate?: number

  // Multi-TVA & Remise
  baseHT?: number
  tva10Amount?: number
  supplementsHT?: number
  tva20Amount?: number
  tva55Amount?: number
  tvaOtherAmount?: number
  
  discountValue?: number
  discountType?: "percent" | "amount"
  originalHT?: number
  originalTTC?: number
  supplementsList?: string[]

  date: string
  status: BCStatus
  type: "bc"
  trajet?: {
    depart: string
    arrivee: string
    distance?: number
    date?: string
    time?: string
    passengers?: number
    luggage?: number
  }
  driverName?: string
  driverCarteVTC?: string
  vehicleName?: string
  vehiclePlate?: string
  notes?: string
  cgvText?: string
}

export interface InvoiceItem {
  id: string
  designation: string
  amountHT: number
  tvaRate: number
}

export interface InvoiceDocument {
  id: string
  number: string
  client: string
  clientPhone?: string
  amount: number
  amountHT?: number
  tva?: number
  tvaRate?: number
  
  // Multi-TVA & Remise & Lignes dynamiques
  items?: InvoiceItem[]
  baseHT?: number
  tva10Amount?: number
  supplementsHT?: number
  tva20Amount?: number
  tva55Amount?: number
  tvaOtherAmount?: number
  
  discountValue?: number
  discountType?: "percent" | "amount"
  originalHT?: number
  originalTTC?: number
  date: string
  echeance: string
  status: InvoiceStatus
  type: "facture"
  bcRef: string
  trajet?: {
    depart: string
    arrivee: string
    distance?: number
    date?: string
    time?: string
    passengers?: number
    luggage?: number
  }
  driverName?: string
  driverCarteVTC?: string
  vehicleName?: string
  vehiclePlate?: string
  notes?: string
  cgvText?: string
}

// ─── Mock data supprimée ───
// Les tableaux initialBCs, initialInvoices, allDrivers, allVehicles, allClients
// et defaultEnterprise ont été supprimés.
// Chaque compte utilisateur démarre avec un espace vide.
// Les données de démonstration ne doivent plus jamais être injectées dans le store.

// Forfaits tarifaires par defaut
export const defaultForfaits: TarifForfait[] = [
  { id: "1", name: "CDG → Paris Centre", price: 85.00 },
  { id: "2", name: "Orly → Paris Centre", price: 65.00 },
]

export interface TrancheHoraire {
  id: string
  name: string
  startTime: string
  endTime: string
  coefficient: number
}

export const defaultTranches: TrancheHoraire[] = [
  { id: "a", name: "Tarif A — Journée", startTime: "07:00", endTime: "20:59", coefficient: 1.00 },
  { id: "b", name: "Tarif B — Nuit", startTime: "21:00", endTime: "06:59", coefficient: 1.25 },
  { id: "c", name: "Tarif C — Week-end & Fériés", startTime: "00:00", endTime: "23:59", coefficient: 1.50 }
]

// Tarif de base (synchronise avec les reglages de la grille tarifaire)
export interface TarifBase {
  priseEnCharge: number
  prixKm: number
  prixAttente: number // par minute
  courseMinimum: number
}

export const defaultTarifBase: TarifBase = {
  priseEnCharge: 2.50,
  prixKm: 1.80,
  prixAttente: 0.50,
  courseMinimum: 15.00,
}

// Supplement tarifaire (filtre par enabled dans le formulaire)
export interface TarifSupplement {
  id: string
  label: string
  price: number
  enabled: boolean // seuls les supplements enabled:true sont affiches
}

export const defaultSupplements: TarifSupplement[] = [
  { id: "bagage", label: "Bagage volumineux", price: 5.00, enabled: true },
  { id: "animal", label: "Animal de compagnie", price: 5.00, enabled: false },
  { id: "siege", label: "Siege bebe / enfant", price: 10.00, enabled: true },
  { id: "disposition", label: "Mise a disposition", price: 15.00, enabled: false },
  { id: "terminal", label: "Supplement terminal", price: 5.00, enabled: true },
  { id: "pancarte", label: "Accueil pancarte", price: 15.00, enabled: true },
]

export type MotorType = "diesel" | "essence" | "hybride" | "electrique"
export type VehicleCategory = "citadine" | "berline" | "suv" | "van"

export interface Vehicle {
  id: string
  model: string
  plate: string
  inService: boolean
  datePremiereImmat: string // Date de première immatriculation - ISO date string
  motorType: MotorType
  category: VehicleCategory
  color: string
  assuranceTransportExpiration: string // Assurance Transport à Titre Onéreux - ISO date string
  controleTechniqueExpiration: string // ISO date string
}

// ─── Mock data supprimée ───
// allDrivers et allVehicles supprimés.
// L'état initial des conducteurs et véhicules est un tableau vide par compte.

// Type de client : Particulier ou Professionnel
export type ClientType = "particulier" | "professionnel"

// Contact associé (pour clients professionnels)
export interface ClientContact {
  id: string
  prenom: string
  nom: string
  phone: string
}

// Adresse de facturation
export interface BillingAddress {
  rue: string
  codePostal: string
  ville: string
}

// Historique de trajets/documents
export interface ClientTripHistory {
  id: string
  date: string
  trajet: string
  montant: number
}

// Interface Client complète (compatible Factur-X)
export interface Client {
  id: string
  type: ClientType
  // Identité (Particulier)
  civilite?: "M." | "Mme"
  prenom?: string
  nom?: string
  // Identité (Professionnel)
  raisonSociale?: string
  siren?: string
  tvaIntra?: string
  contacts?: ClientContact[]
  // Coordonnées communes
  phone: string
  email: string
  // Facturation
  billingAddress: BillingAddress
  // Métadonnées
  trips: number
  lastTrip: string
  notes: string
  tag?: "VIP" | "Régulier"
  // Préférences Prestige (accueil personnalisé)
  preferences?: string
  // Historique des trajets (3 derniers)
  tripHistory?: ClientTripHistory[]
}

// ─── Mock data supprimée ───
// allClients et existingClients supprimés.
// L'état initial des clients est un tableau vide par compte.

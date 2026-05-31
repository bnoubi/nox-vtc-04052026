export interface Driver {
  id: string
  name: string
  initials: string
  online: boolean
  carteProExpiration: string // ISO date string
  carteProNumber?: string // Numero de carte professionnelle VTC
  apacExpiration: string // Attestation Préfectorale - ISO date string
  apacNumber?: string
  rcProExpiration: string // RC Professionnelle - ISO date string
  rcProNumber?: string
  phone?: string
  email?: string
  permisNumber?: string
  permisExpiration?: string
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
  pays?: string
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
  isMicroEntrepreneur?: boolean
  vatMode?: 'franchise' | 'normal'
  vatExemptionMention?: string
  legalNoticeText?: string
  rcProNumber?: string
  rcProCompany?: string
}

export type BCStatus = "brouillon" | "en_attente" | "confirme" | "en_cours" | "termine" | "annule_client" | "annule_chauffeur"
export type InvoiceStatus = "brouillon" | "envoyee" | "payee"

export interface BCDocument {
  id: string
  number: string
  // Payeur — référence vers public.clients
  clientId?: string
  client: string
  clientPhone?: string
  // Passager physiquement transporté (peut différer du client payeur)
  passagerNom?: string
  passagerTelephone?: string
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
  supplementsList?: (string | { label: string; montant: number; tva_rate?: number })[]

  date: string
  status: BCStatus
  type: "bc"
  trajet?: {
    depart: string
    arrivee: string
    distance?: number
    duree?: string
    date?: string
    time?: string
    passengers?: number
    luggage?: number
    stops?: string[]
    stops_optimized?: boolean
  }
  driverId?: string
  driverName?: string
  driverPhone?: string
  driverCarteVTC?: string
  vehicleId?: string
  vehicleName?: string
  vehiclePlate?: string
  notes?: string
  cgvText?: string
  cgvInclure?: boolean
  customerAcceptedAt?: string
  cgvVersionAccepted?: string
  signatairesNom?: string
  acceptanceMention?: string
  mode_horaire?: 'depart' | 'arrivee'
  heure_arrivee_souhaitee?: string | null
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
  // Lien vers le BC source
  bcId?: string
  bcRef: string
  // Identification client
  clientId?: string
  client: string
  clientPhone?: string
  // Identification chauffeur
  driverId?: string
  // Montants
  amount: number
  amountHT?: number
  tva?: number
  tvaRate?: number
  tvaMode?: string

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
  trajet?: {
    depart: string
    arrivee: string
    distance?: number
    duree?: string
    date?: string
    time?: string
    passengers?: number
    luggage?: number
    stops?: string[]
    stops_optimized?: boolean
  }
  passagerNom?: string
  passagerTelephone?: string
  driverName?: string
  driverPhone?: string
  driverCarteVTC?: string
  vehicleId?: string
  vehicleName?: string
  vehiclePlate?: string
  vehicleTypeEnergie?: string
  clientType?: "particulier" | "professionnel"
  clientSiren?: string
  clientEmail?: string
  clientTvaIntra?: string | null
  clientRaisonSociale?: string | null
  clientAddress?: { rue?: string; codePostal?: string; ville?: string; pays?: string }
  supplementsList?: (string | { label: string; montant: number; tva_rate?: number })[]
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

export interface TariffGrid {
  id: string
  name: string
  baseRate: number        // priseEnCharge → base_rate
  perKm: number           // prixKm → per_km
  perHour: number         // prixAttente → per_hour
  courseMinimum: number   // packed in forfaits JSONB
  supplements: TarifSupplement[]
  forfaits: TarifForfait[]
  tranches: TrancheHoraire[]
  applyWeekend: boolean
  applyHolidays: boolean
  isDefault: boolean
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
  // Supabase: vehicles.id (UUID)
  id: string
  // Supabase: vehicles.marque
  marque?: string
  // Supabase: vehicles.modele
  modele: string
  // Supabase: vehicles.immatriculation
  immatriculation: string
  // Supabase: vehicles.in_service
  inService: boolean
  // Supabase: vehicles.date_mise_en_circulation
  date_mise_en_circulation: string // Date de première immatriculation - ISO date string
  // Supabase: vehicles.type_energie
  type_energie: MotorType
  // Supabase: vehicles.category
  category: VehicleCategory
  // Supabase: vehicles.color
  color: string
  // Supabase: vehicles.assurance_transport_expiration
  assuranceTransportExpiration: string // Assurance Transport à Titre Onéreux - ISO date string
  // Supabase: vehicles.controle_technique_expiration
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
  pays?: string
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

// ─── Conformité légale — source de vérité centralisée ─────────────────────────

export const VAT_EXEMPTION_MENTION = "TVA non applicable, art. 293 B du CGI"

export interface TaxConfig {
  isMicroEntrepreneur: boolean
  vatMode: "franchise" | "normal"
  vatExemptionMention: string
  vatNumber: string | null
}

export interface DocumentRules {
  requireIssueDate: true
  requireSequentialNumber: true
  requireCustomerIdentity: true
  requireServiceBreakdown: true
  showCreationTime: false
}

export const documentRules: DocumentRules = {
  requireIssueDate: true,
  requireSequentialNumber: true,
  requireCustomerIdentity: true,
  requireServiceBreakdown: true,
  showCreationTime: false,
}

export const invoiceMandatoryFields = ["number", "date", "client", "amount"] as const
export const orderFormRecommendedFields = ["number", "date", "client", "trajet", "driverName"] as const

export function getTaxConfig(enterprise: EnterpriseProfile): TaxConfig {
  const vatMode: "franchise" | "normal" = enterprise.vatMode ?? (enterprise.isMicroEntrepreneur ? "franchise" : "normal")
  const isMicro = vatMode === "franchise"
  return {
    isMicroEntrepreneur: isMicro,
    vatMode,
    vatExemptionMention: enterprise.vatExemptionMention ?? VAT_EXEMPTION_MENTION,
    vatNumber: isMicro ? null : (enterprise.tvaIntra || null),
  }
}

export function getVatMention(enterprise: EnterpriseProfile): string | null {
  const vatMode = enterprise.vatMode ?? (enterprise.isMicroEntrepreneur ? "franchise" : "normal")
  return vatMode === "franchise" ? (enterprise.vatExemptionMention ?? VAT_EXEMPTION_MENTION) : null
}

export function isVatApplicable(enterprise: EnterpriseProfile): boolean {
  const vatMode = enterprise.vatMode ?? (enterprise.isMicroEntrepreneur ? "franchise" : "normal")
  return vatMode === "normal"
}

export function getLegalSellerIdentity(enterprise: EnterpriseProfile): string {
  return [
    enterprise.denomination || enterprise.name,
    enterprise.adresse,
    [enterprise.zipCode, enterprise.city].filter(Boolean).join(" "),
    enterprise.siren ? `SIREN : ${enterprise.siren}` : null,
    enterprise.evtcNumber ? `EVTC : ${enterprise.evtcNumber}` : null,
  ].filter(Boolean).join(" - ")
}

export interface Driver {
  id: string
  name: string
  initials: string
  online: boolean
  carteProExpiration: string // ISO date string
  apacExpiration: string // Attestation Préfectorale - ISO date string
  rcProExpiration: string // RC Professionnelle - ISO date string
}

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

export const allDrivers: Driver[] = [
  { id: "1", name: "Karim Benzari", initials: "KB", online: true, carteProExpiration: "2026-08-15", apacExpiration: "2026-12-31", rcProExpiration: "2026-09-15" },
  { id: "2", name: "Sophie Martin", initials: "SM", online: false, carteProExpiration: "2026-04-02", apacExpiration: "2026-03-15", rcProExpiration: "2026-06-30" },
  { id: "3", name: "Lucas Fernandez", initials: "LF", online: true, carteProExpiration: "2026-03-20", apacExpiration: "2026-11-20", rcProExpiration: "2026-04-10" },
  { id: "4", name: "Amélie Rousseau", initials: "AR", online: true, carteProExpiration: "2027-01-10", apacExpiration: "2027-06-01", rcProExpiration: "2027-03-15" },
  { id: "5", name: "Thomas Nguyen", initials: "TN", online: false, carteProExpiration: "2026-02-28", apacExpiration: "2026-02-15", rcProExpiration: "2026-01-20" },
]

export const allVehicles: Vehicle[] = [
  { id: "1", model: "Mercedes Classe S", plate: "AB-123-CD", inService: true, datePremiereImmat: "2022-03-15", motorType: "diesel", category: "berline", color: "#0F0F0F", assuranceTransportExpiration: "2026-03-18", controleTechniqueExpiration: "2026-09-01" },
  { id: "2", model: "BMW Série 7", plate: "EF-456-GH", inService: true, datePremiereImmat: "2021-06-20", motorType: "essence", category: "berline", color: "#F5F5F5", assuranceTransportExpiration: "2026-06-15", controleTechniqueExpiration: "2026-12-20" },
  { id: "3", model: "Audi A8 L", plate: "IJ-789-KL", inService: true, datePremiereImmat: "2019-11-10", motorType: "hybride", category: "berline", color: "#6B7280", assuranceTransportExpiration: "2026-05-01", controleTechniqueExpiration: "2026-02-10" },
  { id: "4", model: "Mercedes Classe V", plate: "MN-012-OP", inService: true, datePremiereImmat: "2023-01-05", motorType: "diesel", category: "van", color: "#0F0F0F", assuranceTransportExpiration: "2026-07-22", controleTechniqueExpiration: "2026-11-30" },
  { id: "5", model: "Tesla Model S", plate: "QR-345-ST", inService: false, datePremiereImmat: "2024-08-12", motorType: "electrique", category: "berline", color: "#1E3A5F", assuranceTransportExpiration: "2026-04-10", controleTechniqueExpiration: "2026-08-15" },
]

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
}

export const allClients: Client[] = [
  {
    id: "1",
    type: "particulier",
    civilite: "M.",
    prenom: "Alexandre",
    nom: "Laurent",
    phone: "+33 6 12 34 56 78",
    email: "a.laurent@email.com",
    billingAddress: { rue: "8 Rue de Rivoli", codePostal: "75001", ville: "Paris" },
    trips: 24,
    lastTrip: "06/02/2026",
    notes: "Client fidèle. Préfère les Mercedes. Toujours ponctuel.",
    tag: "VIP",
  },
  {
    id: "2",
    type: "particulier",
    civilite: "Mme",
    prenom: "Sophie",
    nom: "Beaumont",
    phone: "+33 6 98 76 54 32",
    email: "s.beaumont@email.com",
    billingAddress: { rue: "112 Rue du Faubourg Saint-Honoré", codePostal: "75008", ville: "Paris" },
    trips: 12,
    lastTrip: "05/02/2026",
    notes: "Demande souvent un siège enfant. Trajets aéroport fréquents.",
    tag: "Régulier",
  },
  {
    id: "3",
    type: "professionnel",
    raisonSociale: "Cabinet Moreau Avocats",
    siren: "123456789",
    tvaIntra: "FR12345678901",
    contacts: [
      { id: "c1", prenom: "Philippe", nom: "Moreau", phone: "+33 6 55 44 33 22" },
      { id: "c2", prenom: "Marie", nom: "Dupont", phone: "+33 6 55 44 33 23" },
    ],
    phone: "+33 1 40 00 00 00",
    email: "contact@cabinet-moreau.fr",
    billingAddress: { rue: "25 Avenue de l'Opéra", codePostal: "75001", ville: "Paris" },
    trips: 45,
    lastTrip: "28/01/2026",
    notes: "Facturation mensuelle. Trajets professionnels uniquement.",
    tag: "VIP",
  },
  {
    id: "4",
    type: "professionnel",
    raisonSociale: "Luxe & Co SARL",
    siren: "987654321",
    contacts: [
      { id: "c3", prenom: "Claire", nom: "Dubois", phone: "+33 6 11 22 33 44" },
    ],
    phone: "+33 1 42 00 00 00",
    email: "transport@luxe-co.com",
    billingAddress: { rue: "16 Avenue Montaigne", codePostal: "75008", ville: "Paris" },
    trips: 31,
    lastTrip: "04/02/2026",
    notes: "Directrice achats. Facturation entreprise mensuelle.",
    tag: "VIP",
  },
  {
    id: "5",
    type: "particulier",
    civilite: "M.",
    prenom: "Marc",
    nom: "Petit",
    phone: "+33 6 77 88 99 00",
    email: "marc.petit@gmail.com",
    billingAddress: { rue: "Gare du Nord", codePostal: "75010", ville: "Paris" },
    trips: 5,
    lastTrip: "20/01/2026",
    notes: "Nouveau client. À fidéliser.",
  },
  {
    id: "6",
    type: "particulier",
    civilite: "Mme",
    prenom: "Isabelle",
    nom: "Garcia",
    phone: "+33 6 44 55 66 77",
    email: "i.garcia@design.fr",
    billingAddress: { rue: "7 Rue de Passy", codePostal: "75016", ville: "Paris" },
    trips: 15,
    lastTrip: "02/02/2026",
    notes: "Paiement CB uniquement. Trajets réguliers week-end.",
    tag: "Régulier",
  },
]

// Legacy format pour compatibilité
export const existingClients = allClients.map(c => ({
  id: c.id,
  title: c.type === "particulier" ? c.civilite : "",
  name: c.type === "particulier" ? `${c.prenom} ${c.nom}` : c.raisonSociale,
  phone: c.phone,
}))

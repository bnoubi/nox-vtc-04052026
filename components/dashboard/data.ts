export interface Driver {
  id: string
  name: string
  initials: string
  online: boolean
  carteProExpiration: string // ISO date string
}

export interface Vehicle {
  id: string
  model: string
  plate: string
  inService: boolean
  assuranceExpiration: string // ISO date string
  controleTechniqueExpiration: string // ISO date string
}

export const allDrivers: Driver[] = [
  { id: "1", name: "Karim Benzari", initials: "KB", online: true, carteProExpiration: "2026-08-15" },
  { id: "2", name: "Sophie Martin", initials: "SM", online: false, carteProExpiration: "2026-04-02" },
  { id: "3", name: "Lucas Fernandez", initials: "LF", online: true, carteProExpiration: "2026-03-20" },
  { id: "4", name: "Amélie Rousseau", initials: "AR", online: true, carteProExpiration: "2027-01-10" },
  { id: "5", name: "Thomas Nguyen", initials: "TN", online: false, carteProExpiration: "2026-02-28" },
]

export const allVehicles: Vehicle[] = [
  { id: "1", model: "Mercedes Classe S", plate: "AB-123-CD", inService: true, assuranceExpiration: "2026-03-18", controleTechniqueExpiration: "2026-09-01" },
  { id: "2", model: "BMW Série 7", plate: "EF-456-GH", inService: true, assuranceExpiration: "2026-06-15", controleTechniqueExpiration: "2026-12-20" },
  { id: "3", model: "Audi A8 L", plate: "IJ-789-KL", inService: true, assuranceExpiration: "2026-05-01", controleTechniqueExpiration: "2026-02-10" },
  { id: "4", model: "Mercedes Classe V", plate: "MN-012-OP", inService: true, assuranceExpiration: "2026-07-22", controleTechniqueExpiration: "2026-11-30" },
  { id: "5", model: "Tesla Model S", plate: "QR-345-ST", inService: false, assuranceExpiration: "2026-04-10", controleTechniqueExpiration: "2026-08-15" },
]

export const existingClients = [
  { id: "1", title: "M.", name: "Alexandre Laurent", phone: "+33 6 12 34 56 78" },
  { id: "2", title: "Mme", name: "Isabelle Beaumont", phone: "+33 6 23 45 67 89" },
  { id: "3", title: "M.", name: "Philippe Moreau", phone: "+33 6 34 56 78 90" },
  { id: "4", title: "Mme", name: "Claire Dubois", phone: "+33 6 45 67 89 01" },
  { id: "5", title: "M.", name: "David Garcia", phone: "+33 6 56 78 90 12" },
  { id: "6", title: "Mme", name: "Marie Fontaine", phone: "+33 6 67 89 01 23" },
]

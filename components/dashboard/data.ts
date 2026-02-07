export interface Driver {
  id: string
  name: string
  initials: string
  online: boolean
}

export interface Vehicle {
  id: string
  model: string
  plate: string
  inService: boolean
}

export const allDrivers: Driver[] = [
  { id: "1", name: "Karim Benzari", initials: "KB", online: true },
  { id: "2", name: "Sophie Martin", initials: "SM", online: false },
  { id: "3", name: "Lucas Fernandez", initials: "LF", online: true },
  { id: "4", name: "Amélie Rousseau", initials: "AR", online: true },
  { id: "5", name: "Thomas Nguyen", initials: "TN", online: false },
  { id: "6", name: "Fatima El Amrani", initials: "FA", online: true },
  { id: "7", name: "Pierre Leclerc", initials: "PL", online: false },
  { id: "8", name: "Nadia Bousquet", initials: "NB", online: true },
  { id: "9", name: "Julien Morel", initials: "JM", online: true },
  { id: "10", name: "Yasmine Khedira", initials: "YK", online: false },
]

export const allVehicles: Vehicle[] = [
  { id: "1", model: "Mercedes Classe S", plate: "AB-123-CD", inService: true },
  { id: "2", model: "BMW Série 7", plate: "EF-456-GH", inService: true },
  { id: "3", model: "Audi A8 L", plate: "IJ-789-KL", inService: true },
  { id: "4", model: "Mercedes Classe V", plate: "MN-012-OP", inService: true },
  { id: "5", model: "Van Mercedes Sprinter", plate: "QR-345-ST", inService: false },
  { id: "6", model: "Tesla Model S", plate: "UV-678-WX", inService: true },
  { id: "7", model: "Range Rover Autobiography", plate: "YZ-901-AB", inService: true },
  { id: "8", model: "Porsche Panamera", plate: "CD-234-EF", inService: false },
  { id: "9", model: "Lexus LS 500h", plate: "GH-567-IJ", inService: true },
  { id: "10", model: "Bentley Flying Spur", plate: "KL-890-MN", inService: true },
]

export const existingClients = [
  { id: "1", title: "M.", name: "Alexandre Laurent", phone: "+33 6 12 34 56 78" },
  { id: "2", title: "Mme", name: "Isabelle Beaumont", phone: "+33 6 23 45 67 89" },
  { id: "3", title: "M.", name: "Philippe Moreau", phone: "+33 6 34 56 78 90" },
  { id: "4", title: "Mme", name: "Claire Dubois", phone: "+33 6 45 67 89 01" },
  { id: "5", title: "M.", name: "David Garcia", phone: "+33 6 56 78 90 12" },
  { id: "6", title: "Mme", name: "Marie Fontaine", phone: "+33 6 67 89 01 23" },
]

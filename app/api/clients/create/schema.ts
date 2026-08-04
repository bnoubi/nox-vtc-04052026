import { z } from "zod"

const BillingAddressSchema = z.object({
  rue:        z.string().max(200).optional(),
  codePostal: z.string().regex(/^\d{5}$/, "Code postal invalide").optional(),
  ville:      z.string().max(100).optional(),
}).optional()

const ContactSchema = z.object({
  nom:       z.string().max(100),
  prenom:    z.string().max(100).optional(),
  email:     z.string().email().optional(),
  telephone: z.string().max(25).optional(),
  role:      z.string().max(50).optional(),
}).optional()

export const CreateClientSchema = z.object({
  type:           z.enum(["particulier", "entreprise"]),
  civilite:       z.enum(["M.", "Mme", "Dr", ""]).optional(),
  nom:            z.string().min(1, "Nom requis").max(100).optional(),
  prenom:         z.string().max(100).optional(),
  raisonSociale:  z.string().max(200).optional(),
  siren:          z.string().regex(/^\d{9}$/, "SIREN invalide (9 chiffres)").optional().or(z.literal("")),
  tvaIntra:       z.string().regex(/^FR\d{11}$/, "TVA intracommunautaire invalide").optional().or(z.literal("")),
  email:          z.string().email("Email invalide").optional().or(z.literal("")),
  phone:          z.string().max(25).optional(),
  billingAddress: BillingAddressSchema,
  contacts:       z.array(ContactSchema).max(20).optional(),
  notes:          z.string().max(2000).optional(),
  tag:            z.string().max(50).optional(),
  preferences:    z.record(z.unknown()).optional(),
})

export type CreateClientInput = z.infer<typeof CreateClientSchema>

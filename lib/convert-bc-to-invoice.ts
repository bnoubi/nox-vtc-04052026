import { createClient } from "@/lib/supabase/client"

export async function convertBCToInvoice(
  bcId: string,
  userId: string
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  const supabase = createClient()

  // 1. Fetch the BC — verify ownership
  const { data: bc, error: bcError } = await supabase
    .from("bcs")
    .select("*")
    .eq("id", bcId)
    .eq("user_id", userId)
    .single()

  if (bcError || !bc) {
    return { success: false, error: bcError?.message ?? "BC introuvable" }
  }

  // 1b. Fetch vehicle to get type_energie
  const { data: vehicle } =
    await supabase
      .from("vehicles")
      .select("type_energie")
      .eq("id", bc.vehicle_id)
      .single()

  // 1c. Fetch client for denormalized display fields
  const { data: client } =
    await supabase
      .from("clients")
      .select("nom, prenom, civilite, raison_sociale, siren, telephone, email, tva_intra, adresse, code_postal, ville, pays, type")
      .eq("id", bc.client_id)
      .single()

  // 2. Generate invoice number: F-YYYY-NNN (per user, per year)
  const year = new Date().getFullYear()
  const prefix = `F-${year}-`

  const { data: existing } = await supabase
    .from("invoices")
    .select("numero")
    .eq("user_id", userId)
    .like("numero", `${prefix}%`)
    .order("numero", { ascending: false })
    .limit(1)

  let nextSeq = 1
  if (existing && existing.length > 0) {
    const last = existing[0].numero as string
    const seq = parseInt(last.replace(prefix, ""), 10)
    if (!isNaN(seq)) nextSeq = seq + 1
  }
  const numero = `${prefix}${String(nextSeq).padStart(3, "0")}`

  // 3. Dates
  const today = new Date()
  const echeanceDate = new Date(today)
  echeanceDate.setDate(echeanceDate.getDate() + 30)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  // 4. Derive tva_mode from which TVA buckets are non-zero
  const rates: string[] = []
  if (bc.tva_10_amount > 0) rates.push("10%")
  if (bc.tva_20_amount > 0) rates.push("20%")
  if (bc.tva_5_5_amount > 0) rates.push("5.5%")
  if (bc.tva_other_amount > 0) rates.push("autre")
  const tva_mode = rates.length === 1 ? rates[0] : rates.length > 1 ? "mixte" : "0%"

  // 5. Build items from BC base + supplements
  const items: Array<{ label: string; quantite: number; prix_ht: number; tva_rate: number }> = []

  if (bc.base_ht > 0) {
    const label =
      bc.trajet && typeof bc.trajet === "object" && (bc.trajet as Record<string, unknown>).description
        ? String((bc.trajet as Record<string, unknown>).description)
        : "Course VTC"
    items.push({ label, quantite: 1, prix_ht: bc.base_ht, tva_rate: bc.tva_rate ?? 10 })
  }

  if (bc.supplements_list && Array.isArray(bc.supplements_list)) {
    for (const s of bc.supplements_list as Array<{ label?: string; montant?: number; tva_rate?: number }>) {
      if (s.montant && s.montant > 0) {
        items.push({
          label: s.label ?? "Supplément",
          quantite: 1,
          prix_ht: s.montant,
          tva_rate: s.tva_rate ?? bc.tva_rate ?? 10,
        })
      }
    }
  }

  // 6. Insert invoice
  const { data: inserted, error: insertError } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      numero,
      status: "brouillon",
      date_emission: fmt(today),
      echeance: fmt(echeanceDate),
      bc_id: bc.id,
      bc_ref: bc.numero,
      client_id: bc.client_id,
      driver_id: bc.driver_id,
      vehicle_id: bc.vehicle_id,
      items,
      montant_ht: bc.montant_ht,
      montant_ttc: bc.montant_ttc,
      tva: bc.tva,
      base_ht: bc.base_ht,
      supplements_ht: bc.supplements_ht,
      tva_10_amount: bc.tva_10_amount,
      tva_20_amount: bc.tva_20_amount,
      tva_5_5_amount: bc.tva_5_5_amount,
      tva_other_amount: bc.tva_other_amount,
      discount_value: bc.discount_value,
      discount_type: bc.discount_type,
      original_ht: bc.original_ht,
      original_ttc: bc.original_ttc,
      notes: bc.notes,
      cgv_text: bc.cgv_text,
      supplements_list: bc.supplements_list,
      trajet: bc.trajet
        ? {
            ...(bc.trajet as Record<string, unknown>),
            type_energie: vehicle?.type_energie ?? null,
          }
        : null,
      tva_mode,
      pdf_url: null,
      client_nom: client
        ? (client.type === "professionnel"
          ? client.raison_sociale
          : `${client.civilite ?? ""} ${client.prenom ?? ""} ${client.nom ?? ""}`.trim())
        : bc.client_nom ?? "",
      client_phone: client?.telephone ?? bc.client_telephone ?? null,
      passager_nom: bc.passager_nom ?? null,
      passager_telephone: bc.passager_telephone ?? null,
      client_siren: client?.siren ?? null,
      client_address: client ? {
        rue: client.adresse ?? "",
        code_postal: client.code_postal ?? "",
        ville: client.ville ?? "",
        pays: client.pays ?? "France",
      } : null,
      client_type: client?.type ?? null,
      client_email: client?.email ?? null,
      client_tva_intra: client?.tva_intra ?? null,
      driver_nom: bc.driver_nom ?? null,
      driver_phone: bc.driver_phone ?? null,
      driver_carte_vtc: bc.driver_carte_vtc ?? null,
      vehicle_nom: bc.vehicle_nom ?? null,
      vehicle_immatriculation: bc.vehicle_immatriculation ?? null,
    })
    .select("id")
    .single()

  if (insertError || !inserted) {
    return { success: false, error: insertError?.message ?? "Échec de l'insertion" }
  }

  return { success: true, invoiceId: inserted.id }
}

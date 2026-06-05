import type { BCDocument, InvoiceDocument, EnterpriseProfile } from "@/components/dashboard/data"
import { type FacturXData, generateFacturXML } from "./facturx-xml"
import { embedFacturXML } from "./facturx-embed"

export async function buildFacturXFromBC(
  pdfBlob: Blob,
  bc: BCDocument,
  enterprise: EnterpriseProfile
): Promise<Blob> {
  const isFranchise = (enterprise.vatMode ?? "franchise") === "franchise"
  const totalHT = bc.amountHT ?? (isFranchise ? bc.amount : bc.amount / 1.1)
  const totalVat = isFranchise ? 0 : (bc.tva ?? bc.amount - totalHT)
  const totalTTC = bc.amount

  const description =
    bc.trajet?.depart && bc.trajet?.arrivee
      ? `Transport VTC — ${bc.trajet.depart} → ${bc.trajet.arrivee}`
      : "Transport VTC"

  const vatRate = isFranchise ? 0 : (bc.tvaRate ?? 10)

  const data: FacturXData = {
    sellerName: enterprise.denomination || enterprise.name,
    sellerSiren: enterprise.siren ?? "",
    sellerAddress: enterprise.adresse ?? "",
    sellerCity: enterprise.city ?? "",
    sellerPostalCode: enterprise.zipCode ?? "",
    sellerCountry: enterprise.pays ?? "FR",
    sellerVatNumber: enterprise.tvaIntra || enterprise.tva || undefined,
    isFranchise,
    buyerName: bc.client,
    invoiceNumber: bc.number,
    invoiceDate: bc.date,
    currency: "EUR",
    lines: [
      {
        description,
        quantity: 1,
        unitPrice: parseFloat(totalHT.toFixed(2)),
        vatRate,
        lineTotal: parseFloat(totalHT.toFixed(2)),
      },
    ],
    totalHT: parseFloat(totalHT.toFixed(2)),
    totalVat: parseFloat(totalVat.toFixed(2)),
    totalTTC: parseFloat(totalTTC.toFixed(2)),
  }

  const xmlString = generateFacturXML(data)
  return embedFacturXML(pdfBlob, xmlString, bc.number)
}

export async function buildFacturXFromInvoice(
  pdfBlob: Blob,
  invoice: InvoiceDocument,
  enterprise: EnterpriseProfile
): Promise<Blob> {
  const isFranchise = (enterprise.vatMode ?? "franchise") === "franchise"
  const totalTTC = invoice.amount ?? 0
  const rawHT = invoice.amountHT != null ? invoice.amountHT : (isFranchise ? totalTTC : totalTTC / 1.1)
  const totalHT = isNaN(rawHT) || rawHT <= 0 ? (isFranchise ? totalTTC : totalTTC / 1.1) : rawHT
  const rawVat = invoice.tva != null ? invoice.tva : Math.max(0, totalTTC - totalHT)
  const totalVat = isFranchise ? 0 : (isNaN(rawVat) ? 0 : rawVat)
  const vatRate = isFranchise ? 0 : (invoice.tvaRate ?? 10)

  const lines = invoice.items && invoice.items.length > 0
    ? invoice.items.map(item => ({
        description: item.designation || "Prestation",
        quantity: 1,
        unitPrice: parseFloat((item.amountHT ?? 0).toFixed(2)),
        vatRate: item.tvaRate ?? 0,
        lineTotal: parseFloat((item.amountHT ?? 0).toFixed(2)),
      }))
    : [{
        description:
          invoice.trajet?.depart && invoice.trajet?.arrivee
            ? `Transport VTC — ${invoice.trajet.depart} → ${invoice.trajet.arrivee}`
            : "Transport VTC",
        quantity: 1,
        unitPrice: parseFloat(totalHT.toFixed(2)),
        vatRate,
        lineTotal: parseFloat(totalHT.toFixed(2)),
      }]

  const data: FacturXData = {
    sellerName: enterprise.denomination || enterprise.name || "Prestataire",
    sellerSiren: enterprise.siren ?? "",
    sellerAddress: enterprise.adresse ?? "",
    sellerCity: enterprise.city ?? "",
    sellerPostalCode: enterprise.zipCode ?? "",
    sellerCountry: enterprise.pays ?? "FR",
    sellerVatNumber: (enterprise.tvaIntra || enterprise.tva) || undefined,
    isFranchise,
    buyerName: invoice.client || "Client",
    buyerSiren: invoice.clientSiren ?? undefined,
    invoiceNumber: invoice.number,
    invoiceDate: invoice.date,
    currency: "EUR",
    lines,
    totalHT: parseFloat(totalHT.toFixed(2)),
    totalVat: parseFloat(totalVat.toFixed(2)),
    totalTTC: parseFloat(totalTTC.toFixed(2)),
  }

  const xmlString = generateFacturXML(data)
  return embedFacturXML(pdfBlob, xmlString, invoice.number)
}

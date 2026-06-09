import type { BCDocument, InvoiceDocument, EnterpriseProfile } from "@/components/dashboard/data"
import { type FacturXData, generateFacturXML } from "./facturx-xml"
import { embedFacturXML } from "./facturx-embed"

function vatRateFromMode(tvaMode?: string, fallback?: number): number {
  if (tvaMode === "franchise") return 0
  if (tvaMode === "20%") return 20
  if (tvaMode === "10%") return 10
  return fallback ?? 10
}

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
    sellerCountry: "FR",
    sellerVatNumber: enterprise.tvaIntra || enterprise.tva || undefined,
    isFranchise,
    buyerName: bc.client,
    buyerCountry: "FR",
    invoiceNumber: bc.number,
    invoiceDate: bc.date,
    currency: "EUR",
    lines: [
      {
        description,
        quantity: 1,
        unitPrice: parseFloat(totalHT.toFixed(2)),
        vatRate: isFranchise ? 0 : (vatRate > 0 ? vatRate : 10),
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
  const isFranchise = invoice.tvaMode === "franchise" ||
    (!invoice.tvaMode && (enterprise.vatMode ?? "franchise") === "franchise")
  const totalTTC = invoice.amount ?? 0
  const rawHT = invoice.amountHT != null ? invoice.amountHT : (isFranchise ? totalTTC : totalTTC / 1.1)
  const totalHT = isNaN(rawHT) || rawHT <= 0 ? (isFranchise ? totalTTC : totalTTC / 1.1) : rawHT
  const rawVat = invoice.tva != null ? invoice.tva : Math.max(0, totalTTC - totalHT)
  const totalVat = isFranchise ? 0 : (isNaN(rawVat) ? 0 : rawVat)
  const vatRate = isFranchise ? 0 : vatRateFromMode(invoice.tvaMode, invoice.tvaRate)
  const lineVatRate = isFranchise ? 0 : (vatRate > 0 ? vatRate : 10)

  console.log('[FacturX Builder Invoice]', {
    totalHT: totalHT,
    totalVat: totalVat,
    totalTTC: totalTTC,
    vatRate: vatRate,
    isFranchise: isFranchise,
    rawHT: invoice.amountHT,
    rawTva: invoice.tva,
    rawAmount: invoice.amount,
    linesCount: invoice.items?.length ?? 0
  })

  const lines = invoice.items && invoice.items.length > 0
    ? invoice.items.map(item => {
        const desc = item.label || item.designation || "Prestation"
        const ht = item.prix_ht ?? item.amountHT ?? 0
        const rate = isFranchise ? 0 : (item.tva_rate ?? item.tvaRate ?? 10)
        return {
          description: desc,
          quantity: 1,
          unitPrice: parseFloat(ht.toFixed(2)),
          vatRate: rate,
          lineTotal: parseFloat(ht.toFixed(2)),
        }
      })
    : [{
        description:
          invoice.trajet?.depart && invoice.trajet?.arrivee
            ? `Transport VTC — ${invoice.trajet.depart} → ${invoice.trajet.arrivee}`
            : "Transport VTC",
        quantity: 1,
        unitPrice: parseFloat(totalHT.toFixed(2)),
        vatRate: lineVatRate,
        lineTotal: parseFloat(totalHT.toFixed(2)),
      }]

  const data: FacturXData = {
    sellerName: enterprise.denomination || enterprise.name || "Prestataire",
    sellerSiren: enterprise.siren ?? "",
    sellerAddress: enterprise.adresse ?? "",
    sellerCity: enterprise.city ?? "",
    sellerPostalCode: enterprise.zipCode ?? "",
    sellerCountry: "FR",
    sellerVatNumber: (enterprise.tvaIntra || enterprise.tva) || undefined,
    isFranchise,
    buyerName: invoice.client || "Client",
    buyerSiren: invoice.clientSiren ?? undefined,
    buyerCountry: "FR",
    invoiceNumber: invoice.number,
    invoiceDate: invoice.date,
    dueDate: (invoice as any).echeance ?? undefined,
    currency: "EUR",
    lines,
    totalHT: parseFloat(totalHT.toFixed(2)),
    totalVat: parseFloat(totalVat.toFixed(2)),
    totalTTC: parseFloat(totalTTC.toFixed(2)),
  }

  const xmlString = generateFacturXML(data)
  return embedFacturXML(pdfBlob, xmlString, invoice.number)
}

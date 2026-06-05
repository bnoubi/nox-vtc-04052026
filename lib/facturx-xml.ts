import { create } from "xmlbuilder2"

export interface FacturXData {
  sellerName: string
  sellerSiren: string
  sellerAddress: string
  sellerCity: string
  sellerPostalCode: string
  sellerCountry: string
  sellerVatNumber?: string
  isFranchise: boolean
  buyerName: string
  buyerSiren?: string
  buyerCountry?: string
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  currency: string
  lines: {
    description: string
    quantity: number
    unitPrice: number
    vatRate: number
    lineTotal: number
  }[]
  totalHT: number
  totalVat: number
  totalTTC: number
}

function toDateCode(dateStr: string): string {
  // Accept DD/MM/YYYY or YYYY-MM-DD
  const parts = dateStr.includes("/") ? dateStr.split("/") : dateStr.split("-")
  if (parts.length !== 3) return dateStr.replace(/[-/]/g, "")
  if (dateStr.includes("/")) return `${parts[2]}${parts[1].padStart(2, "0")}${parts[0].padStart(2, "0")}`
  return parts.join("")
}

function groupByVatRate(lines: FacturXData["lines"]): { rate: number; basis: number; vat: number }[] {
  const map = new Map<number, { basis: number; vat: number }>()
  for (const l of lines) {
    const g = map.get(l.vatRate) ?? { basis: 0, vat: 0 }
    map.set(l.vatRate, {
      basis: g.basis + l.lineTotal,
      vat: g.vat + l.lineTotal * (l.vatRate / 100),
    })
  }
  return Array.from(map.entries()).map(([rate, g]) => ({ rate, ...g }))
}

export function generateFacturXML(data: FacturXData): string {
  const dateCode = toDateCode(data.invoiceDate)
  const lineTotalSum = data.lines.reduce((acc, l) => acc + l.lineTotal, 0)

  const doc = create({ version: "1.0", encoding: "UTF-8" })
  const root = doc.ele("rsm:CrossIndustryInvoice", {
    "xmlns:rsm": "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
    "xmlns:ram": "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
    "xmlns:udt": "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
  })

  // ── ExchangedDocumentContext ──────────────────────────────────────────────
  root.ele("rsm:ExchangedDocumentContext")
    .ele("ram:GuidelineSpecifiedDocumentContextParameter")
    .ele("ram:ID").txt("urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931")

  // ── ExchangedDocument ─────────────────────────────────────────────────────
  const excDoc = root.ele("rsm:ExchangedDocument")
  excDoc.ele("ram:ID").txt(data.invoiceNumber)
  excDoc.ele("ram:TypeCode").txt("380")
  excDoc.ele("ram:IssueDateTime")
    .ele("udt:DateTimeString").att("format", "102").txt(dateCode)

  // ── SupplyChainTradeTransaction ───────────────────────────────────────────
  const trans = root.ele("rsm:SupplyChainTradeTransaction")

  // Lines
  data.lines.forEach((line, i) => {
    const item = trans.ele("ram:IncludedSupplyChainTradeLineItem")
    item.ele("ram:AssociatedDocumentLineDocument")
      .ele("ram:LineID").txt(String(i + 1))
    item.ele("ram:SpecifiedTradeProduct")
      .ele("ram:Name").txt(line.description)
    item.ele("ram:SpecifiedLineTradeAgreement")
      .ele("ram:NetPriceProductTradePrice")
      .ele("ram:ChargeAmount").txt(line.unitPrice.toFixed(2))
    item.ele("ram:SpecifiedLineTradeDelivery")
      .ele("ram:BilledQuantity").att("unitCode", "C62").txt(line.quantity.toFixed(2))
    const lineSett = item.ele("ram:SpecifiedLineTradeSettlement")
    const lineTax = lineSett.ele("ram:ApplicableTradeTax")
    lineTax.ele("ram:TypeCode").txt("VAT")
    lineTax.ele("ram:CategoryCode").txt(data.isFranchise ? "E" : "S")
    lineTax.ele("ram:RateApplicablePercent").txt(data.isFranchise ? "0.00" : line.vatRate.toFixed(2))
    lineSett.ele("ram:SpecifiedTradeSettlementLineMonetarySummation")
      .ele("ram:LineTotalAmount").txt(line.lineTotal.toFixed(2))
  })

  // Header Trade Agreement
  const hta = trans.ele("ram:ApplicableHeaderTradeAgreement")

  const seller = hta.ele("ram:SellerTradeParty")
  seller.ele("ram:Name").txt(data.sellerName)
  if (data.sellerSiren) {
    seller.ele("ram:SpecifiedLegalOrganization")
      .ele("ram:ID").att("schemeID", "0002").txt(data.sellerSiren)
  }
  const sellerAddr = seller.ele("ram:PostalTradeAddress")
  sellerAddr.ele("ram:PostcodeCode").txt(data.sellerPostalCode || "")
  sellerAddr.ele("ram:LineOne").txt(data.sellerAddress || "")
  sellerAddr.ele("ram:CityName").txt(data.sellerCity || "")
  sellerAddr.ele("ram:CountryID").txt(data.sellerCountry || "FR")
  if (!data.isFranchise && data.sellerVatNumber) {
    seller.ele("ram:SpecifiedTaxRegistration")
      .ele("ram:ID").att("schemeID", "VA").txt(data.sellerVatNumber)
  }
  if (data.isFranchise && data.sellerSiren) {
    seller.ele("ram:SpecifiedTaxRegistration")
      .ele("ram:ID").att("schemeID", "VA").txt("FR" + data.sellerSiren)
  }
  const buyer = hta.ele("ram:BuyerTradeParty")
  buyer.ele("ram:Name").txt(data.buyerName)
  if (data.buyerSiren) {
    buyer.ele("ram:SpecifiedLegalOrganization")
      .ele("ram:ID").att("schemeID", "0002").txt(data.buyerSiren)
  }
  buyer.ele("ram:PostalTradeAddress")
    .ele("ram:CountryID").txt(data.buyerCountry ?? "FR")

  // Header Trade Delivery (required by spec)
  trans.ele("ram:ApplicableHeaderTradeDelivery")

  // Header Trade Settlement
  const sett = trans.ele("ram:ApplicableHeaderTradeSettlement")
  sett.ele("ram:InvoiceCurrencyCode").txt(data.currency)

  const taxGroups = groupByVatRate(data.lines)
  for (const g of taxGroups) {
    const tax = sett.ele("ram:ApplicableTradeTax")
    const calculatedVat = data.isFranchise ? 0 : parseFloat((g.basis * g.rate / 100).toFixed(2))
    tax.ele("ram:CalculatedAmount").txt(calculatedVat.toFixed(2))
    tax.ele("ram:TypeCode").txt("VAT")
    if (data.isFranchise) {
      tax.ele("ram:ExemptionReason").txt("Franchise en base de TVA — Article 293 B du CGI")
    }
    tax.ele("ram:BasisAmount").txt(g.basis.toFixed(2))
    tax.ele("ram:CategoryCode").txt(data.isFranchise ? "E" : "S")
    tax.ele("ram:RateApplicablePercent").txt(data.isFranchise ? "0.00" : g.rate.toFixed(2))
  }

  const dueDateCode = toDateCode(data.dueDate ?? data.invoiceDate)
  sett.ele("ram:SpecifiedTradePaymentTerms")
    .ele("ram:DueDateDateTime")
    .ele("udt:DateTimeString").att("format", "102").txt(dueDateCode)

  const sum = sett.ele("ram:SpecifiedTradeSettlementHeaderMonetarySummation")
  sum.ele("ram:LineTotalAmount").txt(lineTotalSum.toFixed(2))
  sum.ele("ram:TaxBasisTotalAmount").txt(lineTotalSum.toFixed(2))
  sum.ele("ram:TaxTotalAmount").att("currencyID", data.currency).txt(data.totalVat.toFixed(2))
  sum.ele("ram:GrandTotalAmount").txt(data.totalTTC.toFixed(2))
  sum.ele("ram:DuePayableAmount").txt(data.totalTTC.toFixed(2))

  return doc.end({ prettyPrint: true })
}

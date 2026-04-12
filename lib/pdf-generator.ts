import { jsPDF } from "jspdf"
import type { InvoiceDocument, EnterpriseProfile, BCDocument } from "@/components/dashboard/data"

function formatPrice(value: number | undefined): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(value) + " \u20ac"
}

export function generateInvoicePDF(invoice: InvoiceDocument, enterprise: EnterpriseProfile) {
  _generateDocumentPDF(invoice, enterprise, true)
}

export function generateBCPDF(bc: BCDocument, enterprise: EnterpriseProfile) {
  _generateDocumentPDF(bc, enterprise, false)
}

function _generateDocumentPDF(data: any, enterprise: EnterpriseProfile, isInvoice: boolean) {
  const doc = new jsPDF()

  // Colors
  const gold = "#D4AF37"
  const dark = "#1A1A1A"
  const gray = "#71717A"
  const lightGray = "#F4F4F5"

  // 1. HEADER
  doc.setFontSize(22)
  doc.setTextColor(dark)
  doc.setFont("helvetica", "bold")
  doc.text(enterprise.name || enterprise.denomination || "Entreprise Inconnue", 20, 30)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  doc.text(enterprise.adresse || "", 20, 38)
  let _y = 43
  if (enterprise.siren) { doc.text(`SIREN : ${enterprise.siren}`, 20, _y); _y += 5 }
  if (enterprise.tvaIntra) { doc.text(`TVA : ${enterprise.tvaIntra}`, 20, _y); _y += 5 }
  if (enterprise.evtcNumber) { 
    doc.setTextColor(gold); 
    doc.text(`EVTC : ${enterprise.evtcNumber}`, 20, _y); 
    doc.setTextColor(gray); 
  }

  doc.setFontSize(24)
  doc.setTextColor(dark)
  doc.setFont("helvetica", "bold")
  doc.text(isInvoice ? "FACTURE" : "BON DE R\u00c9SERVATION", 190, 30, { align: "right" })

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  doc.text(`Num\u00e9ro : ${data.number}`, 190, 38, { align: "right" })
  doc.text(`Date : ${data.date}`, 190, 43, { align: "right" })
  
  if (isInvoice) {
    if (data.echeance) doc.text(`\u00c9ch\u00e9ance : ${data.echeance}`, 190, 48, { align: "right" })
    if (data.bcRef) doc.text(`R\u00e9f. BC : ${data.bcRef}`, 190, 53, { align: "right" })
  }

  // 2. CLIENT & RESOURCES
  doc.setDrawColor(230)
  doc.line(20, 65, 190, 65)

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(isInvoice ? "DESTINATAIRE / CLIENT" : "CLIENT", 20, 75)
  doc.setFont("helvetica", "normal")
  doc.text(data.client || "", 20, 80)
  if (data.clientPhone) doc.text(data.clientPhone, 20, 85)

  let rightX = 110
  if (data.driverName || data.vehicleName) {
    doc.setFont("helvetica", "bold")
    doc.text("CHAUFFEUR & V\u00c9HICULE", rightX, 75)
    doc.setFont("helvetica", "normal")
    let yD = 80
    if (data.driverName) {
        doc.text(`Chauffeur : ${data.driverName}`, rightX, yD)
        yD += 5
    }
    if (data.vehicleName) {
        doc.text(`V\u00e9hicule : ${data.vehicleName} ${data.vehiclePlate ? `(${data.vehiclePlate})` : ''}`, rightX, yD)
    }
  }

  // 3. TRAJET
  let currentY = 100
  if (data.trajet) {
    doc.setFillColor(lightGray)
    doc.rect(20, currentY, 170, 25, "F")
    
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text("D\u00c9TAILS DU TRAJET", 25, currentY + 6)
    
    doc.setFont("helvetica", "normal")
    // Use doc.splitTextToSize to gracefully break long addresses
    const departStr = doc.splitTextToSize(`D\u00e9part : ${data.trajet.depart || "Non renseign\u00e9"}`, 160)
    doc.text(departStr, 25, currentY + 12)
    const arriveeStr = doc.splitTextToSize(`Arriv\u00e9e : ${data.trajet.arrivee || "Non renseign\u00e9"}`, 160)
    // Offset slightly downwards if departStr took more than 1 line
    let arrivY = currentY + 12 + (departStr.length * 4)
    doc.text(arriveeStr, 25, arrivY)
    
    // extra info right aligned
    let extraStr = []
    if (data.trajet.distance) extraStr.push(`${data.trajet.distance} km`)
    if (data.trajet.passengers) extraStr.push(`${data.trajet.passengers} passager(s)`)
    if (data.trajet.time) extraStr.push(`Heure: ${data.trajet.time}`)
    
    if (extraStr.length > 0) {
      doc.text(extraStr.join("  |  "), 185, arrivY + (arriveeStr.length * 4), { align: "right" })
    }
    
    currentY += 20 + ((departStr.length + arriveeStr.length) * 4)
  } else {
     currentY += 10
  }

  // 4. TABLE
  doc.setFillColor(dark)
  doc.rect(20, currentY, 170, 10, "F")
  doc.setFont("helvetica", "bold")
  doc.setTextColor("#FFFFFF")
  doc.text("D\u00e9signation", 25, currentY + 6.5)
  doc.text("Montant HT", 185, currentY + 6.5, { align: "right" })

  currentY += 15
  doc.setFont("helvetica", "normal")
  doc.setTextColor(dark)

  if (data.items && data.items.length > 0) {
    // Facture libre
    data.items.forEach((item: any) => {
      const descStr = doc.splitTextToSize(item.designation || "Prestation", 120)
      doc.text(descStr, 25, currentY)
      doc.text(formatPrice(item.amountHT), 185, currentY, { align: "right" })
      currentY += descStr.length * 5 + 3
    })
  } else {
    // BC or Facture depuis BC
    let title = isInvoice ? `Prestation de transport VTC (R\u00e9f ${data.bcRef})` : "Prestation de transport avec chauffeur"
    if (data.notes) {
        title += ` - ${data.notes}`
    }
    const descStr = doc.splitTextToSize(title, 120)
    doc.text(descStr, 25, currentY)
    doc.text(formatPrice(data.baseHT || data.amountHT || data.amount), 185, currentY, { align: "right" })
    currentY += descStr.length * 5 + 3

    if (data.supplementsHT > 0) {
       doc.setFont("helvetica", "italic")
       const suppDesc = doc.splitTextToSize("Suppl\u00e9ments : " + (data.supplementsList?.join(", ") || ""), 120)
       doc.text(suppDesc, 25, currentY)
       doc.text(formatPrice(data.supplementsHT), 185, currentY, { align: "right" })
       currentY += suppDesc.length * 5 + 3
       doc.setFont("helvetica", "normal")
    }
  }

  // Discount line
  if (data.discountValue && data.discountValue > 0) {
    doc.setTextColor(200, 50, 50)
    let discountStr = `Remise commerciale`
    if (data.discountType === "percent") discountStr += ` (${data.discountValue}%)`
    doc.text(discountStr, 25, currentY)
    
    // Calculate the absolute discount amount
    const totalHTBeforeDiscount = data.originalHT || data.amountHT || 0
    const absoluteDiscountAmount = data.discountType === "percent" ? totalHTBeforeDiscount * (data.discountValue / 100) : data.discountValue
    
    doc.text("-" + formatPrice(absoluteDiscountAmount), 185, currentY, { align: "right" })
    currentY += 10
    doc.setTextColor(dark)
  }

  // 5. TOTALS
  doc.setDrawColor(200)
  doc.line(130, currentY, 190, currentY)
  currentY += 7

  if (data.amountHT) {
      doc.text("Total HT", 140, currentY)
      doc.text(formatPrice(data.amountHT), 185, currentY, { align: "right" })
      currentY += 7

      if (data.tva10Amount || data.tva20Amount || data.tva55Amount) {
         if (data.tva10Amount) {
            doc.text("TVA (10%)", 140, currentY)
            doc.text(formatPrice(data.tva10Amount), 185, currentY, { align: "right" })
            currentY += 7
         }
         if (data.tva20Amount) {
            doc.text("TVA (20%)", 140, currentY)
            doc.text(formatPrice(data.tva20Amount), 185, currentY, { align: "right" })
            currentY += 7
         }
         if (data.tva55Amount) {
            doc.text("TVA (5.5%)", 140, currentY)
            doc.text(formatPrice(data.tva55Amount), 185, currentY, { align: "right" })
            currentY += 7
         }
      } else if (data.tva) {
         doc.text(`TVA (${data.tvaRate ?? 10}%)`, 140, currentY)
         doc.text(formatPrice(data.tva), 185, currentY, { align: "right" })
         currentY += 7
      }
  } else {
      doc.text("Total Net", 140, currentY)
      doc.text(formatPrice(data.amount), 185, currentY, { align: "right" })
      currentY += 7
  }
  
  doc.setDrawColor(gold)
  doc.setLineWidth(0.5)
  doc.line(130, currentY, 190, currentY)
  
  currentY += 10
  
  if (data.discountValue && data.originalTTC) {
     doc.setFontSize(10)
     doc.setTextColor(150, 150, 150)
     const oldTtcStr = formatPrice(data.originalTTC)
     doc.text(oldTtcStr, 185, currentY - 5, { align: "right" })
     
     // Strikethrough
     const strWidth = doc.getTextWidth(oldTtcStr)
     doc.setDrawColor(200, 50, 50)
     doc.setLineWidth(0.3)
     const offsetRight = 185
     doc.line(offsetRight - strWidth, currentY - 6.5, offsetRight, currentY - 6.5)
  }

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(gold)
  doc.text("TOTAL TTC", 130, currentY)
  doc.text(formatPrice(data.amount), 185, currentY, { align: "right" })

  // 6. CGV
  currentY += 20
  if (data.cgvText) {
    // If it reaches the end of the page, we might cut it off, but standard jsPdf text wrapping handles reasonable strings.
    if (currentY > 230) {
      doc.addPage()
      currentY = 20
    }
    
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text("CONDITIONS G\u00c9N\u00c9RALES", 20, currentY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    
    const lines = doc.splitTextToSize(data.cgvText, 170)
    doc.text(lines, 20, currentY + 5)
  }

  // Footer 
  doc.setFontSize(8)
  doc.setTextColor("#A0A0A0")
  doc.setFont("helvetica", "italic")
  doc.text("Document g\u00e9n\u00e9r\u00e9 par NoX VTC", 105, 290, { align: "center" })

  doc.save(`${isInvoice ? "Facture" : "BC"}_${data.number}.pdf`)
}

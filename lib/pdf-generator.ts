import { jsPDF } from "jspdf"
import type { InvoiceDocument, EnterpriseProfile, BCDocument } from "@/components/dashboard/data"

const LEGAL_BC_MENTION =
  "Document obligatoire conformément à l’article L. 3122-2 du Code des transports " +
  "et au Décret n°2014-1725 du 30 décembre 2014 relatif au transport public particulier de personnes."

function formatPrice(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—"
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(value) + " €"
}

async function fetchMapImage(depart: string, arrivee: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey || (!depart.trim() && !arrivee.trim())) return null
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  try {
    const dEnc = encodeURIComponent(depart)
    const aEnc = encodeURIComponent(arrivee)
    const url =
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?size=600x250&scale=2&format=png` +
      `&markers=color:green%7Clabel:D%7C${dEnc}` +
      `&markers=color:red%7Clabel:A%7C${aEnc}` +
      `&key=${apiKey}`
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}

export function generateInvoicePDF(invoice: InvoiceDocument, enterprise: EnterpriseProfile): void {
  void _generateDocumentPDF(invoice, enterprise, true)
}

export function generateBCPDF(bc: BCDocument, enterprise: EnterpriseProfile): void {
  void _generateDocumentPDF(bc, enterprise, false)
}

async function _generateDocumentPDF(
  data: BCDocument | InvoiceDocument,
  enterprise: EnterpriseProfile,
  isInvoice: boolean
): Promise<void> {
  const d = data as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const doc = new jsPDF()

  const gold = "#D4AF37"
  const dark = "#1A1A1A"
  const gray = "#71717A"
  const lightGray = "#F4F4F5"

  // 7e — micro-entrepreneur sans TVA : proxy = tvaIntra vide
  const isAssujettiTVA = !!(enterprise.tvaIntra && enterprise.tvaIntra.trim())

  // 7g — précharger la carte Google Maps (BC uniquement)
  let mapBase64: string | null = null
  if (!isInvoice && d.trajet) {
    const dep: string = d.trajet.depart || ""
    const arr: string = d.trajet.arrivee || ""
    if (dep || arr) mapBase64 = await fetchMapImage(dep, arr)
  }

  // ── 1. HEADER ────────────────────────────────────────────────────
  // 7a — nom société et "BON DE RÉSERVATION" sur deux lignes bien séparées
  const companyName = enterprise.name || enterprise.denomination || "Entreprise"

  // Colonne gauche : infos société
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(companyName, 20, 22)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  let leftY = 29
  if (enterprise.adresse) { doc.text(enterprise.adresse, 20, leftY); leftY += 5 }
  if (enterprise.siren) { doc.text(`SIREN : ${enterprise.siren}`, 20, leftY); leftY += 5 }
  if (enterprise.tvaIntra) { doc.text(`TVA : ${enterprise.tvaIntra}`, 20, leftY); leftY += 5 }
  if (enterprise.evtcNumber) {
    doc.setTextColor(gold)
    doc.text(`EVTC : ${enterprise.evtcNumber}`, 20, leftY)
    doc.setTextColor(gray)
    leftY += 5
  }

  // Colonne droite : titre document + métadonnées
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(isInvoice ? "FACTURE" : "BON DE RÉSERVATION", 190, 22, { align: "right" })

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  let rightY = 30
  doc.text(`Numéro : ${d.number}`, 190, rightY, { align: "right" }); rightY += 5
  doc.text(`Date : ${d.date}`, 190, rightY, { align: "right" }); rightY += 5
  if (isInvoice) {
    if (d.echeance) { doc.text(`Échéance : ${d.echeance}`, 190, rightY, { align: "right" }); rightY += 5 }
    if (d.bcRef) { doc.text(`Réf. BC : ${d.bcRef}`, 190, rightY, { align: "right" }); rightY += 5 }
  }

  // 7a — mention légale obligatoire sous le titre (BC uniquement)
  let currentY = Math.max(leftY, rightY) + 4
  if (!isInvoice) {
    doc.setFontSize(8)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(gray)
    const legalLines = doc.splitTextToSize(LEGAL_BC_MENTION, 170)
    doc.text(legalLines, 105, currentY, { align: "center" })
    currentY += legalLines.length * 4.5 + 3
  }

  // Séparateur
  doc.setDrawColor(230)
  doc.setLineWidth(0.3)
  doc.line(20, currentY, 190, currentY)
  currentY += 2

  // ── 2. CLIENT & CHAUFFEUR ────────────────────────────────────────
  const labelY = currentY + 8
  const contentY = labelY + 5

  // Label CLIENT
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(isInvoice ? "DESTINATAIRE / CLIENT" : "CLIENT", 20, labelY)

  // 7b — nom client (en gras) + passager si renseigné
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(d.client || "", 20, contentY)
  doc.setFont("helvetica", "normal")

  let leftBotY = contentY + 5
  if (d.passagerNom) {
    doc.setTextColor(gray)
    doc.text(`Passager : ${d.passagerNom}`, 20, leftBotY); leftBotY += 5
    const pPhone = d.passagerTelephone || d.clientPhone
    if (pPhone) { doc.text(`Tél : ${pPhone}`, 20, leftBotY); leftBotY += 5 }
    doc.setTextColor(dark)
  } else if (d.clientPhone) {
    doc.setTextColor(gray)
    doc.text(d.clientPhone, 20, leftBotY); leftBotY += 5
    doc.setTextColor(dark)
  }

  // Section CHAUFFEUR & VÉHICULE (droite)
  let rightBotY = contentY
  if (d.driverName || d.vehicleName) {
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text("CHAUFFEUR & VÉHICULE", 110, labelY)
    doc.setFont("helvetica", "normal")
    if (d.driverName) {
      doc.text(`Chauffeur : ${d.driverName}`, 110, rightBotY); rightBotY += 5
      // 7c — téléphone chauffeur
      if (d.driverPhone) {
        doc.setTextColor(gray)
        doc.text(`Tél : ${d.driverPhone}`, 110, rightBotY); rightBotY += 5
        doc.setTextColor(dark)
      }
    }
    if (d.vehicleName) {
      const plate = d.vehiclePlate ? ` (${d.vehiclePlate})` : ""
      doc.text(`Véhicule : ${d.vehicleName}${plate}`, 110, rightBotY)
      rightBotY += 5
    }
  }

  currentY = Math.max(leftBotY, rightBotY) + 6

  // ── 3. TRAJET ────────────────────────────────────────────────────
  if (d.trajet) {
    // 7f — adresses départ/arrivée clairement mises en valeur
    doc.setFontSize(9)
    const departLines = doc.splitTextToSize(d.trajet.depart || "Non renseigné", 152) as string[]
    const arriveeLines = doc.splitTextToSize(d.trajet.arrivee || "Non renseigné", 152) as string[]

    const extraParts: string[] = []
    if (d.trajet.time) extraParts.push(`Heure : ${d.trajet.time}`)
    if (d.trajet.distance) extraParts.push(`${d.trajet.distance} km`)
    if (d.trajet.passengers) extraParts.push(`${d.trajet.passengers} passager(s)`)

    const contentHeight =
      15 +
      5 + departLines.length * 5 + 2 +
      5 + arriveeLines.length * 5 + 2 +
      (extraParts.length > 0 ? 6 : 0)
    const bgH = contentHeight + 6

    const sectionTop = currentY
    doc.setFillColor(lightGray)
    doc.rect(20, sectionTop, 170, bgH, "F")

    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text("DÉTAILS DU TRAJET", 25, sectionTop + 7)

    let tY = sectionTop + 15

    // Départ (marqueur vert)
    doc.setFillColor("#22C55E")
    doc.circle(24.5, tY - 1, 1.8, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(dark)
    doc.text("Départ :", 28, tY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    doc.text(departLines, 28, tY + 5)
    doc.setTextColor(dark)
    tY += 5 + departLines.length * 5 + 2

    // Arrivée (marqueur rouge)
    doc.setFillColor("#EF4444")
    doc.circle(24.5, tY - 1, 1.8, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(dark)
    doc.text("Arrivée :", 28, tY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    doc.text(arriveeLines, 28, tY + 5)
    doc.setTextColor(dark)
    tY += 5 + arriveeLines.length * 5 + 2

    if (extraParts.length > 0) {
      doc.setFontSize(8)
      doc.setTextColor(gray)
      doc.text(extraParts.join("  |  "), 185, tY, { align: "right" })
      doc.setTextColor(dark)
    }

    currentY = sectionTop + bgH + 4

    // 7g — carte Google Maps Static
    if (mapBase64) {
      try {
        if (currentY + 75 > 278) { doc.addPage(); currentY = 20 }
        doc.addImage(mapBase64, "PNG", 20, currentY, 170, 71)
        doc.setDrawColor(210)
        doc.setLineWidth(0.3)
        doc.rect(20, currentY, 170, 71)
        currentY += 76
      } catch {
        // Fallback silencieux — ne jamais bloquer la génération PDF
      }
    }
  } else {
    currentY += 6
  }

  // ── 4. TABLEAU DÉSIGNATION ────────────────────────────────────────
  if (currentY + 55 > 278) { doc.addPage(); currentY = 20 }

  doc.setFillColor(dark)
  doc.rect(20, currentY, 170, 10, "F")
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor("#FFFFFF")
  doc.text("Désignation", 25, currentY + 6.5)
  doc.text("Montant HT", 185, currentY + 6.5, { align: "right" })
  currentY += 13

  doc.setFont("helvetica", "normal")
  doc.setTextColor(dark)

  if (d.items && d.items.length > 0) {
    d.items.forEach((item: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const descStr = doc.splitTextToSize(item.designation || "Prestation", 120) as string[]
      doc.text(descStr, 25, currentY)
      doc.text(formatPrice(item.amountHT), 185, currentY, { align: "right" })
      currentY += descStr.length * 5 + 3
    })
  } else {
    const title = isInvoice
      ? `Prestation de transport VTC (Réf ${d.bcRef})`
      : "Prestation de transport avec chauffeur"
    const fullTitle = d.notes ? `${title} — ${d.notes}` : title
    const descStr = doc.splitTextToSize(fullTitle, 120) as string[]
    doc.text(descStr, 25, currentY)
    doc.text(formatPrice(d.baseHT || d.amountHT || d.amount), 185, currentY, { align: "right" })
    currentY += descStr.length * 5 + 3

    if (d.supplementsHT && d.supplementsHT > 0) {
      doc.setFont("helvetica", "italic")
      const suppList: string = d.supplementsList?.join(", ") || ""
      const suppStr = doc.splitTextToSize(`Suppléments : ${suppList}`, 120) as string[]
      doc.text(suppStr, 25, currentY)
      doc.text(formatPrice(d.supplementsHT), 185, currentY, { align: "right" })
      currentY += suppStr.length * 5 + 3
      doc.setFont("helvetica", "normal")
    }
  }

  // Remise
  if (d.discountValue && d.discountValue > 0) {
    doc.setTextColor(200, 50, 50)
    let discLabel = "Remise commerciale"
    if (d.discountType === "percent") discLabel += ` (${d.discountValue}%)`
    doc.text(discLabel, 25, currentY)
    const base = d.originalHT || d.amountHT || 0
    const absDiscount =
      d.discountType === "percent" ? base * (d.discountValue / 100) : d.discountValue
    doc.text("-" + formatPrice(absDiscount), 185, currentY, { align: "right" })
    currentY += 8
    doc.setTextColor(dark)
  }

  // ── 5. TOTAUX ────────────────────────────────────────────────────
  if (currentY + 50 > 278) { doc.addPage(); currentY = 20 }

  doc.setDrawColor(200)
  doc.setLineWidth(0.3)
  doc.line(130, currentY, 190, currentY)
  currentY += 7

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(dark)

  if (!isAssujettiTVA) {
    // 7e — micro-entrepreneur : montant unique HT = TTC
    if (d.amountHT && d.amountHT > 0) {
      doc.text("Total HT", 140, currentY)
      doc.text(formatPrice(d.amountHT), 185, currentY, { align: "right" })
      currentY += 7
    }
    // Pas de lignes TVA
  } else if (d.amountHT && d.amountHT > 0) {
    // 7d — assujetti TVA : lignes multi-TVA avec références légales
    doc.text("Total HT", 140, currentY)
    doc.text(formatPrice(d.amountHT), 185, currentY, { align: "right" })
    currentY += 7

    if (d.tva10Amount && d.tva10Amount > 0) {
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text("TVA 10% — Transport de personnes", 140, currentY)
      doc.text(formatPrice(d.tva10Amount), 185, currentY, { align: "right" })
      currentY += 4.5
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "italic")
      doc.setTextColor(gray)
      doc.text("(art. 279 b du CGI)", 142, currentY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(dark)
      doc.setFontSize(9)
      currentY += 5.5
    }
    if (d.tva20Amount && d.tva20Amount > 0) {
      doc.text("TVA 20% — Suppléments & mise à disposition", 140, currentY)
      doc.text(formatPrice(d.tva20Amount), 185, currentY, { align: "right" })
      currentY += 4.5
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "italic")
      doc.setTextColor(gray)
      doc.text("(art. 278 du CGI)", 142, currentY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(dark)
      doc.setFontSize(9)
      currentY += 5.5
    }
    if (d.tva55Amount && d.tva55Amount > 0) {
      doc.text("TVA 5,5% (art. 279 du CGI)", 140, currentY)
      doc.text(formatPrice(d.tva55Amount), 185, currentY, { align: "right" })
      currentY += 7
    }
    // Fallback : taux unique sans multi-TVA
    if (!d.tva10Amount && !d.tva20Amount && !d.tva55Amount && d.tva) {
      const tvaRate: number = d.tvaRate ?? 10
      if (tvaRate === 10) {
        doc.text("TVA 10% — Transport de personnes", 140, currentY)
        doc.text(formatPrice(d.tva), 185, currentY, { align: "right" })
        currentY += 4.5
        doc.setFontSize(7.5)
        doc.setFont("helvetica", "italic")
        doc.setTextColor(gray)
        doc.text("(art. 279 b du CGI)", 142, currentY)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(dark)
        doc.setFontSize(9)
        currentY += 5.5
      } else {
        doc.text(`TVA ${tvaRate}%`, 140, currentY)
        doc.text(formatPrice(d.tva), 185, currentY, { align: "right" })
        currentY += 7
      }
    }
  } else {
    doc.text("Total Net", 140, currentY)
    doc.text(formatPrice(d.amount), 185, currentY, { align: "right" })
    currentY += 7
  }

  // Ligne or + TOTAL TTC
  doc.setDrawColor(gold)
  doc.setLineWidth(0.5)
  doc.line(130, currentY, 190, currentY)
  currentY += 8

  // Ancien prix barré (si remise)
  if (d.discountValue && d.originalTTC) {
    const oldStr = formatPrice(d.originalTTC)
    doc.setFontSize(9)
    doc.setTextColor(150, 150, 150)
    doc.text(oldStr, 185, currentY, { align: "right" })
    const strW = doc.getTextWidth(oldStr)
    doc.setDrawColor(200, 50, 50)
    doc.setLineWidth(0.3)
    doc.line(185 - strW, currentY - 1.5, 185, currentY - 1.5)
    currentY += 7
  }

  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(gold)
  doc.text("TOTAL TTC", 130, currentY)
  doc.text(formatPrice(d.amount), 185, currentY, { align: "right" })
  currentY += 6

  // 7e — mention obligatoire "TVA non applicable, art. 293 B du CGI"
  if (!isAssujettiTVA) {
    currentY += 4
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text("TVA non applicable, art. 293 B du CGI", 130, currentY)
    currentY += 6
  }

  // ── 6. CGV ────────────────────────────────────────────────────────
  currentY += 14
  if (d.cgvText) {
    if (currentY > 238) { doc.addPage(); currentY = 20 }
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text("CONDITIONS GÉNÉRALES", 20, currentY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    const cgvLines = doc.splitTextToSize(d.cgvText, 170)
    doc.text(cgvLines, 20, currentY + 5)
  }

  // Pied de page
  doc.setFontSize(8)
  doc.setTextColor("#A0A0A0")
  doc.setFont("helvetica", "italic")
  doc.text("Document généré par NoX VTC", 105, 290, { align: "center" })

  doc.save(`${isInvoice ? "Facture" : "BC"}_${d.number}.pdf`)
}

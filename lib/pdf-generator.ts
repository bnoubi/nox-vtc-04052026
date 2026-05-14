import { jsPDF } from "jspdf"
import type { InvoiceDocument, EnterpriseProfile, BCDocument } from "@/components/dashboard/data"
import { isVatApplicable, getVatMention } from "@/components/dashboard/data"

const LEGAL_BC_MENTION =
  "JUSTIFICATION DE LA RESERVATION PREALABLE" +
  " - Article R3120-2 du Code des transports - Arrete du 6 aout 2025"

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
  void _buildPDFDoc(invoice, enterprise, true).then(doc => doc.save(`Facture_${invoice.number}.pdf`))
}

export function generateBCPDF(bc: BCDocument, enterprise: EnterpriseProfile): void {
  void _buildPDFDoc(bc, enterprise, false).then(doc => doc.save(`BC_${bc.number}.pdf`))
}

export async function generateBCPDFBlob(bc: BCDocument, enterprise: EnterpriseProfile): Promise<Blob> {
  const doc = await _buildPDFDoc(bc, enterprise, false)
  return doc.output('blob')
}

async function _buildPDFDoc(
  data: BCDocument | InvoiceDocument,
  enterprise: EnterpriseProfile,
  isInvoice: boolean
): Promise<jsPDF> {
  const d = data as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const doc = new jsPDF()

  const gold = "#D4AF37"
  const dark = "#1A1A1A"
  const gray = "#71717A"
  const lightGray = "#F4F4F5"

  // Statut TVA via helper centralisé (isVatApplicable)
  const isAssujettiTVA = isVatApplicable(enterprise)

  // 7g — précharger la carte Google Maps (BC uniquement)
  let mapBase64: string | null = null
  if (!isInvoice && d.trajet) {
    const dep: string = d.trajet.depart || ""
    const arr: string = d.trajet.arrivee || ""
    if (dep || arr) mapBase64 = await fetchMapImage(dep, arr)
  }

  // ── 1. HEADER ─────────────────────────────────────────────────────
  const companyName = enterprise.name || enterprise.denomination || "Entreprise"

  // Colonne gauche : nom 12px bold, infos 8.5px
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(companyName, 20, 22)

  doc.setFontSize(8.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  let leftY = 29
  if (enterprise.adresse) { doc.text(enterprise.adresse, 20, leftY); leftY += 4.5 }
  if (enterprise.siren) { doc.text(`SIREN : ${enterprise.siren}`, 20, leftY); leftY += 4.5 }
  if (isVatApplicable(enterprise) && enterprise.tvaIntra) {
    doc.text(`TVA : ${enterprise.tvaIntra}`, 20, leftY); leftY += 4.5
  }
  if (!isVatApplicable(enterprise)) {
    doc.setTextColor("#D97706")
    doc.text(getVatMention(enterprise) ?? "TVA non applicable, art. 293 B du CGI", 20, leftY)
    doc.setTextColor(gray)
    leftY += 4.5
  }
  if (enterprise.evtcNumber) {
    doc.setTextColor(gold)
    doc.text(`EVTC : ${enterprise.evtcNumber}`, 20, leftY)
    doc.setTextColor(gray)
    leftY += 4.5
  }

  // Séparateur vertical entre colonnes (x=105)
  const headerTopY = 18
  const headerBotEstimate = Math.max(leftY, 45)
  doc.setDrawColor("#dddddd")
  doc.setLineWidth(0.5)
  doc.line(105, headerTopY, 105, headerBotEstimate)

  // Colonne droite : titre 12px bold, numéro/date 10px
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(isInvoice ? "FACTURE" : "BON DE RESERVATION", 190, 22, { align: "right" })

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  let rightY = 29
  doc.text(`N° : ${d.number}`, 190, rightY, { align: "right" }); rightY += 5
  doc.text(`Date : ${d.date}`, 190, rightY, { align: "right" }); rightY += 5
  if (isInvoice) {
    if (d.echeance) { doc.text(`Echeance : ${d.echeance}`, 190, rightY, { align: "right" }); rightY += 5 }
    if (d.bcRef) { doc.text(`Ref. BC : ${d.bcRef}`, 190, rightY, { align: "right" }); rightY += 5 }
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
      if (d.driverPhone) {
        doc.setTextColor(gray)
        doc.text(`Tel : ${d.driverPhone}`, 110, rightBotY); rightBotY += 5
        doc.setTextColor(dark)
      }
      // Carte VTC : masquer si vide ou "—"
      if (d.driverCarteVTC && d.driverCarteVTC.trim() && d.driverCarteVTC !== "—") {
        doc.setTextColor(gray)
        doc.text(`Carte VTC : ${d.driverCarteVTC}`, 110, rightBotY); rightBotY += 5
        doc.setTextColor(dark)
      }
    }
    // Section véhicule : masquer entièrement si vide ou "—"
    if (d.vehicleName && d.vehicleName.trim() && d.vehicleName !== "—") {
      const plate = d.vehiclePlate ? ` (${d.vehiclePlate})` : ""
      doc.text(`Vehicule : ${d.vehicleName}${plate}`, 110, rightBotY)
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

    type InfoRow = { label: string; value: string }
    const infoRows: InfoRow[] = []
    if (d.trajet.time || d.trajet.date) {
      const depDate: string = d.trajet.date || d.date || ""
      const depTime: string = d.trajet.time
        ? (d.trajet.time as string).replace(/^(\d{1,2}):(\d{2}).*/, "$1h$2")
        : ""
      const depVal = depDate && depTime ? `${depDate} à ${depTime}` : depDate || depTime
      infoRows.push({ label: "Date & Heure de départ :", value: depVal })
    }
    if (d.trajet.distance) {
      const dur: string = d.trajet.duree || ""
      infoRows.push({ label: "Distance - Durée (estimée) :", value: dur ? `${d.trajet.distance} km - ${dur}` : `${d.trajet.distance} km` })
    }
    if (d.trajet.passengers) {
      const bags: number = d.trajet.luggage ?? 0
      infoRows.push({ label: "Passagers / Bagages :", value: `${d.trajet.passengers} / ${bags}` })
    }

    const contentHeight =
      15 +
      5 + departLines.length * 5 + 2 +
      5 + arriveeLines.length * 5 + 2 +
      (infoRows.length > 0 ? infoRows.length * 5 + 4 : 0)
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

    if (infoRows.length > 0) {
      doc.setFontSize(8.5)
      doc.setFont("helvetica", "normal")
      infoRows.forEach((row) => {
        doc.setTextColor(gray)
        doc.text(row.label, 28, tY)
        doc.setTextColor(dark)
        doc.text(row.value, 185, tY, { align: "right" })
        tY += 5
      })
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
  if ((d.discountValue ?? 0) > 0) {
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
      doc.text("TVA 10%", 140, currentY)
      doc.text(formatPrice(d.tva10Amount), 185, currentY, { align: "right" })
      currentY += 4.5
      doc.setFontSize(8)
      doc.setTextColor(gray)
      doc.text("Transport de personnes", 142, currentY)
      currentY += 4
      doc.setFont("helvetica", "italic")
      doc.setFontSize(7.5)
      doc.text("(art. 279 b du CGI)", 142, currentY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(dark)
      doc.setFontSize(9)
      currentY += 5.5
    }
    if (d.tva20Amount && d.tva20Amount > 0) {
      doc.text("TVA 20%", 140, currentY)
      doc.text(formatPrice(d.tva20Amount), 185, currentY, { align: "right" })
      currentY += 4.5
      doc.setFontSize(8)
      doc.setTextColor(gray)
      doc.text("Suppléments et mise à disposition", 142, currentY)
      currentY += 4
      doc.setFont("helvetica", "italic")
      doc.setFontSize(7.5)
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
        doc.text("TVA 10%", 140, currentY)
        doc.text(formatPrice(d.tva), 185, currentY, { align: "right" })
        currentY += 4.5
        doc.setFontSize(8)
        doc.setTextColor(gray)
        doc.text("Transport de personnes", 142, currentY)
        currentY += 4
        doc.setFont("helvetica", "italic")
        doc.setFontSize(7.5)
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
  doc.text(isVatApplicable(enterprise) ? "TOTAL TTC" : "TOTAL", 130, currentY)
  doc.text(formatPrice(d.amount), 185, currentY, { align: "right" })
  currentY += 6

  // Mention TVA franchise via helper centralisé
  const vatMentionText = getVatMention(enterprise)
  if (vatMentionText) {
    currentY += 4
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text(vatMentionText, 130, currentY)
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

  return doc
}

import { jsPDF } from "jspdf"
import type { InvoiceDocument, EnterpriseProfile, BCDocument } from "@/components/dashboard/data"
import { isVatApplicable, getVatMention } from "@/components/dashboard/data"

const LEGAL_BC_MENTION =
  "JUSTIFICATION DE LA RESERVATION PREALABLE" +
  " - Article R3120-2 du Code des transports - Arrete du 6 aout 2025"

function formatDateFR(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function fmtMontant(n: number): string {
  const parts = n.toFixed(2).split('.')
  const entier = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return entier + ',' + parts[1] + ' €'
}

function formatPrice(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—"
  return fmtMontant(value)
}


async function fetchMapImage(depart: string, arrivee: string, stops?: string[]): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey || (!depart.trim() && !arrivee.trim())) return null
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  try {
    const activeStops = (stops || []).filter(s => s.trim().length > 0)
    let url =
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?size=600x250&scale=2&format=png` +
      `&markers=color:green%7Clabel:D%7C${encodeURIComponent(depart)}`
    activeStops.forEach((stop, i) => {
      url += `&markers=color:orange%7Clabel:${i + 1}%7C${encodeURIComponent(stop)}`
    })
    url += `&markers=color:red%7Clabel:A%7C${encodeURIComponent(arrivee)}`
    const pathWaypoints = [depart, ...activeStops, arrivee].map(encodeURIComponent).join('%7C')
    url += `&path=color:0x4285F480%7Cweight:4%7C${pathWaypoints}`
    url += `&key=${apiKey}`
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

  // 7g — précharger la carte Google Maps (BC uniquement)
  let mapBase64: string | null = null
  if (!isInvoice && d.trajet) {
    const dep: string = d.trajet.depart || ""
    const arr: string = d.trajet.arrivee || ""
    if (dep || arr) mapBase64 = await fetchMapImage(dep, arr, d.trajet.stops as string[] | undefined)
  }

  // 1. HEADER
  const companyName = enterprise.name || enterprise.denomination || "Entreprise"

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(companyName, 20, 22)

  doc.setFontSize(8.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  let leftY = 29
  if (enterprise.adresse) { doc.text(enterprise.adresse, 20, leftY); leftY += 4.5 }
  // [Factur-X] BT-29 SellerIdentifier (SIRET/SIREN)
  if (enterprise.siren) { doc.text(`SIREN : ${enterprise.siren}`, 20, leftY); leftY += 4.5 }
  // [Factur-X] BT-48 SellerVATIdentifier
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
  if (enterprise.phone) {
    doc.setTextColor(gray)
    doc.text(`Tél : ${enterprise.phone}`, 20, leftY)
    leftY += 4.5
    doc.setTextColor(dark)
  }
  // [Factur-X] BT-23 BusinessProcessType (RC Pro émetteur)
  if (isInvoice && enterprise.rcProNumber) {
    const rcLine = enterprise.rcProCompany
      ? `RC Pro : ${enterprise.rcProNumber} (${enterprise.rcProCompany})`
      : `RC Pro : ${enterprise.rcProNumber}`
    doc.setTextColor(gray)
    doc.text(rcLine, 20, leftY)
    leftY += 4.5
  }

  const headerTopY = 18
  const headerBotEstimate = Math.max(leftY, 45)
  doc.setDrawColor("#dddddd")
  doc.setLineWidth(0.5)
  doc.line(105, headerTopY, 105, headerBotEstimate)

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(isInvoice ? "FACTURE" : "BON DE RESERVATION", 190, 22, { align: "right" })

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  let rightY = 29
  // [Factur-X] BT-1 InvoiceNumber
  doc.text(`N° : ${d.number}`, 190, rightY, { align: "right" }); rightY += 5
  // [Factur-X] BT-2 InvoiceIssueDate
  doc.text(`Date : ${d.date}`, 190, rightY, { align: "right" }); rightY += 5
  if (isInvoice) {
    // [Factur-X] BT-9 PaymentDueDate
    if (d.echeance) { doc.text(`Echeance : ${d.echeance}`, 190, rightY, { align: "right" }); rightY += 5 }
    // [Factur-X] BT-10 BuyerReference
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

  doc.setDrawColor(230)
  doc.setLineWidth(0.3)
  doc.line(20, currentY, 190, currentY)
  currentY += 2

  // 2. CLIENT & CHAUFFEUR
  const labelY = currentY + 8
  const contentY = labelY + 5

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

  if (isInvoice) {
    if (d.clientEmail) {
      doc.setTextColor(gray)
      doc.text(d.clientEmail, 20, leftBotY); leftBotY += 4.5
      doc.setTextColor(dark)
    }
    if (d.clientTvaIntra) {
      doc.setTextColor(gray)
      doc.text(`TVA intra : ${d.clientTvaIntra}`, 20, leftBotY); leftBotY += 4.5
      doc.setTextColor(dark)
    }
  }

  // [Factur-X] BT-50 BuyerPostalAddress / BT-47 BuyerLegalRegistration (SIREN client)
  if (isInvoice) {
    doc.setTextColor(gray)
    if (d.clientAddress?.rue) {
      doc.text(d.clientAddress.rue, 20, leftBotY); leftBotY += 5
      const cityLine = [d.clientAddress.codePostal, d.clientAddress.ville].filter(Boolean).join(" ")
      if (cityLine) { doc.text(cityLine, 20, leftBotY); leftBotY += 5 }
      if (d.clientAddress.pays && d.clientAddress.pays.toLowerCase() !== "france") {
        doc.text(d.clientAddress.pays, 20, leftBotY); leftBotY += 5
      }
    }
    if (d.clientSiren) { doc.text(`SIREN : ${d.clientSiren}`, 20, leftBotY); leftBotY += 5 }
    doc.setTextColor(dark)
  }

  let rightBotY = contentY
  if (!isInvoice && (d.driverName || d.vehicleName)) {
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
      if (d.driverCarteVTC && d.driverCarteVTC.trim() && d.driverCarteVTC !== "—") {
        doc.setTextColor(gray)
        doc.text(`Carte VTC : ${d.driverCarteVTC}`, 110, rightBotY); rightBotY += 5
        doc.setTextColor(dark)
      }
    }
    if (d.vehicleName && d.vehicleName.trim() && d.vehicleName !== "—") {
      const plate = d.vehiclePlate ? ` (${d.vehiclePlate})` : ""
      doc.text(`Vehicule : ${d.vehicleName}${plate}`, 110, rightBotY)
      rightBotY += 5
    }
  }

  currentY = Math.max(leftBotY, rightBotY) + 6

  // 3. TRAJET
  if (d.trajet) {
    doc.setFontSize(9)
    const departLines = doc.splitTextToSize(d.trajet.depart || "Non renseigné", 152) as string[]
    const arriveeLines = doc.splitTextToSize(d.trajet.arrivee || "Non renseigné", 152) as string[]

    const activeStops: string[] = Array.isArray(d.trajet.stops)
      ? (d.trajet.stops as string[]).filter((s: string) => s.trim().length > 0)
      : []
    const hasOptimized: boolean = d.trajet.stops_optimized === true && activeStops.length > 0
    const stopsLinesList: string[][] = activeStops.map((s: string) =>
      doc.splitTextToSize(s, 152) as string[]
    )

    type InfoRow = { label: string; value: string }
    const infoRows: InfoRow[] = []
    if (d.trajet.time || d.trajet.date) {
      const depDate: string = formatDateFR(d.trajet.date || d.date || "")
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

    const stopsHeight: number = stopsLinesList.reduce((acc: number, lines: string[]) => acc + 5 + lines.length * 5 + 2, 0)
    const contentHeight =
      15 +
      5 + departLines.length * 5 + 2 +
      stopsHeight +
      (hasOptimized ? 6 : 0) +
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

    // DÉPART
    doc.setFillColor("#22C55E")
    doc.circle(24.5, tY - 1, 1.8, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor("#FFFFFF")
    doc.text("D", 24.5, tY + 0.2, { align: "center" })
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(dark)
    doc.text("Départ :", 28, tY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    doc.text(departLines, 28, tY + 5)
    doc.setTextColor(dark)
    let prevCircleBottomY = tY - 1 + 1.8
    tY += 5 + departLines.length * 5 + 2

    // ARRÊTS INTERMÉDIAIRES
    stopsLinesList.forEach((stopLines: string[], i: number) => {
      doc.setDrawColor("#D4D4D8")
      doc.setLineWidth(0.4)
      doc.line(24.5, prevCircleBottomY, 24.5, tY - 2.8)
      doc.setFillColor("#F97316")
      doc.circle(24.5, tY - 1, 1.8, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(7)
      doc.setTextColor("#FFFFFF")
      doc.text(String(i + 1), 24.5, tY + 0.2, { align: "center" })
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(dark)
      doc.text(`Arrêt ${i + 1} :`, 28, tY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(gray)
      doc.text(stopLines, 28, tY + 5)
      doc.setTextColor(dark)
      prevCircleBottomY = tY - 1 + 1.8
      tY += 5 + stopLines.length * 5 + 2
    })

    // Mention itinéraire optimisé
    if (hasOptimized) {
      doc.setFontSize(7.5)
      doc.setFont("helvetica", "italic")
      doc.setTextColor("#C5A059")
      doc.text("Itineraire optimise par Google Maps", 28, tY)
      doc.setTextColor(dark)
      doc.setFont("helvetica", "normal")
      tY += 6
    }

    // ARRIVÉE
    doc.setDrawColor("#D4D4D8")
    doc.setLineWidth(0.4)
    doc.line(24.5, prevCircleBottomY, 24.5, tY - 2.8)
    doc.setFillColor("#EF4444")
    doc.circle(24.5, tY - 1, 1.8, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor("#FFFFFF")
    doc.text("A", 24.5, tY + 0.2, { align: "center" })
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
        // Fallback silencieux
      }
    }
  } else {
    currentY += 6
  }

  // 4. TABLEAU DESIGNATION
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

  if (d.items && d.items.length > 0 && !isInvoice) {
    d.items.forEach((item: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const descStr = doc.splitTextToSize(item.designation || "Prestation de transport avec chauffeur", 120) as string[]
      doc.text(descStr, 25, currentY)
      doc.text(formatPrice(item.amountHT), 185, currentY, { align: "right" })
      currentY += descStr.length * 5 + 3
    })
  } else if (isInvoice) {
    const bcRefStr = d.bcRef ? ` (Réf. ${d.bcRef})` : ""
    const descStr = doc.splitTextToSize(`Transport de personnes VTC${bcRefStr}`, 120) as string[]
    doc.text(descStr, 25, currentY)
    doc.text(formatPrice(d.baseHT || d.amountHT || d.amount), 185, currentY, { align: "right" })
    currentY += descStr.length * 5 + 3

    if (d.passagerNom && d.passagerNom !== d.client) {
      doc.setFont("helvetica", "italic")
      doc.setTextColor(gray)
      const pasStr = doc.splitTextToSize(`Passager : ${d.passagerNom}`, 140) as string[]
      doc.text(pasStr, 25, currentY)
      currentY += pasStr.length * 5 + 2
      doc.setFont("helvetica", "normal")
      doc.setTextColor(dark)
    }

    // Suppléments : une ligne par supplément
    if (d.supplementsList && Array.isArray(d.supplementsList) && d.supplementsList.length > 0) {
      d.supplementsList.forEach((supp: unknown) => {
        let label = ''
        let montant = 0
        if (typeof supp === 'string') {
          label = supp
          montant = 0
        } else if (typeof supp === 'object' && supp !== null) {
          const s = supp as { label?: string; montant?: number }
          label = s.label ?? ''
          montant = s.montant ?? 0
        }
        if (!label) return
        doc.setFont("helvetica", "normal")
        doc.setTextColor(dark)
        const suppStr = doc.splitTextToSize(`  + ${label}`, 140) as string[]
        doc.text(suppStr, 25, currentY)
        if (montant > 0) {
          doc.text(fmtMontant(montant), 185, currentY, { align: "right" })
        }
        currentY += suppStr.length * 5 + 2
      })
    }

    // Remise dans le tableau
    if ((d.discountValue ?? 0) > 0) {
      doc.setFont("helvetica", "normal")
      doc.setTextColor(200, 50, 50)
      let discLabel = "  Remise"
      if (d.discountType === "percent") discLabel += ` (${d.discountValue}%)`
      doc.text(discLabel, 25, currentY)
      const base = d.originalHT || d.amountHT || 0
      const absDiscount = d.discountType === "percent" ? base * (d.discountValue / 100) : d.discountValue
      doc.text("-" + fmtMontant(absDiscount), 185, currentY, { align: "right" })
      currentY += 7
      doc.setTextColor(dark)
    }

    if (d.notes) {
      doc.setFont("helvetica", "italic")
      doc.setTextColor(gray)
      const notesStr = doc.splitTextToSize(d.notes as string, 140) as string[]
      doc.text(notesStr, 25, currentY)
      currentY += notesStr.length * 5 + 2
      doc.setFont("helvetica", "normal")
      doc.setTextColor(dark)
    }
  } else {
    // BC : désignation générique
    const fullTitle = d.notes
      ? `Prestation de transport avec chauffeur — ${d.notes}`
      : "Prestation de transport avec chauffeur"
    const descStr = doc.splitTextToSize(fullTitle, 120) as string[]
    doc.text(descStr, 25, currentY)
    doc.text(formatPrice(d.baseHT || d.amountHT || d.amount), 185, currentY, { align: "right" })
    currentY += descStr.length * 5 + 3

    // Suppléments : une ligne par supplément
    if (d.supplementsList && Array.isArray(d.supplementsList) && d.supplementsList.length > 0) {
      d.supplementsList.forEach((supp: unknown) => {
        let label = ''
        let montant = 0
        if (typeof supp === 'string') {
          label = supp
          montant = 0
        } else if (typeof supp === 'object' && supp !== null) {
          const s = supp as { label?: string; montant?: number }
          label = s.label ?? ''
          montant = s.montant ?? 0
        }
        if (!label) return
        doc.setFont("helvetica", "normal")
        doc.setTextColor(dark)
        const suppStr = doc.splitTextToSize(`  + ${label}`, 120) as string[]
        doc.text(suppStr, 25, currentY)
        if (montant > 0) {
          doc.text(fmtMontant(montant), 185, currentY, { align: "right" })
        }
        currentY += suppStr.length * 5 + 2
      })
    }

    // Remise dans le tableau
    if ((d.discountValue ?? 0) > 0) {
      doc.setFont("helvetica", "normal")
      doc.setTextColor(200, 50, 50)
      let discLabel = "  Remise"
      if (d.discountType === "percent") discLabel += ` (${d.discountValue}%)`
      doc.text(discLabel, 25, currentY)
      const base = d.originalHT || d.amountHT || 0
      const absDiscount = d.discountType === "percent" ? base * (d.discountValue / 100) : d.discountValue
      doc.text("-" + fmtMontant(absDiscount), 185, currentY, { align: "right" })
      currentY += 7
      doc.setTextColor(dark)
    }
  }

  // Encart "Prestation réalisée par" (isInvoice uniquement)
  if (isInvoice && (d.driverName || d.vehicleName)) {
    currentY += 4
    doc.setFontSize(8.5)
    doc.setFont("helvetica", "italic")
    doc.setTextColor(gray)
    const prestLine = [
      d.driverName,
      d.vehicleName && d.vehiclePlate
        ? `${d.vehicleName} (${d.vehiclePlate})`
        : d.vehicleName,
    ].filter(Boolean).join(" — ")
    if (prestLine) {
      doc.text(`Prestation réalisée par : ${prestLine}`, 20, currentY)
      currentY += 5
    }
    doc.setFont("helvetica", "normal")
    doc.setTextColor(dark)
    doc.setFontSize(9)
  }

  // 5. TOTAUX
  if (currentY + 50 > 278) { doc.addPage(); currentY = 20 }

  const isFranchise = !d.tva10Amount && !d.tva20Amount && !d.tva5_5Amount && (d.tva === 0 || !d.tva)

  doc.setDrawColor(200)
  doc.setLineWidth(0.3)
  doc.line(130, currentY, 190, currentY)
  currentY += 7

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(dark)

  if (isFranchise) {
    // pas de lignes détail — déjà affichées dans le tableau de désignation
  } else {
    if (d.amountHT && d.amountHT > 0) {
      doc.text("Total HT", 140, currentY)
      doc.text(fmtMontant(d.amountHT), 185, currentY, { align: "right" })
      currentY += 7

      if (d.tva10Amount && d.tva10Amount > 0) {
        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.text("TVA 10%", 140, currentY)
        doc.text(fmtMontant(d.tva10Amount), 185, currentY, { align: "right" })
        currentY += 4.5
        doc.setFontSize(8)
        doc.setTextColor(gray)
        doc.text("Transport de personnes", 142, currentY)
        currentY += 4
        doc.setFont("helvetica", "italic")
        doc.setFontSize(7.5)
        doc.text("(art. 279 b du CGI)", 142, currentY)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(dark)
        doc.setFontSize(9)
        currentY += 5.5
      }
      if (d.tva20Amount && d.tva20Amount > 0) {
        doc.text("TVA 20%", 140, currentY)
        doc.text(fmtMontant(d.tva20Amount), 185, currentY, { align: "right" })
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
        doc.text(fmtMontant(d.tva55Amount), 185, currentY, { align: "right" })
        currentY += 7
      }
      // Fallback taux unique
      if (!d.tva10Amount && !d.tva20Amount && !d.tva55Amount && d.tva) {
        const tvaRate: number = d.tvaRate ?? 10
        if (tvaRate === 10) {
          doc.text("TVA 10%", 140, currentY)
          doc.text(fmtMontant(d.tva), 185, currentY, { align: "right" })
          currentY += 4.5
          doc.setFontSize(8)
          doc.setTextColor(gray)
          doc.text("Transport de personnes", 142, currentY)
          currentY += 4
          doc.setFont("helvetica", "italic")
          doc.setFontSize(7.5)
          doc.text("(art. 279 b du CGI)", 142, currentY)
          doc.setFont("helvetica", "normal")
          doc.setTextColor(dark)
          doc.setFontSize(9)
          currentY += 5.5
        } else {
          doc.text(`TVA ${tvaRate}%`, 140, currentY)
          doc.text(fmtMontant(d.tva), 185, currentY, { align: "right" })
          currentY += 7
        }
      }
    } else {
      doc.text("Total Net", 140, currentY)
      doc.text(fmtMontant(d.amount || 0), 185, currentY, { align: "right" })
      currentY += 7
    }
  }

  // Ligne or + TOTAL
  doc.setDrawColor(gold)
  doc.setLineWidth(0.5)
  doc.line(130, currentY, 190, currentY)
  currentY += 8

  // Libellé remise rouge + montant barré
  if (d.discountValue && d.originalTTC) {
    let remiseLabel = "Remise"
    if (d.discountType === "percent") remiseLabel = `Remise (${d.discountValue}%)`
    else if (d.discountType === "fixed") remiseLabel = `Remise (${d.discountValue} €)`
    doc.setFontSize(9)
    doc.setTextColor(200, 50, 50)
    doc.text(remiseLabel, 130, currentY)
    const oldStr = fmtMontant(d.originalTTC)
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
  doc.text(isFranchise ? "TOTAL" : "TOTAL TTC", 130, currentY)
  doc.text(fmtMontant(d.amount || 0), 185, currentY, { align: "right" })
  currentY += 6

  if (isFranchise) {
    currentY += 2
    doc.setFont("helvetica", "italic")
    doc.setTextColor(gray)
    doc.setFontSize(8.5)
    doc.text("TVA non applicable, art. 293 B du CGI", 130, currentY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(dark)
    doc.setFontSize(9)
    currentY += 5
  }

  // 5b. CO2 (isInvoice uniquement — art. L1431-3 C. transp.)
  if (isInvoice && d.trajet?.type_energie && d.trajet?.distance) {
    const co2Map: Record<string, number> = { electrique: 0, hybride: 50, essence: 120, diesel: 110 }
    const gPerKm: number = co2Map[d.trajet.type_energie as string] ?? 110
    const totalG: number = Math.round(gPerKm * (d.trajet.distance as number))
    let co2Text: string
    if (totalG < 1000) {
      co2Text = `${totalG} g CO₂ émis (art. L1431-3 C. transp.)`
    } else {
      const kg = (totalG / 1000).toFixed(1).replace(".", ",")
      co2Text = `${kg} kg CO₂ émis (art. L1431-3 C. transp.)`
    }
    currentY += 4
    doc.setFontSize(8.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    doc.text(co2Text, 20, currentY)
    doc.setTextColor(dark)
    currentY += 5
  }

  // 5c. CONDITIONS DE REGLEMENT (isInvoice uniquement)
  if (isInvoice) {
    currentY += 6
    if (currentY + 30 > 278) { doc.addPage(); currentY = 20 }
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text("CONDITIONS DE RÈGLEMENT", 20, currentY)
    currentY += 5
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    doc.text("Nature de l'opération : Prestation de services — Transport de personnes", 20, currentY)
    currentY += 4.5
    const paymentLine = d.clientType === "professionnel"
      ? "Paiement sous 30 jours. Pénalités de retard : 3× taux légal en vigueur. Indemnité forfaitaire recouvrement : 40 €."
      : "Paiement comptant à réception."
    const payLines = doc.splitTextToSize(paymentLine, 170) as string[]
    doc.text(payLines, 20, currentY)
    currentY += payLines.length * 4.5 + 4
    doc.setTextColor(dark)
  }

  // 6. CGV (BC uniquement)
  currentY += 14
  if (!isInvoice && d.cgvText) {
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

  // [Factur-X] BT field map (EN 16931 / Factur-X CII profile COMFORT)
  // BT-1   InvoiceNumber          -> d.number
  // BT-2   InvoiceIssueDate       -> d.date
  // BT-9   PaymentDueDate         -> d.echeance
  // BT-10  BuyerReference         -> d.bcRef
  // BT-23  BusinessProcessType    -> enterprise.rcProNumber
  // BT-29  SellerIdentifier       -> enterprise.siren
  // BT-31  SellerVATId            -> enterprise.tvaIntra
  // BT-44  BuyerName              -> d.client
  // BT-47  BuyerLegalRegistration -> d.clientSiren
  // BT-48  BuyerVATId             -> (non collecte)
  // BT-50  BuyerAddress           -> d.clientAddress
  // BT-55  BuyerCountryCode       -> d.clientAddress.pays
  // BT-73  DeliveryDate           -> d.trajet.date
  // BT-92  DocumentLevelCharge    -> d.supplementsHT
  // BT-106 InvoiceTotalAmountHT   -> d.amountHT
  // BT-110 InvoiceTotalVATAmount  -> d.tva
  // BT-112 InvoiceTotalAmountTTC  -> d.amount
  // BT-115 AmountDueForPayment    -> d.amount
  // BT-131 InvoiceLineNetAmount   -> item.amountHT

  return doc
}

// ── Recurring Contract PDF ────────────────────────────────────────────────────

export interface RecurringContractDocument {
  numero: string
  createdAt: string
  enterpriseName: string
  enterpriseSiren?: string
  enterpriseEvtc?: string
  enterpriseAddress?: string
  enterpriseLogo?: string
  enterprisePhone?: string
  clientName: string
  passengerName?: string
  passengerPhone?: string
  departure: string
  arrival: string
  distanceKm?: number
  estimatedDuration?: string
  recurrenceType: string
  outboundDays: number[]
  outboundTime: string | null
  returnEnabled: boolean
  returnDays?: number[]
  returnTime?: string | null
  daySchedules?: {
    day: number
    enabled: boolean
    outboundTime: string
    returnEnabled: boolean
    returnTime: string
  }[]
  driverName?: string
  vehicleName?: string
  startDate: string
  endDate?: string | null
  noEndDate: boolean
  excludeHolidays: boolean
  countryCode: string
  pricePerTrip: number
  billingFrequency: string
  cgvText?: string
}

function _fmtDate(dateStr: string): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr + "T00:00:00")
  const name = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][d.getDay()]
  return `${name} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

const _DAY_NAMES_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

function _fmtDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).map(d => _DAY_NAMES_FR[d - 1] ?? "?").join(", ")
}

const _RECURRENCE_LABELS: Record<string, string> = {
  fixed: "Horaire fixe",
  variable: "Horaires variables",
  custom: "Aller/Retour dissociés",
  daily: "Quotidien",
}

const _BILLING_LABELS: Record<string, string> = {
  monthly: "Automatique (1er du mois)",
  weekly: "Automatique (chaque lundi)",
  manual: "Manuelle uniquement",
}

const _COUNTRY_LABELS: Record<string, string> = {
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  LU: "Luxembourg",
}

function _buildRecurringContractDoc(d: RecurringContractDocument): jsPDF {
  const doc = new jsPDF()
  const gold = "#C5A059"
  const dark = "#1A1A1A"
  const gray = "#71717A"
  const lightLine = "#E5E5E5"

  function pb(y: number, needed = 20): number {
    if (y + needed > 275) { doc.addPage(); return 20 }
    return y
  }

  function separator(y: number): number {
    doc.setDrawColor(lightLine)
    doc.setLineWidth(0.2)
    doc.line(20, y, 190, y)
    return y + 8
  }

  function row(y: number, label: string, value: string, labelX = 20, valueX = 55): number {
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    doc.text(label, labelX, y)
    doc.setTextColor(dark)
    const lines = doc.splitTextToSize(value, 190 - valueX) as string[]
    doc.text(lines, valueX, y)
    return y + lines.length * 4.5 + 1
  }

  let y = 15

  // ── En-tête ───────────────────────────────────────────────────────────────

  if (d.enterpriseLogo) {
    try { doc.addImage(d.enterpriseLogo, "PNG", 20, y, 50, 20) } catch { /* skip */ }
  }

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(d.enterpriseName, 190, y + 5, { align: "right" })

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  let infoY = y + 11
  if (d.enterpriseSiren)  { doc.text(`SIREN : ${d.enterpriseSiren}`, 190, infoY, { align: "right" }); infoY += 4.5 }
  if (d.enterpriseEvtc)   { doc.text(`N° EVTC : ${d.enterpriseEvtc}`, 190, infoY, { align: "right" }); infoY += 4.5 }
  if (d.enterpriseAddress){ doc.text(d.enterpriseAddress, 190, infoY, { align: "right" }); infoY += 4.5 }
  if (d.enterprisePhone)  { doc.text(d.enterprisePhone, 190, infoY, { align: "right" }); infoY += 4.5 }

  y = Math.max(y + 26, infoY + 3)

  doc.setDrawColor(gold)
  doc.setLineWidth(0.6)
  doc.line(20, y, 190, y)
  y += 8

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text("CONTRAT DE TRANSPORT RÉCURRENT", 105, y, { align: "center" })
  y += 6
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(dark)
  doc.text(`N° ${d.numero}`, 105, y, { align: "center" })
  y += 5
  doc.setFontSize(8)
  doc.setTextColor(gray)
  doc.text(`Établi le ${_fmtDate(d.createdAt)}`, 105, y, { align: "center" })
  y += 10

  // ── Entre les parties ─────────────────────────────────────────────────────

  y = pb(y, 30)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text("ENTRE LES PARTIES", 20, y)
  y += 7

  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(gold)
  doc.text("LE PRESTATAIRE", 20, y)
  doc.text("LE CLIENT", 115, y)
  y += 5

  doc.setFont("helvetica", "normal")
  doc.setTextColor(dark)
  doc.text(d.enterpriseName, 20, y)
  doc.text(d.clientName, 115, y)
  y += 5

  if (d.passengerName && d.passengerName !== d.clientName) {
    doc.setTextColor(gray)
    doc.text(`Passager : ${d.passengerName}`, 115, y)
    y += 4.5
    if (d.passengerPhone) {
      doc.text(`Tél. : ${d.passengerPhone}`, 115, y)
      y += 4.5
    }
  }
  y += 2
  y = separator(y)

  // ── Trajet ────────────────────────────────────────────────────────────────

  y = pb(y, 30)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text("TRAJET", 20, y)
  y += 7

  doc.setFontSize(8)
  y = row(y, "Départ :", d.departure, 20, 48)
  y = row(y, "Arrivée :", d.arrival, 20, 48)
  if (d.distanceKm)  y = row(y, "Distance :", `${d.distanceKm} km${d.estimatedDuration ? ` (${d.estimatedDuration})` : ""}`, 20, 55)
  if (d.driverName)  y = row(y, "Chauffeur :", d.driverName, 20, 55)
  if (d.vehicleName) y = row(y, "Véhicule :", d.vehicleName, 20, 52)
  y += 2
  y = separator(y)

  // ── Récurrence ────────────────────────────────────────────────────────────

  y = pb(y, 40)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text("RÉCURRENCE", 20, y)
  y += 7

  doc.setFontSize(8)
  y = row(y, "Mode :", _RECURRENCE_LABELS[d.recurrenceType] ?? d.recurrenceType)

  if (d.recurrenceType === "fixed" || d.recurrenceType === "daily") {
    y = row(y, "Jours :", _fmtDays(d.outboundDays))
    if (d.outboundTime) y = row(y, "Heure aller :", d.outboundTime.substring(0, 5), 20, 58)
    y = row(y, "Retour :", d.returnEnabled ? `Activé — ${d.returnTime?.substring(0, 5) ?? "?"}` : "Non activé", 20, 48)
  } else if (d.recurrenceType === "variable" && d.daySchedules) {
    d.daySchedules.filter(s => s.enabled).forEach(s => {
      y = pb(y, 6)
      y = row(y, `${_DAY_NAMES_FR[s.day - 1] ?? "?"} :`, s.returnEnabled ? `Aller ${s.outboundTime} · Retour ${s.returnTime}` : `Aller ${s.outboundTime}`, 20, 48)
    })
  } else if (d.recurrenceType === "custom") {
    y = row(y, "Jours aller :", _fmtDays(d.outboundDays), 20, 58)
    if (d.outboundTime) y = row(y, "Heure aller :", d.outboundTime.substring(0, 5), 20, 58)
    if (d.returnEnabled && d.returnDays?.length) {
      y = row(y, "Jours retour :", _fmtDays(d.returnDays), 20, 62)
      if (d.returnTime) y = row(y, "Heure retour :", d.returnTime.substring(0, 5), 20, 62)
    }
  }
  y += 2
  y = separator(y)

  // ── Période ───────────────────────────────────────────────────────────────

  y = pb(y, 30)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text("PÉRIODE", 20, y)
  y += 7

  doc.setFontSize(8)
  y = row(y, "Début :", _fmtDate(d.startDate))
  y = row(y, "Fin :", d.noEndDate ? "Sans date de fin" : d.endDate ? _fmtDate(d.endDate) : "—")
  const holidayText = d.excludeHolidays
    ? `Exclus (${_COUNTRY_LABELS[d.countryCode] ?? d.countryCode})`
    : "Non exclus"
  y = row(y, "Jours fériés :", holidayText, 20, 58)
  y += 2
  y = separator(y)

  // ── Conditions financières ────────────────────────────────────────────────

  y = pb(y, 25)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text("CONDITIONS FINANCIÈRES", 20, y)
  y += 7

  doc.setFontSize(8)
  y = row(y, "Prix par trajet :", `${d.pricePerTrip.toFixed(2)} €`, 20, 62)
  y = row(y, "Fréquence :", _BILLING_LABELS[d.billingFrequency] ?? d.billingFrequency, 20, 55)
  y += 2
  y = separator(y)

  // ── CGV ───────────────────────────────────────────────────────────────────

  if (d.cgvText) {
    y = pb(y, 20)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text("CONDITIONS GÉNÉRALES DE VENTE", 20, y)
    y += 6
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(gray)
    const cgvLines = doc.splitTextToSize(d.cgvText, 170) as string[]
    cgvLines.forEach(line => {
      y = pb(y, 5)
      doc.text(line, 20, y)
      y += 4
    })
    y += 4
  }

  // ── Signatures ────────────────────────────────────────────────────────────

  if (y + 55 > 275) { doc.addPage(); y = 20 }
  doc.setDrawColor(lightLine)
  doc.setLineWidth(0.2)
  doc.line(20, y, 190, y)
  y += 8

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text("SIGNATURES", 20, y)
  y += 8

  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(gold)
  doc.text("LE PRESTATAIRE", 20, y)
  doc.text("LE CLIENT", 115, y)
  y += 6

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(gray)
  doc.text("Bon pour accord", 20, y)
  doc.text("Bon pour accord", 115, y)
  y += 18

  doc.setDrawColor(dark)
  doc.setLineWidth(0.3)
  doc.line(20, y, 95, y)
  doc.line(115, y, 190, y)
  y += 5

  doc.setTextColor(gray)
  doc.text("Date :", 20, y)
  doc.text("Date :", 115, y)

  // ── Pied de page ──────────────────────────────────────────────────────────

  doc.setFontSize(7)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(gray)
  doc.text(
    "Document généré par NoX VTC — Ce contrat engage les deux parties à compter de sa signature.",
    105, 290, { align: "center" }
  )

  return doc
}

export function generateRecurringContractPDF(d: RecurringContractDocument): void {
  _buildRecurringContractDoc(d).save(`Contrat_${d.numero}.pdf`)
}

export function generateRecurringContractPDFBlob(d: RecurringContractDocument): Blob {
  return _buildRecurringContractDoc(d).output("blob")
}

// ── Recurring Invoice PDF ─────────────────────────────────────────────────────

export interface RecurringInvoiceDocument {
  numero: string
  createdAt: string
  periodFrom: string
  periodTo: string
  contractNumero: string
  contractLabel: string
  enterpriseName: string
  enterpriseSiren?: string
  enterpriseEvtc?: string
  enterpriseAddress?: string
  enterpriseLogo?: string
  enterprisePhone?: string
  enterpriseTvaNumber?: string
  clientName: string
  passengerName?: string
  clientAddress?: string
  departure: string
  arrival: string
  returnDeparture?: string
  returnArrival?: string
  outboundCount: number
  returnCount: number
  trips: {
    date: string
    time: string
    direction: string
    departure: string
    arrival: string
    price: number
  }[]
  pricePerTrip: number
  totalTrips: number
  totalHT: number
  tva: number
  totalTTC: number
  isFranchise: boolean
  cgvText?: string
}

function _buildRecurringInvoiceDoc(d: RecurringInvoiceDocument): jsPDF {
  const doc = new jsPDF()
  const gold = "#D4AF37"
  const dark = "#1A1A1A"
  const gray = "#71717A"
  const lightGray = "#F5F5F5"

  // ── En-tête ──────────────────────────────────────────────────────────────
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text(d.enterpriseName, 20, 22)

  doc.setFontSize(8.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  let leftY = 29
  if (d.enterpriseAddress) { doc.text(d.enterpriseAddress, 20, leftY); leftY += 4.5 }
  if (d.enterpriseSiren) { doc.text(`SIREN : ${d.enterpriseSiren}`, 20, leftY); leftY += 4.5 }
  if (!d.isFranchise && d.enterpriseTvaNumber) {
    doc.text(`TVA : ${d.enterpriseTvaNumber}`, 20, leftY); leftY += 4.5
  }
  if (d.isFranchise) {
    doc.setTextColor("#D97706")
    doc.text("TVA non applicable, art. 293 B du CGI", 20, leftY)
    doc.setTextColor(gray)
    leftY += 4.5
  }
  if (d.enterpriseEvtc) {
    doc.setTextColor(gold)
    doc.text(`EVTC : ${d.enterpriseEvtc}`, 20, leftY)
    doc.setTextColor(gray)
    leftY += 4.5
  }
  if (d.enterprisePhone) { doc.text(`Tél : ${d.enterprisePhone}`, 20, leftY); leftY += 4.5 }

  const headerBotEstimate = Math.max(leftY, 50)
  doc.setDrawColor("#dddddd")
  doc.setLineWidth(0.5)
  doc.line(105, 18, 105, headerBotEstimate)

  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text("FACTURE DE TRAJETS RÉCURRENTS", 190, 22, { align: "right" })

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  let rightY = 29
  doc.text(`N° ${d.numero}`, 190, rightY, { align: "right" }); rightY += 5
  doc.text(`Date : ${d.createdAt}`, 190, rightY, { align: "right" }); rightY += 5
  doc.text(`Contrat : ${d.contractNumero} — ${d.contractLabel}`, 190, rightY, { align: "right" }); rightY += 5

  let currentY = Math.max(leftY, rightY) + 4
  doc.setDrawColor(230)
  doc.setLineWidth(0.3)
  doc.line(20, currentY, 190, currentY)
  currentY += 6

  // ── Encadré période ───────────────────────────────────────────────────────
  doc.setFillColor(lightGray)
  doc.setDrawColor("#E0E0E0")
  doc.setLineWidth(0.3)
  doc.rect(20, currentY, 170, 12, "FD")
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(dark)
  doc.text(
    `Période de facturation : du ${d.periodFrom} au ${d.periodTo}`,
    105, currentY + 7.5,
    { align: "center" }
  )
  currentY += 18

  // ── Bloc client ───────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text("FACTURÉ À :", 20, currentY)
  currentY += 5
  doc.text(d.clientName, 20, currentY)
  doc.setFont("helvetica", "normal")
  currentY += 5
  if (d.passengerName && d.passengerName !== d.clientName) {
    doc.setTextColor(gray)
    doc.text(`Passager : ${d.passengerName}`, 20, currentY); currentY += 4.5
    doc.setTextColor(dark)
  }
  if (d.clientAddress) {
    doc.setTextColor(gray)
    doc.text(d.clientAddress, 20, currentY); currentY += 4.5
    doc.setTextColor(dark)
  }
  currentY += 6

  // ── Section TRAJET ────────────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(dark)
  doc.text("TRAJET", 20, currentY)
  currentY += 5

  doc.setFontSize(8.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray)
  doc.text("Départ :", 20, currentY)
  doc.setTextColor(dark)
  const depLines = doc.splitTextToSize(d.departure, 130) as string[]
  doc.text(depLines, 44, currentY)
  currentY += Math.max(5, depLines.length * 4.5)
  doc.setTextColor(gray)
  doc.text("Arrivée :", 20, currentY)
  doc.setTextColor(dark)
  const arrLines = doc.splitTextToSize(d.arrival, 130) as string[]
  doc.text(arrLines, 44, currentY)
  currentY += Math.max(5, arrLines.length * 4.5)
  doc.setTextColor(gray)
  doc.text("Prix unitaire :", 20, currentY)
  doc.setTextColor(dark)
  doc.text(`${d.pricePerTrip.toFixed(2)} €`, 55, currentY)
  currentY += 7

  if (d.returnCount > 0) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text("TRAJET RETOUR", 20, currentY)
    currentY += 5
    doc.setFontSize(8.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    doc.text("Départ :", 20, currentY)
    doc.setTextColor(dark)
    const rdepLines = doc.splitTextToSize(d.returnDeparture ?? d.arrival, 130) as string[]
    doc.text(rdepLines, 44, currentY)
    currentY += Math.max(5, rdepLines.length * 4.5)
    doc.setTextColor(gray)
    doc.text("Arrivée :", 20, currentY)
    doc.setTextColor(dark)
    const rarrLines = doc.splitTextToSize(d.returnArrival ?? d.departure, 130) as string[]
    doc.text(rarrLines, 44, currentY)
    currentY += Math.max(5, rarrLines.length * 4.5) + 2
  }

  // ── Tableau simplifié ─────────────────────────────────────────────────────
  // Colonnes (mm, base x=20): Désignation 85 | Qté 25 | Prix unitaire 35 | Montant 25
  const COL = [20, 105, 130, 165, 190] // x positions (left edge, then right-aligned at 190)

  if (currentY + 30 > 278) { doc.addPage(); currentY = 20 }

  doc.setFillColor(dark)
  doc.rect(20, currentY, 170, 9, "F")
  doc.setFontSize(8.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor("#FFFFFF")
  doc.text("Désignation", COL[0] + 3, currentY + 6)
  doc.text("Qté", COL[1] + 3, currentY + 6)
  doc.text("Prix unitaire", COL[2] + 3, currentY + 6)
  doc.text("Montant", COL[4] - 3, currentY + 6, { align: "right" })
  currentY += 12

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(dark)

  if (d.outboundCount > 0) {
    if (currentY + 8 > 270) { doc.addPage(); currentY = 20 }
    doc.text("Trajets Aller", COL[0] + 3, currentY + 6)
    doc.text(String(d.outboundCount), COL[1] + 3, currentY + 6)
    doc.text(`${d.pricePerTrip.toFixed(2)} €`, COL[2] + 3, currentY + 6)
    doc.text(fmtMontant(d.outboundCount * d.pricePerTrip), COL[4] - 3, currentY + 6, { align: "right" })
    doc.setDrawColor(230)
    doc.setLineWidth(0.2)
    doc.line(20, currentY + 9, 190, currentY + 9)
    currentY += 10
  }

  if (d.returnCount > 0) {
    if (currentY + 8 > 270) { doc.addPage(); currentY = 20 }
    doc.text("Trajets Retour", COL[0] + 3, currentY + 6)
    doc.text(String(d.returnCount), COL[1] + 3, currentY + 6)
    doc.text(`${d.pricePerTrip.toFixed(2)} €`, COL[2] + 3, currentY + 6)
    doc.text(fmtMontant(d.returnCount * d.pricePerTrip), COL[4] - 3, currentY + 6, { align: "right" })
    doc.setDrawColor(230)
    doc.setLineWidth(0.2)
    doc.line(20, currentY + 9, 190, currentY + 9)
    currentY += 10
  }

  currentY += 6

  // ── Totaux ────────────────────────────────────────────────────────────────
  if (currentY + 35 > 278) { doc.addPage(); currentY = 20 }
  doc.setDrawColor(200)
  doc.setLineWidth(0.3)
  doc.line(130, currentY, 190, currentY)
  currentY += 6

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(dark)

  if (!d.isFranchise) {
    doc.text("TOTAL HT", 140, currentY)
    doc.text(fmtMontant(d.totalHT), 185, currentY, { align: "right" })
    currentY += 6
    doc.text("TVA 10% — Transport de personnes", 140, currentY)
    doc.text(fmtMontant(d.tva), 185, currentY, { align: "right" })
    currentY += 4
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.setFont("helvetica", "italic")
    doc.text("(art. 279 b du CGI)", 140, currentY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(dark)
    doc.setFontSize(9)
    currentY += 5
  }

  doc.setFillColor(lightGray)
  doc.setDrawColor("#E0E0E0")
  doc.setLineWidth(0.3)
  doc.rect(130, currentY, 60, 10, "FD")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(dark)
  doc.text(d.isFranchise ? "TOTAL" : "TOTAL TTC", 135, currentY + 7)
  doc.text(fmtMontant(d.isFranchise ? d.totalHT : d.totalTTC), 187, currentY + 7, { align: "right" })
  currentY += 14

  if (d.isFranchise) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(8.5)
    doc.setTextColor(gray)
    doc.text("TVA non applicable, art. 293 B du CGI", 130, currentY)
    currentY += 5
    doc.setFont("helvetica", "normal")
    doc.setTextColor(dark)
  }

  // ── CGV ───────────────────────────────────────────────────────────────────
  if (d.cgvText) {
    currentY += 10
    if (currentY > 238) { doc.addPage(); currentY = 20 }
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(dark)
    doc.text("CONDITIONS GÉNÉRALES", 20, currentY)
    currentY += 5
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray)
    const cgvLines = doc.splitTextToSize(d.cgvText, 170) as string[]
    if (currentY + cgvLines.length * 4 > 278) { doc.addPage(); currentY = 20 }
    doc.text(cgvLines, 20, currentY)
  }

  // ── Pied de page ──────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setTextColor("#A0A0A0")
  doc.setFont("helvetica", "italic")
  doc.text("Document généré par NoX VTC", 105, 290, { align: "center" })

  return doc
}

export function generateRecurringInvoicePDF(d: RecurringInvoiceDocument): void {
  _buildRecurringInvoiceDoc(d).save(`Facture_${d.numero}.pdf`)
}

export function generateRecurringInvoicePDFBlob(d: RecurringInvoiceDocument): Blob {
  return _buildRecurringInvoiceDoc(d).output("blob")
}

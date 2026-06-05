import { PDFDocument, PDFName, AFRelationship } from "pdf-lib"

const XMP_TEMPLATE = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`

export async function embedFacturXML(
  pdfBlob: Blob,
  xmlString: string,
  invoiceNumber: string
): Promise<Blob> {
  const pdfBytes = await pdfBlob.arrayBuffer()
  const pdfDoc = await PDFDocument.load(pdfBytes)

  // Attach XML
  const xmlBytes = new TextEncoder().encode(xmlString)
  await pdfDoc.attach(xmlBytes, "factur-x.xml", {
    mimeType: "text/xml",
    description: "Factur-X XML — EN 16931",
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Alternative,
  })

  // XMP metadata stream (PDF/A-3b + Factur-X namespaces)
  const xmpBytes = new TextEncoder().encode(XMP_TEMPLATE)
  const xmpStream = pdfDoc.context.stream(xmpBytes, { Type: "Metadata", Subtype: "XML" })
  const xmpRef = pdfDoc.context.register(xmpStream)
  pdfDoc.catalog.set(PDFName.of("Metadata"), xmpRef)

  // Document info
  pdfDoc.setTitle(`Facture ${invoiceNumber}`)
  pdfDoc.setCreator("NoX VTC - Solution compatible Facturation électronique")
  pdfDoc.setProducer("pdf-lib + jsPDF")
  pdfDoc.setCreationDate(new Date())
  pdfDoc.setModificationDate(new Date())

  const outputBytes = await pdfDoc.save()
  return new Blob([outputBytes], { type: "application/pdf" })
}

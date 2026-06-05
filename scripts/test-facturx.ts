import { generateFacturXML } from '../lib/facturx-xml'
import * as fs from 'fs'

const testData = {
  sellerName: 'Test VTC',
  sellerSiren: '980345678',
  sellerAddress: 'Rue des Francs Bourgeois',
  sellerCity: 'Paris',
  sellerPostalCode: '75003',
  sellerCountry: 'FR',
  sellerVatNumber: 'FR98980345678',
  isFranchise: false,
  buyerName: 'M. Paul Dupont',
  buyerSiren: undefined,
  buyerCountry: 'FR',
  invoiceNumber: 'F-2026-003',
  invoiceDate: '2026-06-05',
  dueDate: '2026-07-05',
  currency: 'EUR',
  lines: [
    {
      description: 'Course VTC',
      quantity: 1,
      unitPrice: 15.00,
      vatRate: 10,
      lineTotal: 15.00,
    },
  ],
  totalHT: 15.00,
  totalVat: 1.50,
  totalTTC: 16.50,
}

const xml = generateFacturXML(testData)
fs.writeFileSync('/tmp/test-facturx.xml', xml)
console.log(xml)

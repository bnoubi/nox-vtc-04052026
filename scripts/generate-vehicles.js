#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const CSV_PATH = path.join(os.homedir(), 'projet_nox/nox/data/vehicles.csv');
const OUT_PATH = path.join(__dirname, '..', 'lib', 'data', 'vehicles.json');

const BLACKLIST = new Set([
  'AM General', 'ASC Incorporated', 'American Motors Corporation',
  'Aurora Cars Ltd', 'Autokraft Limited', 'Avanti Motor Corporation',
  'Azure Dynamics', 'Bill Dovell Motor Car Company', 'Bitter Gmbh and Co. Kg',
  'Buick', 'CCC Engineering', 'CODA Automotive', 'CX Automotive', 'Cadillac',
  'Consulier Industries Inc', 'Dabryan Coach Builders Inc', 'E. P. Dutton Inc.',
  'Eagle', 'Environmental Rsch and Devp Corp', 'Evans Automobiles',
  'Excalibur Autos', 'Federal Coach', 'Geo', 'GMC', 'General Motors', 'Goldacre',
  'Grumman Allied Industries', 'Grumman Olson', 'Hummer',
  'Import Foreign Auto Sales Inc', 'Import Trade Services', 'Isis Imports Ltd',
  'J.K. Motors', 'JBA Motorcars Inc.', 'Kandi', 'Kenyon Corporation Of America',
  'Lambda Control Systems', 'Laforza Automobile Inc', 'London Coach Co Inc',
  'London Taxi', 'Lordstown', 'Mercury', 'Merkur', 'Mobility Ventures LLC',
  'Oldsmobile', 'PAS Inc - GMC', 'PAS Inc', 'Panos', 'Panoz Auto-Development',
  'Panther Car Company Limited', 'Pininfarina', 'Plymouth', 'Pontiac',
  'Quantum Technologies', 'Qvale', 'RUF Automobile', 'Ram', 'Red Shift Ltd.',
  'Roush Performance', 'Ruf Automobile Gmbh', 'S and S Coach Company E.p. Dutton',
  'SRT', 'STI', 'Saleen', 'Saleen Performance', 'Saturn', 'Scion', 'Shelby', 'Spyker',
  'Sterling', 'Superior Coaches Div E.p. Dutton', 'Tecstar LP',
  'Texas Coach Company', 'VPG', 'Vector', 'Vixen Motor Company',
  'Volga Associated Automobile', 'Wallace Environmental', 'Yugo',
  'Mcevoy Motors', 'Bertone', 'Bugatti', 'Bugatti Rimac', 'Koenigsegg',
  'Lamborghini', 'McLaren Automotive', 'Pagani', 'Morgan', 'TVR Engineering Ltd',
]);

const MAKE_ALIASES = {
  'MINI': 'Mini',
};

function normalizeMake(make) {
  return MAKE_ALIASES[make] || make;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += c;
      }
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"') { inQuotes = true; }
      else { cur += c; }
    }
  }
  out.push(cur);
  return out;
}

function mapMotorisation(fuelType1, atvType) {
  const ft = (fuelType1 || '').trim();
  const at = (atvType || '').trim();
  if (ft.includes('Electricity')) return 'Électrique';
  if (at === 'Plug-in Hybrid' || at.includes('PHEV')) return 'Hybride rechargeable';
  if (at === 'Hybrid' || at.includes('Hybrid')) return 'Hybride';
  if (ft.includes('Diesel')) return 'Diesel';
  return 'Essence';
}

function isElectrifiedForFilter(fuelType1, atvType) {
  const ft = (fuelType1 || '');
  const at = (atvType || '');
  if (ft.includes('Electricity')) return true;
  if (at.includes('Hybrid') || at.includes('PHEV') || at.includes('EV')) return true;
  return false;
}

const raw = fs.readFileSync(CSV_PATH, 'utf8');
const lines = raw.split(/\r?\n/);
const header = parseCsvLine(lines[0]);
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const required = ['make', 'model', 'year', 'displ', 'co2TailpipeGpm', 'fuelType1', 'atvType'];
for (const k of required) {
  if (idx[k] === undefined) throw new Error(`Missing column: ${k}`);
}

const seen = new Set();
const vehicles = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  const row = parseCsvLine(line);
  const make = normalizeMake((row[idx.make] || '').trim());
  const model = (row[idx.model] || '').trim();
  const yearStr = (row[idx.year] || '').trim();
  if (!make || !model || !yearStr) continue;
  if (BLACKLIST.has(make)) continue;

  const year = parseInt(yearStr, 10);
  if (!Number.isFinite(year)) continue;

  const fuelType1 = row[idx.fuelType1] || '';
  const atvType = row[idx.atvType] || '';

  const electrified = isElectrifiedForFilter(fuelType1, atvType);
  if (electrified) {
    if (year < 2000) continue;
  } else {
    if (year < 2015) continue;
  }

  const co2Raw = parseFloat(row[idx.co2TailpipeGpm]);
  const co2 = Number.isFinite(co2Raw) && co2Raw > 0
    ? Math.round(co2Raw / 1.60934)
    : null;

  const displRaw = parseFloat(row[idx.displ]);
  const cylindree = Number.isFinite(displRaw) && displRaw > 0
    ? Math.round(displRaw * 1000)
    : null;

  const motorisation = mapMotorisation(fuelType1, atvType);

  const key = `${make}|${model}|${year}`;
  if (seen.has(key)) continue;
  seen.add(key);

  vehicles.push({ make, model, year, co2, cylindree, motorisation });
}

vehicles.sort((a, b) => {
  if (a.make !== b.make) return a.make.localeCompare(b.make);
  if (a.model !== b.model) return a.model.localeCompare(b.model);
  return a.year - b.year;
});

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(vehicles, null, 2));

const makes = [...new Set(vehicles.map((v) => v.make))].sort((a, b) => a.localeCompare(b));
console.log(`Total véhicules : ${vehicles.length}`);
console.log(`Marques uniques : ${makes.length}`);
console.log(`Marques retenues :`);
console.log(makes.join(', '));

// CSV-Import für Praxis-Stammdaten (Schritt 2.8).
// Format (Semikolon-getrennt, mit Kopfzeile, ohne Anführungszeichen):
// name;street;zip;city;lat;lon;services;partner;website;phone;opening_hours
//   services: kommagetrennte Tags (z. B. vitamin-d-diagnostik,blutbild)
//   partner:  true/false
// Verwendung: DATABASE_URL=... pnpm import:praxen pfad/zur/datei.csv
// Upsert-Schlüssel: name + zip (bestehende Einträge werden aktualisiert).
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const [, , file] = process.argv
if (!file) {
  console.error('Verwendung: pnpm import:praxen <datei.csv>')
  process.exit(1)
}
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL ist nicht gesetzt.')
  process.exit(1)
}

const EXPECTED_HEADER =
  'name;street;zip;city;lat;lon;services;partner;website;phone;opening_hours'

const run = async (): Promise<void> => {
  const content = await readFile(file, 'utf8')
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines[0] !== EXPECTED_HEADER) {
    console.error(`Unerwartete Kopfzeile. Erwartet:\n${EXPECTED_HEADER}`)
    process.exit(1)
  }

  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  let imported = 0
  try {
    for (const [index, line] of lines.slice(1).entries()) {
      const cols = line.split(';')
      if (cols.length !== 11) {
        throw new Error(`Zeile ${index + 2}: ${cols.length} statt 11 Spalten.`)
      }
      const [name, street, zip, city, lat, lon, services, partner, website, phone, openingHours] = cols
      if (!name || !/^\d{5}$/.test(zip ?? '') || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
        throw new Error(`Zeile ${index + 2}: name/zip/lat/lon ungültig.`)
      }
      await client.query(
        `insert into praxen.practices
           (name, street, zip, city, location, services, partner, website, phone, opening_hours)
         values ($1, nullif($2,''), $3, $4,
                 st_setsrid(st_makepoint($6, $5), 4326)::geography,
                 $7, $8, nullif($9,''), nullif($10,''), nullif($11,''))
         on conflict do nothing`,
        [
          name,
          street,
          zip,
          city,
          Number(lat),
          Number(lon),
          (services ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          partner === 'true',
          website,
          phone,
          openingHours,
        ],
      )
      imported += 1
    }
    console.log(`${imported} Praxen importiert/aktualisiert.`)
  } finally {
    await client.end()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

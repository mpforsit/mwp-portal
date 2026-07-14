// Legt die Test-Datenbank an (falls fehlend) und räumt das cms-Schema,
// damit Payloads Dev-Push jeden Lauf auf leerem Stand aufsetzt.
import pg from 'pg'

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

export default async function setup(): Promise<void> {
  const url = new URL(testUrl)
  const dbName = url.pathname.slice(1)

  const adminUrl = new URL(testUrl)
  adminUrl.pathname = '/postgres'
  const admin = new pg.Client({ connectionString: adminUrl.toString() })
  await admin.connect()
  const exists = await admin.query('select 1 from pg_database where datname = $1', [dbName])
  if (!exists.rowCount) {
    try {
      await admin.query(`create database "${dbName}"`)
    } catch (err) {
      // 42P04/23505: parallele Global-Setups haben die DB gerade
      // angelegt — dann ist alles gut
      const code = (err as { code?: string }).code
      if (code !== '42P04' && code !== '23505') throw err
    }
  }
  await admin.end()

  const client = new pg.Client({ connectionString: testUrl })
  await client.connect()
  await client.query('drop schema if exists cms cascade')
  await client.end()
}

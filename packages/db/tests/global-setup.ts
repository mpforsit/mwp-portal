// Test-DB anlegen (falls fehlend) und Engine-Schemata zurücksetzen,
// damit Migrationen + Seeds jeden Lauf auf leerem Stand aufsetzen.
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
  const exists = await admin.query(
    'select 1 from pg_database where datname = $1',
    [dbName],
  )
  if (!exists.rowCount) {
    await admin.query(`create database "${dbName}"`)
  }
  await admin.end()

  const client = new pg.Client({ connectionString: testUrl })
  await client.connect()
  await client.query('drop schema if exists vergleich cascade')
  await client.query('drop schema if exists praxen cascade')
  await client.query('drop schema if exists engine_meta cascade')
  await client.end()
}

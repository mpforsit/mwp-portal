// Einfacher, idempotenter Migrations-Runner: führt alle .sql-Dateien
// aus /migrations in lexikografischer Reihenfolge aus und merkt sich
// angewendete Dateien in engine_meta.migrations. Jede Migration läuft
// in einer eigenen Transaktion.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url))

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL ist nicht gesetzt.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: databaseUrl })

const run = async (): Promise<void> => {
  await client.connect()
  await client.query('create schema if not exists engine_meta')
  await client.query(`
    create table if not exists engine_meta.migrations (
      filename   text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const { rowCount } = await client.query(
      'select 1 from engine_meta.migrations where filename = $1',
      [file],
    )
    if (rowCount) {
      console.log(`übersprungen (bereits angewendet): ${file}`)
      continue
    }
    const sql = await readFile(path.join(migrationsDir, file), 'utf8')
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query(
        'insert into engine_meta.migrations (filename) values ($1)',
        [file],
      )
      await client.query('commit')
      console.log(`angewendet: ${file}`)
    } catch (err) {
      await client.query('rollback')
      console.error(`fehlgeschlagen: ${file}`)
      throw err
    }
  }
}

run()
  .then(() => client.end())
  .catch(async (err) => {
    console.error(err)
    await client.end()
    process.exit(1)
  })

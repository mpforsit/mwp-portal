// Kernlogik des Migrations-Runners: alle .sql-Dateien eines
// Verzeichnisses in lexikografischer Reihenfolge, je in eigener
// Transaktion, Protokoll in engine_meta.migrations (idempotent).
// Seeds laufen ohne Protokoll — sie sind selbst idempotent.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const listSqlFiles = async (dir: string): Promise<string[]> =>
  (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()

export const runMigrations = async (
  databaseUrl: string,
  migrationsDir: string,
  log: (msg: string) => void = console.log,
): Promise<void> => {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await client.query('create schema if not exists engine_meta')
    await client.query(`
      create table if not exists engine_meta.migrations (
        filename   text primary key,
        applied_at timestamptz not null default now()
      )
    `)

    for (const file of await listSqlFiles(migrationsDir)) {
      const { rowCount } = await client.query(
        'select 1 from engine_meta.migrations where filename = $1',
        [file],
      )
      if (rowCount) {
        log(`übersprungen (bereits angewendet): ${file}`)
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
        log(`angewendet: ${file}`)
      } catch (err) {
        await client.query('rollback')
        log(`fehlgeschlagen: ${file}`)
        throw err
      }
    }
  } finally {
    await client.end()
  }
}

export const runSeeds = async (
  databaseUrl: string,
  seedsDir: string,
  log: (msg: string) => void = console.log,
): Promise<void> => {
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    for (const file of await listSqlFiles(seedsDir)) {
      const sql = await readFile(path.join(seedsDir, file), 'utf8')
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query('commit')
        log(`Seed angewendet: ${file}`)
      } catch (err) {
        await client.query('rollback')
        throw err
      }
    }
  } finally {
    await client.end()
  }
}

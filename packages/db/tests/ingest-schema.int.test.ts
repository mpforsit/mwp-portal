// Integrationstests für das Ingest-Staging-Schema (0005):
// (a) Schema + Tabellen existieren
// (b) sources.category_id verweist auf vergleich.categories (FK)
// (c) genau eine Extraktion pro Quelle (unique source_id)
// (d) promoted_product_id verweist auf vergleich.products (FK)
// (e) ROTE LINIE: ingest hat KEINEN Fremdschlüssel auf
//     vergleich.product_evaluations (Sondierung bewertet nicht)
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMigrations, runSeeds } from '../src/migrate.js'

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

// aus seeds/0001_vergleich_seed.sql
const CATEGORY = '11111111-1111-1111-1111-111111111111'
const PRODUCT = '33333333-3333-3333-3333-333333333333'

let client: pg.Client

beforeAll(async () => {
  const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url))
  await runMigrations(testUrl, dir('../migrations'), () => {})
  await runSeeds(testUrl, dir('../seeds'), () => {})
  client = new pg.Client({ connectionString: testUrl })
  await client.connect()
})

afterAll(async () => {
  await client.end()
})

describe('Ingest-Staging-Schema', () => {
  it('legt Schema + Kern-Tabellen an', async () => {
    const { rows } = await client.query(
      `select table_name from information_schema.tables
       where table_schema = 'ingest' order by table_name`,
    )
    const names = rows.map((r) => r.table_name)
    expect(names).toEqual([
      'attribute_suggestions',
      'extractions',
      'selected_attributes',
      'snapshots',
      'sources',
    ])
  })

  it('source braucht eine gültige Kategorie (FK)', async () => {
    await expect(
      client.query(
        `insert into ingest.sources (category_id, url)
         values ('00000000-0000-0000-0000-000000000000', 'https://x.example/1')`,
      ),
    ).rejects.toThrow(/foreign key|violates/i)
  })

  it('erlaubt genau eine Extraktion pro Quelle', async () => {
    const { rows } = await client.query(
      `insert into ingest.sources (category_id, url)
       values ($1, 'https://hersteller.example/d3-1000') returning id`,
      [CATEGORY],
    )
    const sourceId = rows[0].id
    await client.query(
      `insert into ingest.extractions (source_id, category_id, name)
       values ($1, $2, 'D3 1000')`,
      [sourceId, CATEGORY],
    )
    await expect(
      client.query(
        `insert into ingest.extractions (source_id, category_id, name)
         values ($1, $2, 'D3 1000 Dublette')`,
        [sourceId, CATEGORY],
      ),
    ).rejects.toThrow(/unique|duplicate/i)
  })

  it('promoted_product_id verweist auf vergleich.products (FK)', async () => {
    const { rows } = await client.query(
      `insert into ingest.sources (category_id, url)
       values ($1, 'https://hersteller.example/d3-2000') returning id`,
      [CATEGORY],
    )
    const sourceId = rows[0].id
    // gültige Produkt-ID (aus Seed) wird akzeptiert
    await expect(
      client.query(
        `insert into ingest.extractions
           (source_id, category_id, name, status, promoted_product_id)
         values ($1, $2, 'D3 2000', 'promoted', $3)`,
        [sourceId, CATEGORY, PRODUCT],
      ),
    ).resolves.toBeDefined()
    // unbekannte Produkt-ID wird abgelehnt
    const { rows: r2 } = await client.query(
      `insert into ingest.sources (category_id, url)
       values ($1, 'https://hersteller.example/d3-3000') returning id`,
      [CATEGORY],
    )
    await expect(
      client.query(
        `insert into ingest.extractions
           (source_id, category_id, name, promoted_product_id)
         values ($1, $2, 'D3 3000', '99999999-9999-9999-9999-999999999999')`,
        [r2[0].id, CATEGORY],
      ),
    ).rejects.toThrow(/foreign key|violates/i)
  })

  it('rote Linie: kein Fremdschlüssel von ingest auf product_evaluations', async () => {
    const { rows } = await client.query(
      `select count(*)::int as n
       from information_schema.table_constraints tc
       join information_schema.constraint_column_usage ccu
         on tc.constraint_name = ccu.constraint_name
        and tc.constraint_schema = ccu.constraint_schema
       where tc.constraint_type = 'FOREIGN KEY'
         and tc.table_schema = 'ingest'
         and ccu.table_name = 'product_evaluations'`,
    )
    expect(rows[0].n).toBe(0)
  })
})

// Integrationstests für das Vergleichs-Engine-Schema (Schritt 2.1):
// (a) zweites aktives Schema pro Kategorie wird abgelehnt
// (b) Update einer publizierten Bewertung wirft Exception (rote Linie:
//     Unveränderlichkeits-Trigger)
// (c) Gewichtssumme ≠ 100 wird abgelehnt
// (d) current_ranking liefert nur die neueste publizierte, nicht
//     abgelöste Bewertung unter dem aktiven Schema
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runMigrations, runSeeds } from '../src/migrate.js'

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

const CATEGORY = '11111111-1111-1111-1111-111111111111'
const SCHEMA_V1 = '22222222-2222-2222-2222-222222222222'
const PRODUCT = '33333333-3333-3333-3333-333333333333'

const validCriteria = JSON.stringify([
  { key: 'a', weight: 60, scoring: { map: { x: 10 } } },
  { key: 'b', weight: 40, scoring: { map: { x: 10 } } },
])

let client: pg.Client

beforeAll(async () => {
  const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url))
  await runMigrations(testUrl, dir('../migrations'), () => {})
  await runSeeds(testUrl, dir('../seeds'), () => {})
  client = new pg.Client({ connectionString: testUrl })
  await client.connect()
  await client.query('set search_path to vergleich, public')
})

afterAll(async () => {
  await client.end()
})

describe('Vergleichs-Engine-Schema', () => {
  it('Migrationen sind idempotent (zweiter Lauf ist No-op)', async () => {
    const dir = fileURLToPath(new URL('../migrations', import.meta.url))
    await expect(runMigrations(testUrl, dir, () => {})).resolves.toBeUndefined()
  })

  it('Seed reproduziert die 86.50 aus dem Artefakt', async () => {
    const { rows } = await client.query(
      'select total_score from product_evaluations where product_id = $1',
      [PRODUCT],
    )
    expect(rows[0].total_score).toBe('86.50')
  })

  it('(a) zweites aktives Schema für dieselbe Kategorie wird abgelehnt', async () => {
    await expect(
      client.query(
        `insert into criteria_schemas
           (category_id, version, status, criteria, methodology_md, created_by)
         values ($1, 2, 'active', $2::jsonb, 'v2', 'test')`,
        [CATEGORY, validCriteria],
      ),
    ).rejects.toThrow(/one_active_schema_per_category/)
  })

  it('(b) Update einer publizierten Bewertung wirft Exception', async () => {
    await expect(
      client.query(
        `update product_evaluations set total_score = 99.99
         where product_id = $1 and published`,
        [PRODUCT],
      ),
    ).rejects.toThrow(/unveraenderlich/)
    // superseded_by bleibt änderbar (vorgesehener Korrektur-Weg)
    const res = await client.query(
      `update product_evaluations set superseded_by = null
       where product_id = $1 and published`,
      [PRODUCT],
    )
    expect(res.rowCount).toBe(1)
  })

  it('(c) Gewichtssumme ≠ 100 wird abgelehnt', async () => {
    const badCriteria = JSON.stringify([
      { key: 'a', weight: 60, scoring: { map: { x: 10 } } },
      { key: 'b', weight: 30, scoring: { map: { x: 10 } } },
    ])
    await expect(
      client.query(
        `insert into criteria_schemas
           (category_id, version, status, criteria, methodology_md, created_by)
         values ($1, 3, 'draft', $2::jsonb, 'kaputt', 'test')`,
        [CATEGORY, badCriteria],
      ),
    ).rejects.toThrow(/summieren auf 90 statt 100/)
  })

  it('(d) current_ranking: nur neueste publizierte, nicht abgelöste Bewertung unter aktivem Schema', async () => {
    // Ausgangslage aus dem Seed: eine publizierte Bewertung (86.50)
    // Ältere publizierte Bewertung ergänzen → View muss weiter die
    // neueste (86.50) liefern
    await client.query(
      `insert into product_evaluations
         (product_id, schema_id, scores, total_score, evaluated_by,
          evaluated_at, published)
       values ($1, $2, '{}'::jsonb, 50.00, 'test', now() - interval '30 days', true)`,
      [PRODUCT, SCHEMA_V1],
    )
    let { rows } = await client.query(
      'select total_score from current_ranking where product_id = $1',
      [PRODUCT],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].total_score).toBe('86.50')

    // Unpublizierte neuere Bewertung → ändert nichts
    await client.query(
      `insert into product_evaluations
         (product_id, schema_id, scores, total_score, evaluated_by, published)
       values ($1, $2, '{}'::jsonb, 95.00, 'test', false)`,
      [PRODUCT, SCHEMA_V1],
    )
    ;({ rows } = await client.query(
      'select total_score from current_ranking where product_id = $1',
      [PRODUCT],
    ))
    expect(rows[0].total_score).toBe('86.50')

    // Neueste publizierte Bewertung wird abgelöst (superseded_by) →
    // View fällt auf die ältere publizierte zurück
    const successor = await client.query(
      `insert into product_evaluations
         (product_id, schema_id, scores, total_score, evaluated_by, published)
       values ($1, $2, '{}'::jsonb, 90.00, 'test', false)
       returning id`,
      [PRODUCT, SCHEMA_V1],
    )
    await client.query(
      `update product_evaluations set superseded_by = $2
       where product_id = $1 and published and total_score = 86.50`,
      [PRODUCT, successor.rows[0].id],
    )
    ;({ rows } = await client.query(
      'select total_score from current_ranking where product_id = $1',
      [PRODUCT],
    ))
    expect(rows).toHaveLength(1)
    expect(rows[0].total_score).toBe('50.00')

    // Aufräumen: Ablösung zurücknehmen (Seed-Zustand wiederherstellen)
    await client.query(
      `update product_evaluations set superseded_by = null
       where product_id = $1 and total_score = 86.50`,
      [PRODUCT],
    )
  })

  it('(d2) Bewertungen unter inaktivem Schema erscheinen nicht im Ranking', async () => {
    // Kategorie ohne aktives Schema: Bewertung unter draft-Schema
    const cat = await client.query(
      `insert into categories (slug, name) values ('test-kategorie', 'Test')
       returning id`,
    )
    const draftSchema = await client.query(
      `insert into criteria_schemas
         (category_id, version, status, criteria, methodology_md, created_by)
       values ($1, 1, 'draft', $2::jsonb, 'draft', 'test')
       returning id`,
      [cat.rows[0].id, validCriteria],
    )
    const prod = await client.query(
      `insert into products (category_id, slug, name, manufacturer)
       values ($1, 'test-produkt', 'Testprodukt', 'Test GmbH')
       returning id`,
      [cat.rows[0].id],
    )
    await client.query(
      `insert into product_evaluations
         (product_id, schema_id, scores, total_score, evaluated_by, published)
       values ($1, $2, '{}'::jsonb, 88.00, 'test', true)`,
      [prod.rows[0].id, draftSchema.rows[0].id],
    )
    const { rows } = await client.query(
      'select 1 from current_ranking where product_id = $1',
      [prod.rows[0].id],
    )
    expect(rows).toHaveLength(0)
  })

  it('Transparenz-View liefert eine Zeile pro Kategorie mit Ranking', async () => {
    const { rows } = await client.query(
      `select * from transparency_rank_vs_commission where category = 'vitamin-d'`,
    )
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].products_ranked)).toBeGreaterThanOrEqual(1)
  })
})

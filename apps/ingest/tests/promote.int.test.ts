// Integrationstest Tor 2 + Promote (Schritt 8), inkl. ROTE LINIE:
// Promote schreibt nach vergleich.products, NIE nach product_evaluations.
import { execSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { closePool, getPool } from '../src/db.js'
import { setExtractionStatus } from '../src/extractions-repo.js'
import { promoteExtraction, PromoteError } from '../src/promote.js'
import { addSource } from '../src/sources-repo.js'

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

let categoryId: string

beforeAll(async () => {
  const env = { ...process.env, DATABASE_URL: testUrl }
  execSync('pnpm --filter @mwp/db migrate', { env, stdio: 'pipe' })
  execSync('pnpm --filter @mwp/db seed', { env, stdio: 'pipe' })
  vi.stubEnv('DATABASE_URL', testUrl)
  const { rows } = await getPool().query(
    `insert into vergleich.categories (slug, name)
     values ('promote-test', 'Promote-Test') returning id`,
  )
  categoryId = rows[0].id as string
})

afterAll(async () => {
  await closePool()
  vi.unstubAllEnvs()
})

// Legt einen Draft direkt an (Quelle + Extraktion) und gibt die id zurück.
const seedExtraction = async (
  url: string,
  name: string,
  gtin: string | null,
): Promise<string> => {
  const { id: sourceId } = await addSource(categoryId, url)
  const { rows } = await getPool().query(
    `insert into ingest.extractions
       (source_id, category_id, name, manufacturer, gtin, attributes, confidence, provenance)
     values ($1, $2, $3, 'ACME', $4, $5, '{}', '{}') returning id`,
    [
      sourceId,
      categoryId,
      name,
      gtin,
      JSON.stringify({ dosis: { raw: '25 µg', ie: 1000 } }),
    ],
  )
  return rows[0].id as string
}

describe('promoteExtraction', () => {
  it('nur abgenommene Extraktionen sind übernehmbar', async () => {
    const id = await seedExtraction('https://s.example/p1', 'D3 1000', '4001')
    await expect(promoteExtraction(id)).rejects.toBeInstanceOf(PromoteError)
  })

  it('legt ein Produkt an und schreibt NICHT nach product_evaluations', async () => {
    const id = await seedExtraction('https://s.example/p2', 'D3 2000', '4002')
    await setExtractionStatus(id, 'approved')

    const { productId, created } = await promoteExtraction(id)
    expect(created).toBe(true)

    const prod = await getPool().query(
      'select name, gtin, attributes, status from vergleich.products where id = $1',
      [productId],
    )
    expect(prod.rows[0].name).toBe('D3 2000')
    expect(prod.rows[0].gtin).toBe('4002')
    expect(prod.rows[0].status).toBe('listed')

    // Extraktion ist nun verlinkt + promoted
    const ext = await getPool().query(
      'select status, promoted_product_id from ingest.extractions where id = $1',
      [id],
    )
    expect(ext.rows[0].status).toBe('promoted')
    expect(ext.rows[0].promoted_product_id).toBe(productId)

    // ROTE LINIE: keine Bewertung für dieses Produkt entstanden
    const evals = await getPool().query(
      'select count(*)::int as n from vergleich.product_evaluations where product_id = $1',
      [productId],
    )
    expect(evals.rows[0].n).toBe(0)
  })

  it('dedupliziert über GTIN (aktualisiert statt dupliziert)', async () => {
    const gtin = '4003'
    const first = await seedExtraction('https://s.example/p3a', 'D3 dup A', gtin)
    await setExtractionStatus(first, 'approved')
    const a = await promoteExtraction(first)

    const second = await seedExtraction('https://s.example/p3b', 'D3 dup B', gtin)
    await setExtractionStatus(second, 'approved')
    const b = await promoteExtraction(second)

    expect(b.created).toBe(false)
    expect(b.productId).toBe(a.productId)

    const count = await getPool().query(
      'select count(*)::int as n from vergleich.products where category_id = $1 and gtin = $2',
      [categoryId, gtin],
    )
    expect(count.rows[0].n).toBe(1)
  })
})

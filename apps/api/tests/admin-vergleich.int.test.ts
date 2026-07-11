// Integrationstest des Pflege-Workflows (Schritt 2.3): Produkt
// anlegen → Bewertung previewen → speichern → publizieren →
// Nachfolger publizieren (superseded_by-Kette) — gegen die Test-DB.
import { execSync } from 'node:child_process'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { registerAdminVergleich } from '../src/admin-vergleich.js'
import { closePool, getPool } from '../src/db.js'

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

const CATEGORY = '11111111-1111-1111-1111-111111111111'
const SCHEMA_V1 = '22222222-2222-2222-2222-222222222222'

const auth = {
  authorization: `Basic ${Buffer.from('redaktion:pflege-passwort').toString('base64')}`,
}
const form = { 'content-type': 'application/x-www-form-urlencoded' }

const seedForm = new URLSearchParams({
  schema_id: SCHEMA_V1,
  raw_micro_dosing: '400',
  raw_form: 'tropfen',
  raw_k2_combo: 'mk7_all_trans',
  raw_carrier: 'mct',
  raw_price_per_1000ie: '0.25',
  raw_third_party_cert: 'public_per_batch',
  note_price_per_1000ie: 'Stichprobe Test',
  evaluated_by: 'pflege@test',
  evidence: '[]',
})

let app: ReturnType<typeof Fastify>

beforeAll(() => {
  const env = { ...process.env, DATABASE_URL: testUrl }
  execSync('pnpm --filter @mwp/db migrate', { env, stdio: 'pipe' })
  execSync('pnpm --filter @mwp/db seed', { env, stdio: 'pipe' })
  vi.stubEnv('DATABASE_URL', testUrl)
  vi.stubEnv('ADMIN_USER', 'redaktion')
  vi.stubEnv('ADMIN_PASSWORD', 'pflege-passwort')
  app = Fastify()
  registerAdminVergleich(app)
})

afterAll(async () => {
  await closePool()
  vi.unstubAllEnvs()
})

describe('Pflege-Workflow', () => {
  it('verlangt Basic-Auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/vergleich' })
    expect(res.statusCode).toBe(401)
    expect(res.headers['www-authenticate']).toContain('Basic')
  })

  it('503 ohne konfigurierte Zugangsdaten (nie offen)', async () => {
    vi.stubEnv('ADMIN_USER', '')
    const res = await app.inject({
      method: 'GET',
      url: '/admin/vergleich',
      headers: auth,
    })
    expect(res.statusCode).toBe(503)
    vi.stubEnv('ADMIN_USER', 'redaktion')
  })

  let productId: string
  let firstEvalId: string
  let secondEvalId: string

  it('legt ein Produkt an', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/vergleich/produkte',
      headers: { ...auth, ...form },
      payload: new URLSearchParams({
        category_id: CATEGORY,
        slug: 'workflow-test-produkt',
        name: 'Workflow-Testprodukt',
        manufacturer: 'Test GmbH',
        gtin: '',
        attributes: '{"form":"tropfen"}',
      }).toString(),
    })
    expect(res.statusCode).toBe(303)
    productId = (res.headers.location as string).split('/').pop() as string
  })

  it('zeigt den Preview-Score, ohne zu speichern', async () => {
    const before = await getPool().query(
      'select count(*)::int as n from vergleich.product_evaluations where product_id = $1',
      [productId],
    )
    const res = await app.inject({
      method: 'POST',
      url: `/admin/vergleich/produkt/${productId}/bewertung`,
      headers: { ...auth, ...form },
      payload: `${seedForm.toString()}&action=preview`,
    })
    expect(res.statusCode).toBe(200)
    // 10*2 + 10*1 + 10*1.5 + 10*1 + 10*2.5 + 10*2 = 100
    expect(res.body).toContain('Preview: 100')
    const after = await getPool().query(
      'select count(*)::int as n from vergleich.product_evaluations where product_id = $1',
      [productId],
    )
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })

  it('speichert die Bewertung unpubliziert', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/vergleich/produkt/${productId}/bewertung`,
      headers: { ...auth, ...form },
      payload: `${seedForm.toString()}&action=save`,
    })
    expect(res.statusCode).toBe(303)
    const { rows } = await getPool().query(
      `select id, published, total_score, scores from vergleich.product_evaluations
       where product_id = $1`,
      [productId],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].published).toBe(false)
    expect(rows[0].total_score).toBe('100.00')
    expect(rows[0].scores.price_per_1000ie.note).toBe('Stichprobe Test')
    firstEvalId = rows[0].id
  })

  it('publiziert die Bewertung → erscheint im current_ranking', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/admin/vergleich/bewertung/${firstEvalId}/publish`,
      headers: { ...auth, ...form },
      payload: '',
    })
    expect(res.statusCode).toBe(303)
    const { rows } = await getPool().query(
      'select total_score, rank from vergleich.current_ranking where product_id = $1',
      [productId],
    )
    expect(rows[0].total_score).toBe('100.00')
    expect(Number(rows[0].rank)).toBe(1)
  })

  it('Nachfolger publizieren löst die alte Bewertung ab (superseded_by)', async () => {
    // zweite Bewertung mit anderem Preis speichern
    const updated = new URLSearchParams(seedForm)
    updated.set('raw_price_per_1000ie', '0.9')
    await app.inject({
      method: 'POST',
      url: `/admin/vergleich/produkt/${productId}/bewertung`,
      headers: { ...auth, ...form },
      payload: `${updated.toString()}&action=save`,
    })
    const draft = await getPool().query(
      `select id from vergleich.product_evaluations
       where product_id = $1 and not published`,
      [productId],
    )
    secondEvalId = draft.rows[0].id

    await app.inject({
      method: 'POST',
      url: `/admin/vergleich/bewertung/${secondEvalId}/publish`,
      headers: { ...auth, ...form },
      payload: '',
    })

    const old = await getPool().query(
      'select superseded_by from vergleich.product_evaluations where id = $1',
      [firstEvalId],
    )
    expect(old.rows[0].superseded_by).toBe(secondEvalId)

    const ranking = await getPool().query(
      'select total_score from vergleich.current_ranking where product_id = $1',
      [productId],
    )
    expect(ranking.rows).toHaveLength(1)
    // 0,90 € greift die Band max 1.00 → 4 Punkte:
    // 10*2 + 10*1 + 10*1.5 + 10*1 + 4*2.5 + 10*2 = 85.00
    expect(ranking.rows[0].total_score).toBe('85.00')
  })

  it('Aufräumen: Testdaten entfernen', async () => {
    await getPool().query(
      `update vergleich.product_evaluations set superseded_by = null
       where product_id = $1`,
      [productId],
    )
    await getPool().query(
      'delete from vergleich.product_evaluations where product_id = $1',
      [productId],
    )
    await getPool().query('delete from vergleich.products where id = $1', [
      productId,
    ])
    expect(true).toBe(true)
  })
})

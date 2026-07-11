// Integrationstest der Bewertungs-Endpoints (Schritt 2.2) gegen die
// Test-DB: Migrationen+Seeds aus packages/db, dann Preview und
// Speichern über die Fastify-Routen.
import { execSync } from 'node:child_process'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { closePool, getPool } from '../src/db.js'
import { registerEvaluationRoutes } from '../src/evaluations.js'

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

const SCHEMA_V1 = '22222222-2222-2222-2222-222222222222'
const PRODUCT = '33333333-3333-3333-3333-333333333333'

const seedRaws = {
  micro_dosing: 1000,
  form: 'tropfen',
  k2_combo: 'mk7_all_trans',
  carrier: 'mct',
  price_per_1000ie: 0.42,
  third_party_cert: 'public_per_batch',
}

const buildApp = () => {
  const app = Fastify()
  registerEvaluationRoutes(app)
  return app
}

beforeAll(() => {
  // Schema-Stand aus packages/db herstellen (dort getestet)
  const env = { ...process.env, DATABASE_URL: testUrl }
  execSync('pnpm --filter @mwp/db migrate', { env, stdio: 'pipe' })
  execSync('pnpm --filter @mwp/db seed', { env, stdio: 'pipe' })
  vi.stubEnv('DATABASE_URL', testUrl)
})

afterAll(async () => {
  await closePool()
  vi.unstubAllEnvs()
})

describe('POST /internal/evaluations/preview', () => {
  it('berechnet 86.50, ohne zu speichern', async () => {
    const app = buildApp()
    const before = await getPool().query(
      'select count(*)::int as n from vergleich.product_evaluations',
    )
    const res = await app.inject({
      method: 'POST',
      url: '/internal/evaluations/preview',
      payload: { schemaId: SCHEMA_V1, raws: seedRaws },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().totalScore).toBe(86.5)
    const after = await getPool().query(
      'select count(*)::int as n from vergleich.product_evaluations',
    )
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })

  it('400 bei unbekanntem map-Wert mit hilfreicher Meldung', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/evaluations/preview',
      payload: { schemaId: SCHEMA_V1, raws: { ...seedRaws, form: 'pulver' } },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toMatch(/erlaubt/)
  })
})

describe('POST /internal/evaluations', () => {
  it('speichert unpubliziert mit berechnetem Score', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/evaluations',
      payload: {
        schemaId: SCHEMA_V1,
        productId: PRODUCT,
        raws: seedRaws,
        notes: { price_per_1000ie: 'Preisstichprobe Test' },
        evaluatedBy: 'test@portal',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.published).toBe(false)
    const row = await getPool().query(
      'select published, total_score, scores from vergleich.product_evaluations where id = $1',
      [body.id],
    )
    expect(row.rows[0].published).toBe(false)
    expect(row.rows[0].total_score).toBe('86.50')
    expect(row.rows[0].scores.price_per_1000ie.note).toBe(
      'Preisstichprobe Test',
    )
    // aufräumen, damit weitere Läufe deterministisch bleiben
    await getPool().query(
      'delete from vergleich.product_evaluations where id = $1',
      [body.id],
    )
  })

  it('400 wenn Produkt nicht zur Schema-Kategorie gehört', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/evaluations',
      payload: {
        schemaId: SCHEMA_V1,
        productId: '99999999-9999-9999-9999-999999999999',
        raws: seedRaws,
        evaluatedBy: 'test@portal',
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('401 bei gesetztem INTERNAL_API_TOKEN ohne Bearer', async () => {
    vi.stubEnv('INTERNAL_API_TOKEN', 'geheim')
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/internal/evaluations/preview',
      payload: { schemaId: SCHEMA_V1, raws: seedRaws },
    })
    expect(res.statusCode).toBe(401)
    vi.stubEnv('INTERNAL_API_TOKEN', '')
  })
})

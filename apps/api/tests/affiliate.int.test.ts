// Integrationstests der Affiliate-Redirects (Schritt 2.5).
import { execSync } from 'node:child_process'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { referrerPath, registerAffiliateRoutes } from '../src/affiliate.js'
import { closePool, getPool } from '../src/db.js'

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

const LINK = '55555555-5555-5555-5555-555555555555'

let app: ReturnType<typeof Fastify>

beforeAll(() => {
  const env = { ...process.env, DATABASE_URL: testUrl }
  execSync('pnpm --filter @mwp/db migrate', { env, stdio: 'pipe' })
  execSync('pnpm --filter @mwp/db seed', { env, stdio: 'pipe' })
  vi.stubEnv('DATABASE_URL', testUrl)
  app = Fastify()
  registerAffiliateRoutes(app)
})

afterAll(async () => {
  await closePool()
  vi.unstubAllEnvs()
})

describe('referrerPath', () => {
  it('extrahiert nur den Pfad — Host und Query fallen weg', () => {
    expect(
      referrerPath('https://portal.example/vergleich/vitamin-d/?utm_source=x#top'),
    ).toBe('/vergleich/vitamin-d/')
  })
  it('null bei fehlendem oder kaputtem Referer', () => {
    expect(referrerPath(undefined)).toBeNull()
    expect(referrerPath('kein-url')).toBeNull()
  })
})

describe('GET /go/:linkId', () => {
  it('302 auf die Ziel-URL und zählt den Klick (nur linkId, Zeit, Pfad)', async () => {
    const before = await getPool().query(
      'select count(*)::int as n from vergleich.affiliate_clicks where link_id = $1',
      [LINK],
    )
    const res = await app.inject({
      method: 'GET',
      url: `/go/${LINK}`,
      headers: { referer: 'https://portal.example/vergleich/vitamin-d/?utm=x' },
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('https://shop.example/beispiel-d3-k2')

    const clicks = await getPool().query(
      `select referrer_path from vergleich.affiliate_clicks
       where link_id = $1 order by clicked_at desc limit 1`,
      [LINK],
    )
    expect(clicks.rows[0].referrer_path).toBe('/vergleich/vitamin-d/')
    const after = await getPool().query(
      'select count(*)::int as n from vergleich.affiliate_clicks where link_id = $1',
      [LINK],
    )
    expect(after.rows[0].n).toBe(before.rows[0].n + 1)
  })

  it('die Klick-Tabelle kann keine Nutzerdaten aufnehmen (Spalten-Check)', async () => {
    const { rows } = await getPool().query(
      `select column_name from information_schema.columns
       where table_schema = 'vergleich' and table_name = 'affiliate_clicks'
       order by column_name`,
    )
    expect(rows.map((r) => r.column_name)).toEqual([
      'clicked_at',
      'id',
      'link_id',
      'referrer_path',
    ])
  })

  it('410 mit Hinweis bei deaktiviertem Link', async () => {
    await getPool().query(
      'update vergleich.affiliate_links set active = false where id = $1',
      [LINK],
    )
    const res = await app.inject({ method: 'GET', url: `/go/${LINK}` })
    expect(res.statusCode).toBe(410)
    expect(res.body).toContain('nicht mehr aktiv')
    await getPool().query(
      'update vergleich.affiliate_links set active = true where id = $1',
      [LINK],
    )
  })

  it('404 bei unbekannter oder ungültiger ID', async () => {
    const unknown = await app.inject({
      method: 'GET',
      url: '/go/99999999-9999-9999-9999-999999999999',
    })
    expect(unknown.statusCode).toBe(404)
    const invalid = await app.inject({ method: 'GET', url: '/go/kaputt' })
    expect(invalid.statusCode).toBe(404)
  })
})

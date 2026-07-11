// Integrationstests des Praxisfinders (Schritt 2.8). Der
// Sortierungs-Test ist der Rote-Linie-Wächter: Die Reihenfolge ist
// nachweislich rein distanzbasiert — Partnerpraxen werden nicht
// bevorzugt.
import { execSync } from 'node:child_process'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { closePool, getPool } from '../src/db.js'
import { geocodePlz, registerPraxenRoutes } from '../src/praxen.js'

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

let app: ReturnType<typeof Fastify>

beforeAll(() => {
  const env = { ...process.env, DATABASE_URL: testUrl }
  execSync('pnpm --filter @mwp/db migrate', { env, stdio: 'pipe' })
  execSync('pnpm --filter @mwp/db seed', { env, stdio: 'pipe' })
  vi.stubEnv('DATABASE_URL', testUrl)
  app = Fastify()
  registerPraxenRoutes(app)
})

afterAll(async () => {
  await closePool()
  vi.unstubAllEnvs()
})

describe('GET /api/praxen', () => {
  it('sortiert nachweislich rein distanzbasiert — Partner ohne Bevorzugung', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/praxen?plz=80331&radius=100',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.practices.length).toBeGreaterThanOrEqual(3)

    // Distanzen streng aufsteigend
    const distances = body.practices.map((p: { distanceKm: number }) => p.distanceKm)
    expect([...distances].sort((a, b) => a - b)).toEqual(distances)

    // Die nächste Praxis ist KEINE Partnerpraxis (Seed so gewählt);
    // die Partnerpraxis folgt trotz Flag erst nach Distanz
    expect(body.practices[0].partner).toBe(false)
    expect(body.practices[0].name).toBe('Hausarztpraxis Altstadt')
    expect(body.practices[1].partner).toBe(true)

    // Kennzeichnung ist im Response enthalten
    expect(
      body.practices.some((p: { partner: boolean }) => p.partner === true),
    ).toBe(true)
  })

  it('filtert nach Leistungs-Tag', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/praxen?plz=80331&leistung=omega-3-index&radius=100',
    })
    const names = res
      .json()
      .practices.map((p: { name: string }) => p.name)
    expect(names).toContain('Partnerpraxis Isartor')
    expect(names).toContain('Labormedizin Augsburg')
    expect(names).not.toContain('Hausarztpraxis Altstadt')
  })

  it('Radius begrenzt die Treffer (Augsburg fällt bei 20 km raus)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/praxen?plz=80331&radius=20',
    })
    const names = res.json().practices.map((p: { name: string }) => p.name)
    expect(names).not.toContain('Labormedizin Augsburg')
  })

  it('400 bei ungültiger PLZ', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/praxen?plz=abc' })
    expect(res.statusCode).toBe(400)
  })
})

describe('geocodePlz', () => {
  it('nutzt den Cache ohne externen Request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await geocodePlz('80331')
    expect(result).toEqual({ lat: 48.1371, lon: 11.5754 })
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('fragt Nominatim bei Cache-Miss und füllt den Cache', async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL, _init?: RequestInit) =>
        new Response(JSON.stringify([{ lat: '52.5200', lon: '13.4050' }]), {
          status: 200,
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const result = await geocodePlz('10115')
    expect(result).toEqual({ lat: 52.52, lon: 13.405 })
    expect(fetchMock).toHaveBeenCalledOnce()
    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('postalcode=10115')

    // zweiter Aufruf kommt aus dem Cache
    fetchMock.mockClear()
    await geocodePlz('10115')
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    await getPool().query(
      "delete from praxen.geocode_cache where zip = '10115'",
    )
  })
})

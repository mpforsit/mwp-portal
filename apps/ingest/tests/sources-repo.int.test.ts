// Integrationstests der Quellen-Verwaltung (Schritt 3):
// (a) Quelle anlegen, (b) zweite ergänzen, (c) Dedup bei gleicher URL
// (Re-Run harmlos), (d) aktivieren/deaktivieren, (e) Admin-Seite
// verlangt Basic-Auth.
import { execSync } from 'node:child_process'
import Fastify from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { registerAdmin } from '../src/admin.js'
import { registerAdminAuth } from '../src/auth.js'
import { closePool } from '../src/db.js'
import {
  addSource,
  listCategories,
  listSources,
  setSourceActive,
} from '../src/sources-repo.js'

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

let app: ReturnType<typeof Fastify>
let categoryId: string

beforeAll(async () => {
  const env = { ...process.env, DATABASE_URL: testUrl }
  execSync('pnpm --filter @mwp/db migrate', { env, stdio: 'pipe' })
  execSync('pnpm --filter @mwp/db seed', { env, stdio: 'pipe' })
  vi.stubEnv('DATABASE_URL', testUrl)
  vi.stubEnv('INGEST_ADMIN_USER', 'stage')
  vi.stubEnv('INGEST_ADMIN_PASSWORD', 'geheim')
  app = Fastify()
  registerAdminAuth(app)
  registerAdmin(app)

  const categories = await listCategories()
  const vitaminD = categories.find((c) => c.slug === 'vitamin-d')
  if (!vitaminD) throw new Error('Seed-Kategorie vitamin-d fehlt')
  categoryId = vitaminD.id
})

afterAll(async () => {
  await closePool()
  vi.unstubAllEnvs()
})

describe('Quellen-Verwaltung', () => {
  it('legt eine Quelle an und ergänzt eine zweite', async () => {
    const a = await addSource(categoryId, 'https://hersteller.example/d3-1000', 'A')
    const b = await addSource(categoryId, 'https://hersteller.example/d3-2000', 'B')
    expect(a.created).toBe(true)
    expect(b.created).toBe(true)

    const urls = (await listSources()).map((s) => s.url)
    expect(urls).toContain('https://hersteller.example/d3-1000')
    expect(urls).toContain('https://hersteller.example/d3-2000')
  })

  it('dedupliziert dieselbe URL (Re-Run ist harmlos)', async () => {
    const first = await addSource(categoryId, 'https://hersteller.example/dup')
    const again = await addSource(categoryId, 'https://hersteller.example/dup')
    expect(first.created).toBe(true)
    expect(again.created).toBe(false)
    expect(again.id).toBe(first.id)

    const count = (await listSources()).filter(
      (s) => s.url === 'https://hersteller.example/dup',
    ).length
    expect(count).toBe(1)
  })

  it('aktiviert und deaktiviert eine Quelle', async () => {
    const { id } = await addSource(categoryId, 'https://hersteller.example/toggle')
    await setSourceActive(id, false)
    let source = (await listSources()).find((s) => s.id === id)
    expect(source?.active).toBe(false)
    await setSourceActive(id, true)
    source = (await listSources()).find((s) => s.id === id)
    expect(source?.active).toBe(true)
  })

  it('Admin-Seite verlangt Basic-Auth', async () => {
    const unauth = await app.inject({ method: 'GET', url: '/admin/sources' })
    expect(unauth.statusCode).toBe(401)

    const auth = Buffer.from('stage:geheim').toString('base64')
    const ok = await app.inject({
      method: 'GET',
      url: '/admin/sources',
      headers: { authorization: `Basic ${auth}` },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.body).toContain('Quellen')
  })
})

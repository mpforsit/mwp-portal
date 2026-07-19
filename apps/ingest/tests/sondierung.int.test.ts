// Integrationstest: Sondierung legt einen Snapshot ab (Schritt 4).
import { execSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { closePool } from '../src/db.js'
import type { FetchLike } from '../src/fetcher.js'
import { runSondierung } from '../src/sondierung.js'
import { latestSnapshots } from '../src/snapshots-repo.js'
import { addSource, listCategories } from '../src/sources-repo.js'

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

let categoryId: string

beforeAll(async () => {
  const env = { ...process.env, DATABASE_URL: testUrl }
  execSync('pnpm --filter @mwp/db migrate', { env, stdio: 'pipe' })
  execSync('pnpm --filter @mwp/db seed', { env, stdio: 'pipe' })
  vi.stubEnv('DATABASE_URL', testUrl)
  const categories = await listCategories()
  categoryId = categories.find((c) => c.slug === 'vitamin-d')!.id
})

afterAll(async () => {
  await closePool()
  vi.unstubAllEnvs()
})

const okFetch: FetchLike = async (url) =>
  url.endsWith('/robots.txt')
    ? new Response('User-agent: *\nAllow: /', { status: 200 })
    : new Response(
        '<html><head><script type="application/ld+json">{"@type":"Product","name":"D3"}</script></head><body>x</body></html>',
        { status: 200 },
      )

describe('runSondierung', () => {
  it('legt einen Snapshot mit extrahiertem JSON-LD ab', async () => {
    const { id } = await addSource(
      categoryId,
      'https://shop.example/sondier-1',
    )
    const payload = await runSondierung(id, 'https://shop.example/sondier-1', {
      fetchImpl: okFetch,
    })
    expect(payload.ok).toBe(true)

    const snap = (await latestSnapshots()).get(id)
    expect(snap?.ok).toBe(true)
    expect(snap?.jsonldCount).toBe(1)
  })

  it('behält den neuesten Snapshot bei erneuter Sondierung', async () => {
    const { id } = await addSource(
      categoryId,
      'https://shop.example/sondier-2',
    )
    await runSondierung(id, 'https://shop.example/sondier-2', {
      fetchImpl: async () => new Response('', { status: 500 }),
    })
    await runSondierung(id, 'https://shop.example/sondier-2', {
      fetchImpl: okFetch,
    })
    const snap = (await latestSnapshots()).get(id)
    expect(snap?.ok).toBe(true) // der zweite (erfolgreiche) Lauf gewinnt
  })
})

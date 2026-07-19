// Integrationstest der Attribut-Sondierung (Schritt 5) mit gemocktem
// Extraktor — kein Netz/keine LLM-API.
import { execSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  listSelectedAttributes,
  listSuggestions,
  setSelectedAttributes,
} from '../src/attribute-suggestions-repo.js'
import { closePool } from '../src/db.js'
import { proposeAttributes } from '../src/discovery.js'
import type { AttributeExtractor } from '../src/llm.js'
import { runSondierung } from '../src/sondierung.js'
import type { FetchLike } from '../src/fetcher.js'
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
  categoryId = (await listCategories()).find((c) => c.slug === 'vitamin-d')!.id
})

afterAll(async () => {
  await closePool()
  vi.unstubAllEnvs()
})

const pageFetch = (html: string): FetchLike => async (url) =>
  url.endsWith('/robots.txt')
    ? new Response('User-agent: *\nAllow: /', { status: 200 })
    : new Response(html, { status: 200 })

// Gemockter Extraktor: liefert feste Attribute je nach Seiteninhalt.
const fakeExtractor: AttributeExtractor = async (text) => {
  const attrs = [
    { key: 'form', label: 'Form', example: 'Tropfen' },
    { key: 'ie_pro_dosis', label: 'IE/Dosis', example: '1000' },
  ]
  if (text.includes('K2')) attrs.push({ key: 'k2', label: 'K2', example: 'MK-7' })
  return attrs
}

describe('proposeAttributes', () => {
  it('aggregiert Attribute über sondierte Quellen und speichert sie', async () => {
    const a = await addSource(categoryId, 'https://shop.example/disc-a')
    const b = await addSource(categoryId, 'https://shop.example/disc-b')
    await runSondierung(a.id, 'https://shop.example/disc-a', {
      fetchImpl: pageFetch('<html><body>Vitamin D3 1000 IE Tropfen</body></html>'),
    })
    await runSondierung(b.id, 'https://shop.example/disc-b', {
      fetchImpl: pageFetch('<html><body>Vitamin D3 + K2 Tropfen</body></html>'),
    })

    const count = await proposeAttributes(categoryId, { extractor: fakeExtractor })
    expect(count).toBe(2)

    const suggestions = await listSuggestions(categoryId)
    const byKey = new Map(suggestions.map((s) => [s.key, s]))
    expect(byKey.get('form')?.occurrences).toBe(2)
    expect(byKey.get('ie_pro_dosis')?.occurrences).toBe(2)
    expect(byKey.get('k2')?.occurrences).toBe(1) // nur auf Quelle b
  })

  it('speichert die bestätigte Attribut-Auswahl (Tor 1)', async () => {
    await setSelectedAttributes(categoryId, ['form', 'ie_pro_dosis'])
    expect(await listSelectedAttributes(categoryId)).toEqual([
      'form',
      'ie_pro_dosis',
    ])
    // erneutes Setzen ersetzt vollständig
    await setSelectedAttributes(categoryId, ['k2'])
    expect(await listSelectedAttributes(categoryId)).toEqual(['k2'])
  })
})

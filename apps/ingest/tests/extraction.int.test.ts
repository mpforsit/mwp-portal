// Integrationstest der Faktenextraktion (Schritt 7) mit gemocktem
// Fakten-Extraktor — kein Netz/keine LLM-API.
import { execSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { setSelectedAttributes } from '../src/attribute-suggestions-repo.js'
import { closePool, getPool } from '../src/db.js'
import { extractForCategory, NoSelectedAttributesError } from '../src/extraction.js'
import { listExtractions } from '../src/extractions-repo.js'
import type { FetchLike } from '../src/fetcher.js'
import type { ExtractedFacts, FactExtractor } from '../src/llm.js'
import { runSondierung } from '../src/sondierung.js'
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
  // eigene Kategorie → isoliert von anderen Testdateien
  const { rows } = await getPool().query(
    `insert into vergleich.categories (slug, name)
     values ('extract-test', 'Extraction-Test') returning id`,
  )
  categoryId = rows[0].id as string
})

afterAll(async () => {
  await closePool()
  vi.unstubAllEnvs()
})

const okFetch: FetchLike = async (url) =>
  url.endsWith('/robots.txt')
    ? new Response('User-agent: *\nAllow: /', { status: 200 })
    : new Response(
        '<html><body>D3 1000, Menge 25 µg pro Tropfen, 9,90 €</body></html>',
        { status: 200 },
      )

const fakeFactExtractor: FactExtractor = async (
  _text,
  keys,
): Promise<ExtractedFacts> => {
  const attributes: ExtractedFacts['attributes'] = {}
  if (keys.includes('dosis')) {
    attributes.dosis = { value: '25 µg', confidence: 0.9, snippet: '25 µg pro Tropfen' }
  }
  if (keys.includes('preis')) {
    attributes.preis = { value: '9,90 €', confidence: 0.8, snippet: '9,90 €' }
  }
  return {
    name: 'D3 1000',
    manufacturer: 'ACME',
    gtin: '4001234567890',
    attributes,
  }
}

describe('extractForCategory', () => {
  it('verlangt bestätigte Attribute (Tor 1)', async () => {
    await setSelectedAttributes(categoryId, [])
    await expect(
      extractForCategory(categoryId, { factExtractor: fakeFactExtractor }),
    ).rejects.toBeInstanceOf(NoSelectedAttributesError)
  })

  it('extrahiert, normalisiert (µg→IE, Preis→Cent) und legt Draft ab', async () => {
    const { id } = await addSource(categoryId, 'https://shop.example/extract-1')
    await runSondierung(id, 'https://shop.example/extract-1', { fetchImpl: okFetch })
    await setSelectedAttributes(categoryId, ['dosis', 'preis'])

    const count = await extractForCategory(categoryId, {
      factExtractor: fakeFactExtractor,
    })
    expect(count).toBeGreaterThanOrEqual(1)

    const row = (await listExtractions(categoryId)).find(
      (r) => r.sourceId === id,
    )
    expect(row?.name).toBe('D3 1000')
    expect(row?.gtin).toBe('4001234567890')
    expect(row?.status).toBe('draft')
    const dosis = row?.attributes.dosis as { ie?: number }
    const preis = row?.attributes.preis as { priceCents?: number }
    expect(dosis?.ie).toBe(1000) // 25 µg × 40
    expect(preis?.priceCents).toBe(990)
    expect(row?.confidence.dosis).toBe(0.9)
  })
})

// Ende-zu-Ende (Schritt 9): erst eine Quelle durch die ganze Kette, dann
// später eine zweite ergänzen — ohne Duplikate. Deckt die inkrementelle
// Arbeitsweise ab (Markt ändert sich, URLs werden nachgepflegt).
import { execSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { setSelectedAttributes } from '../src/attribute-suggestions-repo.js'
import { closePool, getPool } from '../src/db.js'
import { extractForCategory } from '../src/extraction.js'
import { listExtractions, setExtractionStatus } from '../src/extractions-repo.js'
import type { FetchLike } from '../src/fetcher.js'
import type { ExtractedFacts, FactExtractor } from '../src/llm.js'
import { promoteExtraction } from '../src/promote.js'
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
  const { rows } = await getPool().query(
    `insert into vergleich.categories (slug, name)
     values ('incremental-test', 'Incremental-Test') returning id`,
  )
  categoryId = rows[0].id as string
})

afterAll(async () => {
  await closePool()
  vi.unstubAllEnvs()
})

// Seite mit eingebetteter GTIN; Fetch liefert robots + Seite.
const fetchFor = (gtin: string): FetchLike => async (url) =>
  url.endsWith('/robots.txt')
    ? new Response('User-agent: *\nAllow: /', { status: 200 })
    : new Response(`<html><body>GTIN:${gtin} Tropfen</body></html>`, {
        status: 200,
      })

// Fakten-Extraktor liest GTIN/Name aus dem Seitentext (deterministisch).
const fakeExtractor: FactExtractor = async (
  text,
  keys,
): Promise<ExtractedFacts> => {
  const gtin = text.match(/GTIN:(\d+)/)?.[1] ?? null
  const attributes: ExtractedFacts['attributes'] = {}
  if (keys.includes('form')) {
    attributes.form = { value: 'Tropfen', confidence: 0.9, snippet: 'Tropfen' }
  }
  return { name: `Produkt ${gtin}`, manufacturer: 'ACME', gtin, attributes }
}

const productCount = async (): Promise<number> => {
  const { rows } = await getPool().query(
    'select count(*)::int as n from vergleich.products where category_id = $1',
    [categoryId],
  )
  return rows[0].n as number
}

const promoteBySource = async (sourceId: string): Promise<void> => {
  const row = (await listExtractions(categoryId)).find(
    (r) => r.sourceId === sourceId,
  )!
  await setExtractionStatus(row.id, 'approved')
  await promoteExtraction(row.id)
}

describe('inkrementeller Re-Run', () => {
  it('erste Quelle: Kette bis Produkt', async () => {
    const a = await addSource(categoryId, 'https://s.example/inc-a')
    await runSondierung(a.id, 'https://s.example/inc-a', { fetchImpl: fetchFor('7001') })
    await setSelectedAttributes(categoryId, ['form'])
    await extractForCategory(categoryId, { factExtractor: fakeExtractor })
    await promoteBySource(a.id)
    expect(await productCount()).toBe(1)
  })

  it('zweite Quelle später ergänzt — kein Duplikat', async () => {
    // neue URL nachpflegen
    const b = await addSource(categoryId, 'https://s.example/inc-b')
    expect(b.created).toBe(true)
    await runSondierung(b.id, 'https://s.example/inc-b', { fetchImpl: fetchFor('7002') })

    // erneute Extraktion wertet beide Quellen aus (A wird auf draft
    // zurückgesetzt und muss erneut abgenommen werden)
    await extractForCategory(categoryId, { factExtractor: fakeExtractor })

    const aRow = (await listExtractions(categoryId)).find(
      (r) => r.name === 'Produkt 7001',
    )
    expect(aRow?.status).toBe('draft') // re-extrahiert → erneute Abnahme nötig

    // Produkt A bleibt bestehen (Re-Extraktion dupliziert nichts)
    expect(await productCount()).toBe(1)

    // A erneut übernehmen → Dedup über GTIN aktualisiert dasselbe Produkt
    const aSource = (await getPool().query(
      `select s.id from ingest.sources s
       join ingest.extractions e on e.source_id = s.id
       where e.name = 'Produkt 7001'`,
    )).rows[0].id as string
    await promoteBySource(aSource)
    expect(await productCount()).toBe(1)

    // B übernehmen → neues Produkt
    const bSource = (await getPool().query(
      `select s.id from ingest.sources s
       join ingest.extractions e on e.source_id = s.id
       where e.name = 'Produkt 7002'`,
    )).rows[0].id as string
    await promoteBySource(bSource)
    expect(await productCount()).toBe(2)
  })
})

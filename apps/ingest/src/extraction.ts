// Extraktion (Schritt 7): zieht je Quelle die bestätigten Attribut-Keys
// per Fakten-Extraktor, normalisiert deterministisch (µg↔IE, Preis) und
// legt einen Draft in ingest.extractions ab. Extraktor injizierbar.
import { listSelectedAttributes } from './attribute-suggestions-repo.js'
import { snapshotToText } from './discovery.js'
import { upsertExtraction } from './extractions-repo.js'
import type { FactExtractor } from './llm.js'
import { normalizeValue } from './normalize.js'
import { latestContentForCategory } from './snapshots-repo.js'

export interface ExtractionDeps {
  factExtractor: FactExtractor
}

export class NoSelectedAttributesError extends Error {}

export const extractForCategory = async (
  categoryId: string,
  deps: ExtractionDeps,
): Promise<number> => {
  const keys = await listSelectedAttributes(categoryId)
  if (keys.length === 0) {
    throw new NoSelectedAttributesError(
      'Keine Attribute ausgewählt (Tor 1) — erst Attribute bestätigen.',
    )
  }
  const snapshots = await latestContentForCategory(categoryId)
  let count = 0
  for (const snap of snapshots) {
    const text = snapshotToText(snap)
    if (!text) continue
    const facts = await deps.factExtractor(text, keys)

    const attributes: Record<string, unknown> = {}
    const confidence: Record<string, number> = {}
    const provenance: Record<string, unknown> = { _source_url: snap.url }
    for (const [key, field] of Object.entries(facts.attributes)) {
      attributes[key] = normalizeValue(field.value)
      confidence[key] = field.confidence
      provenance[key] = field.snippet
    }

    await upsertExtraction({
      sourceId: snap.sourceId,
      categoryId,
      name: facts.name,
      manufacturer: facts.manufacturer,
      gtin: facts.gtin,
      attributes,
      confidence,
      provenance,
    })
    count += 1
  }
  return count
}

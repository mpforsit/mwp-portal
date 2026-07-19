// Attribut-Sondierung (Schritt 5): baut je Quelle einen Text aus JSON-LD +
// Seitentext, lässt den Extraktor die beobachteten Attribute nennen,
// aggregiert sie und persistiert den Vorschlag. Extraktor injizierbar.
import { parse } from 'node-html-parser'

import { aggregateSuggestions } from './attributes.js'
import type { AttributeExtractor } from './llm.js'
import { replaceSuggestions } from './attribute-suggestions-repo.js'
import { latestContentForCategory, type SnapshotContent } from './snapshots-repo.js'

const MAX_TEXT = 8000

// Verdichtet einen Snapshot zu einem kompakten Text für die Extraktion.
export const snapshotToText = (snap: SnapshotContent): string => {
  const parts: string[] = []
  if (snap.jsonld.length) {
    parts.push('JSON-LD:\n' + JSON.stringify(snap.jsonld))
  }
  if (snap.rawHtml) {
    const text = parse(snap.rawHtml)
      .textContent.replace(/\s+/g, ' ')
      .trim()
    if (text) parts.push('Seitentext:\n' + text)
  }
  return parts.join('\n\n').slice(0, MAX_TEXT)
}

export interface DiscoveryDeps {
  extractor: AttributeExtractor
}

// Sondiert alle aktiven Quellen einer Kategorie und speichert den
// Attribut-Vorschlag. Liefert die Anzahl ausgewerteter Quellen.
export const proposeAttributes = async (
  categoryId: string,
  deps: DiscoveryDeps,
): Promise<number> => {
  const snapshots = await latestContentForCategory(categoryId)
  const perSource = []
  for (const snap of snapshots) {
    const text = snapshotToText(snap)
    if (!text) continue
    perSource.push(await deps.extractor(text))
  }
  await replaceSuggestions(categoryId, aggregateSuggestions(perSource))
  return perSource.length
}

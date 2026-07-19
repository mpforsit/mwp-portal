// Aggregiert die je Quelle beobachteten Attribute zu einem Vorschlag je
// Kategorie: Häufigkeit (in wie vielen Quellen kam der key vor) + Beispiele.
// Reine Funktion (gut testbar), keine Seiteneffekte.
import type { ObservedAttribute } from './llm.js'

export interface AttributeSuggestion {
  key: string
  label: string
  occurrences: number
  examples: string[]
}

const MAX_EXAMPLES = 5

export const aggregateSuggestions = (
  perSource: ObservedAttribute[][],
): AttributeSuggestion[] => {
  const map = new Map<string, AttributeSuggestion>()
  for (const attrs of perSource) {
    // pro Quelle jeden key nur einmal zählen
    const seen = new Set<string>()
    for (const attr of attrs) {
      if (seen.has(attr.key)) continue
      seen.add(attr.key)
      const existing = map.get(attr.key)
      if (existing) {
        existing.occurrences += 1
        if (attr.example && existing.examples.length < MAX_EXAMPLES) {
          existing.examples.push(attr.example)
        }
      } else {
        map.set(attr.key, {
          key: attr.key,
          label: attr.label,
          occurrences: 1,
          examples: attr.example ? [attr.example] : [],
        })
      }
    }
  }
  // häufigste zuerst
  return [...map.values()].sort((a, b) => b.occurrences - a.occurrences)
}

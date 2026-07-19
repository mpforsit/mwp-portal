// Unit-Test der Attribut-Aggregation (rein, kein DB/Netz).
import { describe, expect, it } from 'vitest'

import { aggregateSuggestions } from '../src/attributes.js'
import { parseAttributes } from '../src/llm.js'

describe('aggregateSuggestions', () => {
  it('zählt je Quelle einmal und sortiert nach Häufigkeit', () => {
    const result = aggregateSuggestions([
      [
        { key: 'ie_pro_dosis', label: 'IE/Dosis', example: '1000' },
        { key: 'form', label: 'Form', example: 'Tropfen' },
        { key: 'ie_pro_dosis', label: 'IE/Dosis', example: 'dublette' }, // zählt nicht doppelt
      ],
      [{ key: 'ie_pro_dosis', label: 'IE/Dosis', example: '2000' }],
    ])
    expect(result[0]?.key).toBe('ie_pro_dosis')
    expect(result[0]?.occurrences).toBe(2)
    expect(result[0]?.examples).toEqual(['1000', '2000'])
    expect(result.find((r) => r.key === 'form')?.occurrences).toBe(1)
  })

  it('leere Eingabe → leeres Ergebnis', () => {
    expect(aggregateSuggestions([])).toEqual([])
  })
})

describe('parseAttributes (JSON-Toleranz)', () => {
  it('liest JSON mit Codefence', () => {
    const out = parseAttributes(
      '```json\n{"attributes":[{"key":"form","label":"Form","example":"Tropfen"}]}\n```',
    )
    expect(out).toEqual([{ key: 'form', label: 'Form', example: 'Tropfen' }])
  })

  it('kaputtes JSON → leer', () => {
    expect(parseAttributes('kein json')).toEqual([])
  })
})

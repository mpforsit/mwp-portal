// Unit-Tests der deterministischen Normalisierung (kein LLM).
import { describe, expect, it } from 'vitest'

import { normalizeValue, parseNumber } from '../src/normalize.js'
import { parseFacts } from '../src/llm.js'

describe('parseNumber', () => {
  it('deutsche Dezimalzahl', () => {
    expect(parseNumber('9,90 €')).toBe(9.9)
    expect(parseNumber('1.234,56')).toBe(1234.56)
  })
  it('englische Dezimalzahl', () => {
    expect(parseNumber('$9.90')).toBe(9.9)
  })
  it('Ganzzahl mit Tausenderpunkt', () => {
    expect(parseNumber('50.000 IE')).toBe(50000)
  })
  it('keine Zahl → null', () => {
    expect(parseNumber('keine')).toBeNull()
  })
})

describe('normalizeValue', () => {
  it('µg → IE (Vitamin D, ×40)', () => {
    const v = normalizeValue('25 µg')
    expect(v.num).toBe(25)
    expect(v.unit).toBe('µg')
    expect(v.ie).toBe(1000)
  })
  it('IE bleibt IE (keine Ableitung)', () => {
    const v = normalizeValue('1000 IE')
    expect(v.unit).toBe('ie')
    expect(v.ie).toBeNull()
  })
  it('Preis → Cent', () => {
    const v = normalizeValue('9,90 €')
    expect(v.priceCents).toBe(990)
  })
})

describe('parseFacts', () => {
  it('behält nur erlaubte Keys, clampt confidence, liest name/gtin', () => {
    const facts = parseFacts(
      '```json\n{"name":"D3 1000","manufacturer":"ACME","gtin":"400123",' +
        '"attributes":{"form":{"value":"Tropfen","confidence":1.5,"snippet":"..."},' +
        '"verboten":{"value":"x","confidence":0.5,"snippet":""}}}\n```',
      ['form'],
    )
    expect(facts.name).toBe('D3 1000')
    expect(facts.gtin).toBe('400123')
    expect(facts.attributes.form?.confidence).toBe(1) // geclampt auf 1
    expect(facts.attributes.verboten).toBeUndefined() // nicht erlaubt
  })
})

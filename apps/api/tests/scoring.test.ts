// Tests für die Scoring-Logik (Schritt 2.2): Property-based Tests
// (fast-check) für die Band-Logik plus der Beispieltest, der die
// 86.50 aus dem Artefakt-Seed reproduziert.
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  evaluate,
  scoreCriterion,
  ScoringError,
  type Band,
  type Criterion,
} from '../src/scoring.js'

const bandCriterion = (bands: Band[]): Criterion => ({
  key: 'test',
  weight: 100,
  scoring: { bands },
})

// Generator: aufsteigende, eindeutige max-Werte + Fallback ohne max
const bandsArb = fc
  .record({
    maxes: fc
      .uniqueArray(fc.integer({ min: -1000, max: 1000 }), {
        minLength: 1,
        maxLength: 6,
      })
      .map((a) => [...a].sort((x, y) => x - y)),
    points: fc.array(fc.integer({ min: 0, max: 10 }), {
      minLength: 7,
      maxLength: 7,
    }),
  })
  .map(({ maxes, points }) => {
    const bands: Band[] = maxes.map((max, i) => ({
      max,
      points: points[i] as number,
    }))
    bands.push({ points: points[6] as number }) // Fallback
    return bands
  })

describe('Band-Logik (property-based)', () => {
  it('es greift immer die ERSTE Band mit raw <= max', () => {
    fc.assert(
      fc.property(
        bandsArb,
        fc.integer({ min: -2000, max: 2000 }),
        (bands, raw) => {
          const result = scoreCriterion(bandCriterion(bands), raw)
          const firstMatch = bands.find(
            (b) => b.max !== undefined && raw <= b.max,
          )
          const expected = firstMatch ?? bands[bands.length - 1]
          expect(result).toBe(expected?.points)
        },
      ),
    )
  })

  it('raw oberhalb aller maxes fällt auf die Fallback-Band', () => {
    fc.assert(
      fc.property(bandsArb, (bands) => {
        const highestMax = Math.max(
          ...bands.filter((b) => b.max !== undefined).map((b) => b.max as number),
        )
        const result = scoreCriterion(bandCriterion(bands), highestMax + 1)
        expect(result).toBe(bands[bands.length - 1]?.points)
      }),
    )
  })

  it('exakt raw === max gehört noch zur Band (<=)', () => {
    fc.assert(
      fc.property(bandsArb, (bands) => {
        const first = bands[0] as Required<Band>
        expect(scoreCriterion(bandCriterion(bands), first.max)).toBe(
          first.points,
        )
      }),
    )
  })

  it('ohne Fallback: Rohwert oberhalb aller Bands wirft ScoringError', () => {
    const bands: Band[] = [{ max: 10, points: 5 }]
    expect(() => scoreCriterion(bandCriterion(bands), 11)).toThrow(
      ScoringError,
    )
  })

  it('nicht-numerischer Rohwert für bands wirft ScoringError', () => {
    expect(() =>
      scoreCriterion(bandCriterion([{ points: 1 }]), 'text'),
    ).toThrow(ScoringError)
  })
})

describe('map-Logik', () => {
  const mapCriterion: Criterion = {
    key: 'form',
    weight: 10,
    scoring: { map: { tropfen: 10, kapsel: 6 } },
  }

  it('direkter Lookup', () => {
    expect(scoreCriterion(mapCriterion, 'tropfen')).toBe(10)
  })

  it('unbekannter Wert wirft ScoringError mit erlaubten Werten', () => {
    expect(() => scoreCriterion(mapCriterion, 'pulver')).toThrow(
      /erlaubt: tropfen, kapsel/,
    )
  })
})

describe('evaluate (Artefakt-Seed)', () => {
  // criteria-JSONB der Methodik v1 aus
  // docs/artefakte/vergleichs-engine-schema.sql
  const criteriaV1: Criterion[] = [
    {
      key: 'micro_dosing',
      direction: 'lower_better',
      weight: 20,
      scoring: {
        bands: [
          { max: 500, points: 10 },
          { max: 1000, points: 7 },
          { max: 5000, points: 4 },
          { points: 1 },
        ],
      },
    },
    { key: 'form', weight: 10, scoring: { map: { tropfen: 10, spray: 8, kapsel: 6, tablette: 4 } } },
    { key: 'k2_combo', weight: 15, scoring: { map: { mk7_all_trans: 10, mk7_cis_trans: 5, mk4: 3, none: 0 } } },
    { key: 'carrier', weight: 10, scoring: { map: { mct: 10, olivenoel: 8, sonnenblumenoel: 5, keins: 3 } } },
    {
      key: 'price_per_1000ie',
      direction: 'lower_better',
      weight: 25,
      scoring: {
        bands: [
          { max: 0.3, points: 10 },
          { max: 0.6, points: 7 },
          { max: 1.0, points: 4 },
          { points: 1 },
        ],
      },
    },
    { key: 'third_party_cert', weight: 20, scoring: { map: { public_per_batch: 10, on_request: 6, none: 0 } } },
  ]

  it('reproduziert die 86.50 aus dem Seed', () => {
    const { scores, totalScore } = evaluate(criteriaV1, {
      micro_dosing: 1000,
      form: 'tropfen',
      k2_combo: 'mk7_all_trans',
      carrier: 'mct',
      price_per_1000ie: 0.42,
      third_party_cert: 'public_per_batch',
    })
    expect(totalScore).toBe(86.5)
    expect(scores.micro_dosing?.points).toBe(7)
    expect(scores.price_per_1000ie?.points).toBe(7)
  })

  it('fehlende Rohwerte werden benannt', () => {
    expect(() => evaluate(criteriaV1, { form: 'tropfen' })).toThrow(
      /micro_dosing/,
    )
  })
})

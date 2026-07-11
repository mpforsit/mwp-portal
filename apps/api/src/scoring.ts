// Scoring-Service (Schritt 2.2) — reine Logik, keine IO.
// Die scoring-Definition im criteria-JSONB ist die Spezifikation
// (CLAUDE.md); dieses Modul implementiert sie:
// - bands: die ERSTE Band mit raw <= max greift; die letzte Band ohne
//   max ist der Fallback.
// - map: direkter Lookup über den Rohwert (String).
// - direction (z. B. lower_better) ist Dokumentation der Richtung —
//   sie wird NICHT zusätzlich angewendet, die bands/map-Definition
//   ist bereits gerichtet.
// - total_score = Summe über (points/10 * weight).

export type Band = { max?: number; points: number }

export type Criterion = {
  key: string
  label?: string
  type?: string
  unit?: string
  direction?: string
  weight: number
  scoring: { bands?: Band[]; map?: Record<string, number> }
}

export type ScoreEntry = { raw: string | number; points: number; note?: string }

export type EvaluationResult = {
  scores: Record<string, ScoreEntry>
  totalScore: number
}

export class ScoringError extends Error {}

export const scoreCriterion = (
  criterion: Criterion,
  raw: unknown,
): number => {
  const { bands, map } = criterion.scoring

  if (bands) {
    if (typeof raw !== 'number' || Number.isNaN(raw)) {
      throw new ScoringError(
        `Kriterium ${criterion.key}: numerischer Rohwert erwartet.`,
      )
    }
    for (const band of bands) {
      if (band.max !== undefined && raw <= band.max) return band.points
    }
    const fallback = bands.find((b) => b.max === undefined)
    if (fallback) return fallback.points
    throw new ScoringError(
      `Kriterium ${criterion.key}: kein Band für Rohwert ${raw} und kein Fallback.`,
    )
  }

  if (map) {
    if (typeof raw !== 'string') {
      throw new ScoringError(
        `Kriterium ${criterion.key}: String-Rohwert erwartet.`,
      )
    }
    const points = map[raw]
    if (points === undefined) {
      throw new ScoringError(
        `Kriterium ${criterion.key}: unbekannter Wert "${raw}" (erlaubt: ${Object.keys(map).join(', ')}).`,
      )
    }
    return points
  }

  throw new ScoringError(
    `Kriterium ${criterion.key}: scoring braucht bands oder map.`,
  )
}

export const evaluate = (
  criteria: Criterion[],
  raws: Record<string, unknown>,
  notes: Record<string, string> = {},
): EvaluationResult => {
  const missing = criteria
    .map((c) => c.key)
    .filter((key) => raws[key] === undefined)
  if (missing.length > 0) {
    throw new ScoringError(`Rohwerte fehlen für: ${missing.join(', ')}`)
  }

  const scores: Record<string, ScoreEntry> = {}
  let total = 0
  for (const criterion of criteria) {
    const raw = raws[criterion.key] as string | number
    const points = scoreCriterion(criterion, raw)
    scores[criterion.key] = {
      raw,
      points,
      ...(notes[criterion.key] ? { note: notes[criterion.key] } : {}),
    }
    total += (points / 10) * criterion.weight
  }

  return { scores, totalScore: Math.round(total * 100) / 100 }
}

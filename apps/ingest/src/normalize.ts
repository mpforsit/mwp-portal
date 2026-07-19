// Deterministische Normalisierung roher Fakten-Werte (kein LLM). Erkennt
// Zahl + Einheit (deutsche & englische Schreibweise), leitet IE aus µg ab
// (Vitamin D: 1 µg = 40 IE) und Preise in Cent ab. Rein & getestet.

export interface NormalizedValue {
  raw: string
  num: number | null // erkannte Zahl
  unit: string | null // normalisierte Einheit (µg, mg, g, ie, ml, eur, …)
  ie: number | null // aus µg abgeleitete IE, falls zutreffend
  priceCents: number | null // falls ein Preis erkannt wurde
}

// "1.234,56" → 1234.56 ; "9,90" → 9.9 ; "1,000" → 1000 (Tausender) ;
// "9.90" → 9.9. Heuristik: letztes , oder . mit 1–2 Nachkommastellen ist
// das Dezimaltrennzeichen; übrige Trenner sind Tausender.
export const parseNumber = (input: string): number | null => {
  const m = input.match(/-?\d[\d.,]*\d|-?\d/)
  if (!m) return null
  const token = m[0]
  const lastComma = token.lastIndexOf(',')
  const lastDot = token.lastIndexOf('.')
  const decPos = Math.max(lastComma, lastDot)
  let intPart: string
  let fracPart = ''
  if (decPos !== -1 && token.length - decPos - 1 <= 2) {
    intPart = token.slice(0, decPos)
    fracPart = token.slice(decPos + 1)
  } else {
    intPart = token
  }
  const digits = intPart.replace(/[.,]/g, '')
  const value = Number(fracPart ? `${digits}.${fracPart}` : digits)
  return Number.isFinite(value) ? value : null
}

const UNIT_PATTERNS: { re: RegExp; unit: string }[] = [
  { re: /µg|mcg|mikrogramm/i, unit: 'µg' },
  { re: /\bmg\b|milligramm/i, unit: 'mg' },
  { re: /\bg\b|gramm/i, unit: 'g' },
  { re: /\bi\.?e\.?\b|\biu\b|internationale einheiten/i, unit: 'ie' },
  { re: /\bml\b|milliliter/i, unit: 'ml' },
  { re: /€|eur\b|euro/i, unit: 'eur' },
]

const detectUnit = (raw: string): string | null => {
  for (const { re, unit } of UNIT_PATTERNS) if (re.test(raw)) return unit
  return null
}

export const MCG_TO_IE_VITAMIN_D = 40

export const normalizeValue = (raw: string): NormalizedValue => {
  const num = parseNumber(raw)
  const unit = detectUnit(raw)
  return {
    raw,
    num,
    unit,
    ie: unit === 'µg' && num !== null ? Math.round(num * MCG_TO_IE_VITAMIN_D) : null,
    priceCents: unit === 'eur' && num !== null ? Math.round(num * 100) : null,
  }
}

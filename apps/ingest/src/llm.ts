// LLM-gestützte Sichtung: liest den Text einer Produktseite und nennt die
// darin beobachteten HARTEN Fakten-Attribute (keine Wertung, kein Marketing).
// Der Extraktor ist injizierbar, damit Tests ohne Netz/API laufen.
import Anthropic from '@anthropic-ai/sdk'

export interface ObservedAttribute {
  key: string // snake_case, englisch (Identifier)
  label: string // deutsches UI-Label
  example: string // beobachteter Beispielwert als Text
}

export type AttributeExtractor = (text: string) => Promise<ObservedAttribute[]>

const SYSTEM = `Du extrahierst harte, faktische Produkteigenschaften aus dem Text einer Produktseite.
Nur objektive Fakten (z. B. Wirkstoffmenge, Darreichungsform, Inhaltsstoffe, Preis, Zertifikate,
Menge/Gebinde). KEINE Werbeaussagen, KEINE Wertungen, KEINE Empfehlungen.
Antworte ausschließlich als JSON, ohne weiteren Text, in dieser Form:
{"attributes":[{"key":"snake_case_englisch","label":"Deutsches Label","example":"beobachteter Wert"}]}`

// Entfernt ```-Codefences und parst das Attribut-Array tolerant.
export const parseAttributes = (raw: string): ObservedAttribute[] => {
  const text = raw.replace(/^```(?:json)?/i, '').replace(/```$/,'').trim()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  const list = (data as { attributes?: unknown }).attributes
  if (!Array.isArray(list)) return []
  const out: ObservedAttribute[] = []
  for (const item of list) {
    const rec = item as Record<string, unknown>
    const key = typeof rec.key === 'string' ? rec.key.trim() : ''
    if (!key) continue
    out.push({
      key,
      label: typeof rec.label === 'string' && rec.label ? rec.label : key,
      example: typeof rec.example === 'string' ? rec.example : '',
    })
  }
  return out
}

// Baut den echten Extraktor auf Basis der Anthropic-API. Wirft, wenn kein
// API-Key gesetzt ist (Extraktion ist dann deaktiviert).
export const createExtractor = (): AttributeExtractor => {
  const client = requireClient()
  return async (text: string): Promise<ObservedAttribute[]> => {
    const joined = await complete(client, SYSTEM, text)
    return parseAttributes(joined)
  }
}

// --- Schritt 7: gezielte Faktenextraktion gegen bestätigte Keys ----------

export interface ExtractedField {
  value: string // beobachteter Rohwert (Einheiten wie auf der Seite)
  confidence: number // 0..1
  snippet: string // Textbeleg (Provenienz)
}

export interface ExtractedFacts {
  name: string | null
  manufacturer: string | null
  gtin: string | null
  attributes: Record<string, ExtractedField>
}

export type FactExtractor = (
  text: string,
  keys: string[],
) => Promise<ExtractedFacts>

const factsSystem = (keys: string[]): string =>
  `Extrahiere aus dem Text einer Produktseite NUR harte Fakten. Ziehe genau diese Attribute,
falls vorhanden: ${keys.join(', ')}. Zusätzlich name, manufacturer, gtin.
Werte wörtlich wie auf der Seite (inkl. Einheiten). Keine Wertung, kein Marketing, nichts erfinden.
Für jedes gefundene Attribut: value (Rohwert), confidence (0..1), snippet (kurzer Textbeleg).
Fehlt ein Attribut, lass es weg. Antworte ausschließlich als JSON:
{"name":"","manufacturer":"","gtin":"","attributes":{"<key>":{"value":"","confidence":0.9,"snippet":""}}}`

const clamp01 = (n: unknown): number => {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

const strOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

// Parst die Fakten-Antwort tolerant; behält nur erlaubte Keys.
export const parseFacts = (raw: string, keys: string[]): ExtractedFacts => {
  const allowed = new Set(keys)
  const empty: ExtractedFacts = {
    name: null,
    manufacturer: null,
    gtin: null,
    attributes: {},
  }
  const text = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return empty
  }
  const rec = data as Record<string, unknown>
  const attributes: Record<string, ExtractedField> = {}
  const rawAttrs = (rec.attributes ?? {}) as Record<string, unknown>
  for (const [key, val] of Object.entries(rawAttrs)) {
    if (!allowed.has(key)) continue
    const field = val as Record<string, unknown>
    const value = typeof field.value === 'string' ? field.value.trim() : ''
    if (!value) continue
    attributes[key] = {
      value,
      confidence: clamp01(field.confidence),
      snippet: typeof field.snippet === 'string' ? field.snippet : '',
    }
  }
  return {
    name: strOrNull(rec.name),
    manufacturer: strOrNull(rec.manufacturer),
    gtin: strOrNull(rec.gtin),
    attributes,
  }
}

export const createFactExtractor = (): FactExtractor => {
  const client = requireClient()
  return async (text: string, keys: string[]): Promise<ExtractedFacts> => {
    const joined = await complete(client, factsSystem(keys), text)
    return parseFacts(joined, keys)
  }
}

// --- gemeinsame API-Helfer ----------------------------------------------

const requireClient = (): Anthropic => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY ist nicht gesetzt — LLM-Extraktion deaktiviert.',
    )
  }
  return new Anthropic()
}

const complete = async (
  client: Anthropic,
  system: string,
  content: string,
): Promise<string> => {
  const res = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content }],
  })
  let joined = ''
  for (const block of res.content) {
    if (block.type === 'text') joined += block.text
  }
  return joined
}

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
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY ist nicht gesetzt — LLM-Extraktion deaktiviert.')
  }
  const client = new Anthropic()
  return async (text: string): Promise<ObservedAttribute[]> => {
    const res = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: text }],
    })
    let joined = ''
    for (const block of res.content) {
      if (block.type === 'text') joined += block.text
    }
    return parseAttributes(joined)
  }
}

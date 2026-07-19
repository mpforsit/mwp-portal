// Abruf einer Produktseite: robots.txt-Prüfung, ehrlicher User-Agent,
// Timeout, JSON-LD-Extraktion, Content-Hash. Reine Extraktion; kein
// DB-Zugriff (die Persistenz macht snapshots-repo). fetch ist
// injizierbar, damit Tests ohne Netz laufen.
import { createHash } from 'node:crypto'
import { parse } from 'node-html-parser'

import { isAllowed } from './robots.js'

const UA_TOKEN = 'mywellingestbot'
export const USER_AGENT = 'myWellIngestBot/1.0 (+https://my-well.com)'

export interface SnapshotPayload {
  httpStatus: number | null
  ok: boolean
  error: string | null
  contentHash: string | null
  rawHtml: string | null
  jsonld: unknown[]
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface FetchDeps {
  fetchImpl?: FetchLike
  timeoutMs?: number
}

// Alle <script type="application/ld+json">-Blöcke als geparste Objekte.
// Defekte Blöcke werden übersprungen (Deserialisierungs-Grenze).
export const extractJsonLd = (html: string): unknown[] => {
  const root = parse(html)
  const out: unknown[] = []
  for (const node of root.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    const text = node.textContent.trim()
    if (!text) continue
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) out.push(...parsed)
      else out.push(parsed)
    } catch {
      // ungültiges JSON-LD ignorieren
    }
  }
  return out
}

const withTimeout = async (
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
      signal: controller.signal,
      redirect: 'follow',
    })
  } finally {
    clearTimeout(timer)
  }
}

// Sondiert eine URL und liefert die Snapshot-Nutzlast. Wirft nicht;
// Fehler landen als ok=false + error, damit ein Lauf durchläuft.
export const sondiereSource = async (
  url: string,
  deps: FetchDeps = {},
): Promise<SnapshotPayload> => {
  const fetchImpl = deps.fetchImpl ?? (fetch as FetchLike)
  const timeoutMs = deps.timeoutMs ?? 15_000
  const empty: SnapshotPayload = {
    httpStatus: null,
    ok: false,
    error: null,
    contentHash: null,
    rawHtml: null,
    jsonld: [],
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return { ...empty, error: 'Ungültige URL.' }
  }

  // robots.txt: fehlt sie / ist nicht abrufbar, gilt "erlaubt".
  try {
    const robotsRes = await withTimeout(
      fetchImpl,
      `${parsedUrl.origin}/robots.txt`,
      timeoutMs,
    )
    if (robotsRes.ok) {
      const robotsTxt = await robotsRes.text()
      if (!isAllowed(robotsTxt, UA_TOKEN, parsedUrl.pathname)) {
        return { ...empty, error: 'robots.txt: Abruf nicht erlaubt.' }
      }
    }
  } catch {
    // robots nicht erreichbar → als erlaubt behandeln
  }

  try {
    const res = await withTimeout(fetchImpl, url, timeoutMs)
    const body = await res.text()
    return {
      httpStatus: res.status,
      ok: res.ok,
      error: res.ok ? null : `HTTP ${res.status}`,
      contentHash: createHash('sha256').update(body).digest('hex'),
      rawHtml: body,
      jsonld: extractJsonLd(body),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ...empty, error: `Abruf fehlgeschlagen: ${message}` }
  }
}

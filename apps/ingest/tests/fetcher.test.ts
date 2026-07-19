// Unit-Tests (kein Netz, kein DB): JSON-LD-Extraktion, robots-Prüfung,
// Sondierung mit injiziertem fetch.
import { describe, expect, it, vi } from 'vitest'

import { extractJsonLd, sondiereSource, type FetchLike } from '../src/fetcher.js'
import { isAllowed } from '../src/robots.js'

const html = (scripts: string[]): string =>
  `<html><head>${scripts
    .map((s) => `<script type="application/ld+json">${s}</script>`)
    .join('')}</head><body>x</body></html>`

describe('extractJsonLd', () => {
  it('liest gültige Blöcke, flacht Arrays, überspringt kaputte', () => {
    const out = extractJsonLd(
      html([
        '{"@type":"Product","name":"D3 1000"}',
        '[{"@type":"Offer","price":"9.90"}]',
        '{ kaputt',
      ]),
    )
    expect(out).toHaveLength(2)
    expect((out[0] as { name: string }).name).toBe('D3 1000')
  })

  it('leeres Ergebnis ohne JSON-LD', () => {
    expect(extractJsonLd('<html><body>nichts</body></html>')).toEqual([])
  })
})

describe('isAllowed', () => {
  const robots = 'User-agent: *\nDisallow: /private\nAllow: /private/ok'
  it('sperrt gesperrte Pfade', () => {
    expect(isAllowed(robots, 'mywellingestbot', '/private/x')).toBe(false)
  })
  it('erlaubt spezifischeres Allow', () => {
    expect(isAllowed(robots, 'mywellingestbot', '/private/ok')).toBe(true)
  })
  it('erlaubt nicht erwähnte Pfade', () => {
    expect(isAllowed(robots, 'mywellingestbot', '/produkt/d3')).toBe(true)
  })
  it('leeres Disallow sperrt nichts', () => {
    expect(isAllowed('User-agent: *\nDisallow:', 'x', '/beliebig')).toBe(true)
  })
})

describe('sondiereSource', () => {
  it('liefert ok + JSON-LD, wenn robots erlaubt', async () => {
    const page = html(['{"@type":"Product","name":"D3 2000"}'])
    const fetchImpl: FetchLike = async (url) =>
      url.endsWith('/robots.txt')
        ? new Response('User-agent: *\nAllow: /', { status: 200 })
        : new Response(page, { status: 200 })

    const res = await sondiereSource('https://shop.example/d3', { fetchImpl })
    expect(res.ok).toBe(true)
    expect(res.httpStatus).toBe(200)
    expect(res.jsonld).toHaveLength(1)
    expect(res.contentHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('respektiert robots-Disallow und ruft die Seite nicht ab', async () => {
    const pageFetch = vi.fn()
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt'))
        return new Response('User-agent: *\nDisallow: /', { status: 200 })
      pageFetch()
      return new Response('sollte nicht passieren', { status: 200 })
    }
    const res = await sondiereSource('https://shop.example/gesperrt', {
      fetchImpl,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/robots/i)
    expect(pageFetch).not.toHaveBeenCalled()
  })

  it('fängt Netzwerkfehler als ok=false ab', async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith('/robots.txt'))
        return new Response('', { status: 404 })
      throw new Error('ECONNREFUSED')
    }
    const res = await sondiereSource('https://shop.example/d3', { fetchImpl })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/fehlgeschlagen/i)
  })
})

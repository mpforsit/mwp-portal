// IndexNow-Schlüsseldatei (Schritt 1.9): Bing verlangt eine Datei
// /<key>.txt mit dem Schlüssel als Inhalt. Der Key kommt aus dem
// Environment; ohne Key wird keine Datei gebaut.
import type { APIRoute } from 'astro'

export function getStaticPaths() {
  const key = import.meta.env.INDEXNOW_KEY as string | undefined
  return key ? [{ params: { indexnowKey: key } }] : []
}

export const GET: APIRoute = ({ params }) =>
  new Response(params.indexnowKey ?? '', {
    headers: { 'content-type': 'text/plain' },
  })

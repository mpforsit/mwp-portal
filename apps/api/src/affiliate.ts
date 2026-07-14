// Affiliate-Redirects (Schritt 2.5): /go/[linkId] → 302 auf die
// Ziel-URL. Klick-Event nur mit linkId + Zeitstempel + Referrer-PFAD
// (keine Nutzerdaten). Deaktivierte Links → 410 mit Hinweis.
import type { FastifyInstance } from 'fastify'

import { getPool } from './db.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Nur der Pfad des Referrers wird gespeichert — keine Query-Parameter,
// kein Host-übergreifendes Tracking
export const referrerPath = (referer: string | undefined): string | null => {
  if (!referer) return null
  try {
    return new URL(referer).pathname
  } catch {
    return null
  }
}

const gonePage = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Link nicht mehr aktiv</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:15vh auto;padding:0 1rem;line-height:1.6}</style>
</head><body>
<h1>Dieser Link ist nicht mehr aktiv</h1>
<p>Das Angebot wurde beendet oder der Anbieter hat sich geändert.
Die aktuelle Übersicht steht im <a href="/vergleich/">Vergleich</a>.</p>
</body></html>`

export const registerAffiliateRoutes = (app: FastifyInstance): void => {
  app.get<{ Params: { linkId: string } }>('/go/:linkId', async (req, reply) => {
    if (!UUID_PATTERN.test(req.params.linkId)) {
      return reply.status(404).send('Unbekannter Link.')
    }
    const { rows } = await getPool().query(
      'select url, active from vergleich.affiliate_links where id = $1',
      [req.params.linkId],
    )
    if (!rows[0]) {
      return reply.status(404).send('Unbekannter Link.')
    }
    if (!rows[0].active) {
      return reply.status(410).type('text/html').send(gonePage)
    }

    // Klick zählen — Fehler dürfen den Redirect nie blockieren
    try {
      await getPool().query(
        `insert into vergleich.affiliate_clicks (link_id, referrer_path)
         values ($1, $2)`,
        [req.params.linkId, referrerPath(req.headers.referer)],
      )
    } catch (err) {
      req.log.warn({ err }, 'Affiliate-Klick konnte nicht gezählt werden.')
    }

    return reply.redirect(rows[0].url, 302)
  })
}

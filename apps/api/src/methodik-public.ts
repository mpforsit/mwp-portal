// Öffentliche Methodik-Endpoints (Schritt 2.6): alle nicht-draft-
// Versionen einer Kategorie. methodology_md kommt direkt aus der DB —
// die "So testen wir"-Seite rendert aus derselben Quelle wie das
// Scoring, Doku und Realität können nicht auseinanderlaufen.
import type { FastifyInstance } from 'fastify'

import { getPool } from './db.js'
import type { Criterion } from './scoring.js'

export type MethodologyVersion = {
  version: number
  status: 'active' | 'retired'
  activatedAt: string | null
  createdAt: string
  methodologyMd: string
  criteria: Criterion[]
}

export type MethodologyResponse = {
  category: { slug: string; name: string }
  versions: MethodologyVersion[]
}

export const registerMethodikPublic = (app: FastifyInstance): void => {
  app.get<{ Params: { slug: string } }>(
    '/api/methodik/:slug',
    async (req, reply) => {
      const pool = getPool()
      const cat = await pool.query(
        'select id, slug, name from vergleich.categories where slug = $1',
        [req.params.slug],
      )
      if (!cat.rowCount) {
        return reply.status(404).send({ message: 'Kategorie unbekannt.' })
      }
      const versions = await pool.query(
        `select version, status, activated_at, created_at,
                methodology_md, criteria
         from vergleich.criteria_schemas
         where category_id = $1 and status in ('active','retired')
         order by version desc`,
        [cat.rows[0].id],
      )
      if (!versions.rowCount) {
        return reply
          .status(404)
          .send({ message: 'Keine veröffentlichte Methodik.' })
      }
      const response: MethodologyResponse = {
        category: { slug: cat.rows[0].slug, name: cat.rows[0].name },
        versions: versions.rows.map((v) => ({
          version: v.version,
          status: v.status,
          activatedAt: v.activated_at,
          createdAt: v.created_at,
          methodologyMd: v.methodology_md,
          // criteria-JSONB aus der DB: markierte Deserialisierungs-Grenze
          criteria: v.criteria as Criterion[],
        })),
      }
      return reply.send(response)
    },
  )
}

// Öffentliche Lese-Endpoints der Vergleichs-Engine (Schritt 2.4):
// liefern dem Frontend-Build alles für /vergleich/[kategorie]/.
// Nur publizierte Daten aus current_ranking; Affiliate-Links ohne
// Provisionshöhen (Entkopplung: die Vergütung bleibt intern).
import type { FastifyInstance } from 'fastify'

import { getPool } from './db.js'
import type { Criterion } from './scoring.js'

export type ComparisonCategory = {
  slug: string
  name: string
  description: string | null
}

export type ComparisonCriterion = {
  key: string
  label: string
  weight: number
  unit: string | null
  direction: string | null
}

export type ComparisonMethodology = {
  version: number
  activatedAt: string | null
  criteria: ComparisonCriterion[]
}

export type ComparisonResponse = {
  category: ComparisonCategory
  methodology: ComparisonMethodology
  products: ComparisonProduct[]
}

export type ComparisonProduct = {
  id: string
  slug: string
  name: string
  manufacturer: string
  gtin: string | null
  attributes: Record<string, unknown>
  rank: number
  totalScore: number
  evaluatedAt: string
  summary: string | null
  scores: Record<string, { raw: unknown; points: number; note?: string }>
  affiliateLinks: { id: string; partner: string }[]
  price: {
    cents: number
    currency: string
    unitAmount: number | null
    unit: string | null
    capturedAt: string
  } | null
}

export const registerVergleichPublic = (app: FastifyInstance): void => {
  // Kategorien, die ein publiziertes Ranking haben
  app.get('/api/vergleich', async (_req, reply) => {
    const { rows } = await getPool().query(
      `select distinct c.slug, c.name, c.description
       from vergleich.current_ranking r
       join vergleich.categories c on c.id = r.category_id
       order by c.name`,
    )
    return reply.send({ categories: rows })
  })

  app.get<{ Params: { slug: string } }>(
    '/api/vergleich/:slug',
    async (req, reply) => {
      const pool = getPool()
      const cat = await pool.query(
        'select id, slug, name, description from vergleich.categories where slug = $1',
        [req.params.slug],
      )
      if (!cat.rowCount) {
        return reply.status(404).send({ message: 'Kategorie unbekannt.' })
      }
      const category = cat.rows[0]

      const schema = await pool.query(
        `select version, criteria, activated_at
         from vergleich.criteria_schemas
         where category_id = $1 and status = 'active'`,
        [category.id],
      )
      if (!schema.rowCount) {
        return reply
          .status(404)
          .send({ message: 'Kein aktives Bewertungsschema.' })
      }
      // criteria-JSONB aus der DB: markierte Deserialisierungs-Grenze
      const criteria = schema.rows[0].criteria as Criterion[]

      const products = await pool.query(
        `select
           p.id, p.slug, p.name, p.manufacturer, p.gtin, p.attributes,
           r.rank, r.total_score,
           e.evaluated_at, e.summary, e.scores
         from vergleich.current_ranking r
         join vergleich.products p on p.id = r.product_id
         join vergleich.product_evaluations e on e.id = r.evaluation_id
         where r.category_id = $1
         order by r.rank`,
        [category.id],
      )

      const links = await pool.query(
        `select al.id, al.product_id, ap.name as partner
         from vergleich.affiliate_links al
         join vergleich.affiliate_partners ap on ap.id = al.partner_id
         where al.active`,
      )
      const prices = await pool.query(
        `select distinct on (product_id)
           product_id, price_cents, currency, unit_amount, unit, captured_at
         from vergleich.price_snapshots
         order by product_id, captured_at desc`,
      )

      const result: ComparisonProduct[] = products.rows.map((p) => {
        const price = prices.rows.find((pr) => pr.product_id === p.id)
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          manufacturer: p.manufacturer,
          gtin: p.gtin,
          attributes: p.attributes,
          rank: Number(p.rank),
          totalScore: Number(p.total_score),
          evaluatedAt: p.evaluated_at,
          summary: p.summary,
          scores: p.scores,
          affiliateLinks: links.rows
            .filter((l) => l.product_id === p.id)
            .map((l) => ({ id: l.id, partner: l.partner })),
          price: price
            ? {
                cents: price.price_cents,
                currency: price.currency,
                unitAmount: price.unit_amount ? Number(price.unit_amount) : null,
                unit: price.unit,
                capturedAt: price.captured_at,
              }
            : null,
        }
      })

      return reply.send({
        category,
        methodology: {
          version: schema.rows[0].version,
          activatedAt: schema.rows[0].activated_at,
          criteria: criteria.map(({ key, label, weight, unit, direction }) => ({
            key,
            label: label ?? key,
            weight,
            unit: unit ?? null,
            direction: direction ?? null,
          })),
        },
        products: result,
      })
    },
  )
}

// Transparenz-Endpoint (Schritt 2.7): publiziert die Korrelation
// Rang vs. maximale Provision je Kategorie (View aus dem Artefakt).
// Ein Wert nahe 0 oder negativ ist der Beleg, dass das Ranking nicht
// mit der Vergütung korreliert.
import type { FastifyInstance } from 'fastify'

import { getPool } from './db.js'

export type TransparencyRow = {
  category: string
  categoryName: string
  productsRanked: number
  rankCommissionCorrelation: number | null
}

export type TransparencyResponse = {
  generatedAt: string
  rows: TransparencyRow[]
}

export const registerTransparenzPublic = (app: FastifyInstance): void => {
  app.get('/api/transparenz', async (_req, reply) => {
    const { rows } = await getPool().query(
      `select t.category, c.name as category_name, t.products_ranked,
              t.rank_commission_correlation, now() as generated_at
       from vergleich.transparency_rank_vs_commission t
       join vergleich.categories c on c.slug = t.category
       order by t.category`,
    )
    const response: TransparencyResponse = {
      generatedAt: rows[0]?.generated_at ?? new Date().toISOString(),
      rows: rows.map((r) => ({
        category: r.category,
        categoryName: r.category_name,
        productsRanked: Number(r.products_ranked),
        rankCommissionCorrelation:
          r.rank_commission_correlation === null
            ? null
            : Number(r.rank_commission_correlation),
      })),
    }
    return reply.send(response)
  })
}

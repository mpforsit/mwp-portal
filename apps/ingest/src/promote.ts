// Promote-Adapter (Schritt 8): übernimmt eine ABGENOMMENE Extraktion als
// Fakten nach vergleich.products. Gekapseltes SQL (CLAUDE.md). Schreibt
// ausschließlich nach vergleich.products — NIE nach product_evaluations
// (Bewertung bleibt im redaktionellen Pflege-Workflow).
import type pg from 'pg'

import { getPool } from './db.js'

export class PromoteError extends Error {}

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'produkt'

// Eindeutigen Slug finden (hängt -2, -3 … an, falls belegt).
const uniqueSlug = async (
  client: pg.PoolClient,
  base: string,
  excludeId: string | null,
): Promise<string> => {
  let candidate = base
  let n = 1
  for (;;) {
    const { rowCount } = await client.query(
      `select 1 from vergleich.products
       where slug = $1 and ($2::uuid is null or id <> $2)`,
      [candidate, excludeId],
    )
    if (!rowCount) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
}

export const promoteExtraction = async (
  extractionId: string,
): Promise<{ productId: string; created: boolean }> => {
  const client = await getPool().connect()
  try {
    await client.query('begin')

    const { rows } = await client.query(
      `select category_id as "categoryId", name, manufacturer, gtin,
              attributes, status, promoted_product_id as "promotedProductId"
       from ingest.extractions where id = $1 for update`,
      [extractionId],
    )
    const e = rows[0]
    if (!e) throw new PromoteError('Extraktion nicht gefunden.')
    if (e.status !== 'approved') {
      throw new PromoteError('Nur abgenommene Extraktionen können übernommen werden.')
    }
    if (!e.name) throw new PromoteError('Ohne Produktnamen nicht übernehmbar.')

    const manufacturer = (e.manufacturer as string | null) ?? 'Unbekannt'
    const attributes = JSON.stringify(e.attributes)

    // Dedup: bestehendes Produkt (verlinktes oder gleiche GTIN in Kategorie)
    let targetId = e.promotedProductId as string | null
    if (!targetId && e.gtin) {
      const dup = await client.query(
        'select id from vergleich.products where category_id = $1 and gtin = $2',
        [e.categoryId, e.gtin],
      )
      targetId = (dup.rows[0]?.id as string | undefined) ?? null
    }

    let productId: string
    let created: boolean
    if (targetId) {
      await client.query(
        `update vergleich.products
         set name = $2, manufacturer = $3, gtin = $4, attributes = $5
         where id = $1`,
        [targetId, e.name, manufacturer, e.gtin, attributes],
      )
      productId = targetId
      created = false
    } else {
      const slug = await uniqueSlug(client, slugify(e.name as string), null)
      const ins = await client.query(
        `insert into vergleich.products
           (category_id, slug, name, manufacturer, gtin, attributes)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [e.categoryId, slug, e.name, manufacturer, e.gtin, attributes],
      )
      productId = ins.rows[0].id as string
      created = true
    }

    await client.query(
      `update ingest.extractions
       set status = 'promoted', promoted_product_id = $2, updated_at = now()
       where id = $1`,
      [extractionId, productId],
    )

    await client.query('commit')
    return { productId, created }
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

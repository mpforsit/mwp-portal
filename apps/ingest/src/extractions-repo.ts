// Repository für normalisierte Fakten-Drafts (ingest.extractions).
import { getPool } from './db.js'

export interface ExtractionInput {
  sourceId: string
  categoryId: string
  name: string | null
  manufacturer: string | null
  gtin: string | null
  attributes: Record<string, unknown> // normalisierte Werte je Key
  confidence: Record<string, number>
  provenance: Record<string, unknown> // je Key Textbeleg + _source_url
}

// Legt/ersetzt den Draft einer Quelle. Erneute Extraktion setzt auf
// 'draft' zurück (neue Fakten wollen erneut abgenommen werden).
export const upsertExtraction = async (e: ExtractionInput): Promise<void> => {
  await getPool().query(
    `insert into ingest.extractions
       (source_id, category_id, name, manufacturer, gtin,
        attributes, confidence, provenance, status, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', now())
     on conflict (source_id) do update set
       category_id = excluded.category_id,
       name = excluded.name,
       manufacturer = excluded.manufacturer,
       gtin = excluded.gtin,
       attributes = excluded.attributes,
       confidence = excluded.confidence,
       provenance = excluded.provenance,
       status = 'draft',
       promoted_product_id = null,
       updated_at = now()`,
    [
      e.sourceId,
      e.categoryId,
      e.name,
      e.manufacturer,
      e.gtin,
      JSON.stringify(e.attributes),
      JSON.stringify(e.confidence),
      JSON.stringify(e.provenance),
    ],
  )
}

export interface ExtractionRow {
  id: string
  sourceId: string
  name: string | null
  manufacturer: string | null
  gtin: string | null
  attributes: Record<string, unknown>
  confidence: Record<string, number>
  provenance: Record<string, unknown>
  status: string
  promotedProductId: string | null
}

export const listExtractions = async (
  categoryId: string,
): Promise<ExtractionRow[]> => {
  const { rows } = await getPool().query(
    `select id, source_id as "sourceId", name, manufacturer, gtin,
            attributes, confidence, provenance, status,
            promoted_product_id as "promotedProductId"
     from ingest.extractions
     where category_id = $1
     order by created_at`,
    [categoryId],
  )
  return rows as ExtractionRow[]
}

// Setzt den Freigabe-Status (Tor 2: draft → approved / rejected).
export const setExtractionStatus = async (
  id: string,
  status: 'draft' | 'approved' | 'rejected',
): Promise<void> => {
  await getPool().query(
    'update ingest.extractions set status = $2, updated_at = now() where id = $1',
    [id, status],
  )
}

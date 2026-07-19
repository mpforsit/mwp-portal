// Repository für Rohsnapshots (Schema "ingest"). Nur Einfügen und
// Lesen — Snapshots sind unveränderlich (Beleg/Reproduzierbarkeit).
import { getPool } from './db.js'
import type { SnapshotPayload } from './fetcher.js'

export const insertSnapshot = async (
  sourceId: string,
  p: SnapshotPayload,
): Promise<string> => {
  const { rows } = await getPool().query(
    `insert into ingest.snapshots
       (source_id, http_status, ok, error, content_hash, raw_html, jsonld)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      sourceId,
      p.httpStatus,
      p.ok,
      p.error,
      p.contentHash,
      p.rawHtml,
      JSON.stringify(p.jsonld),
    ],
  )
  const id = rows[0]?.id as string | undefined
  if (!id) throw new Error('Snapshot konnte nicht gespeichert werden.')
  return id
}

export interface LatestSnapshot {
  fetchedAt: string
  httpStatus: number | null
  ok: boolean
  error: string | null
  jsonldCount: number
}

export interface SnapshotContent {
  sourceId: string
  jsonld: unknown[]
  rawHtml: string | null
}

// Neuester ERFOLGREICHER Snapshot je aktiver Quelle einer Kategorie —
// Grundlage für die Attribut-Sondierung.
export const latestContentForCategory = async (
  categoryId: string,
): Promise<SnapshotContent[]> => {
  const { rows } = await getPool().query(
    `select distinct on (sn.source_id)
       sn.source_id as "sourceId", sn.jsonld, sn.raw_html as "rawHtml"
     from ingest.snapshots sn
     join ingest.sources s on s.id = sn.source_id
     where s.category_id = $1 and s.active and sn.ok
     order by sn.source_id, sn.fetched_at desc`,
    [categoryId],
  )
  return rows.map((r) => ({
    sourceId: r.sourceId as string,
    jsonld: (r.jsonld as unknown[]) ?? [],
    rawHtml: r.rawHtml as string | null,
  }))
}

// Neuester Snapshot je Quelle (für die Statusanzeige in der UI).
export const latestSnapshots = async (): Promise<Map<string, LatestSnapshot>> => {
  const { rows } = await getPool().query(
    `select distinct on (source_id)
       source_id,
       fetched_at   as "fetchedAt",
       http_status  as "httpStatus",
       ok,
       error,
       jsonb_array_length(jsonld) as "jsonldCount"
     from ingest.snapshots
     order by source_id, fetched_at desc`,
  )
  const map = new Map<string, LatestSnapshot>()
  for (const r of rows) {
    map.set(r.source_id as string, {
      fetchedAt: r.fetchedAt as string,
      httpStatus: r.httpStatus as number | null,
      ok: r.ok as boolean,
      error: r.error as string | null,
      jsonldCount: r.jsonldCount as number,
    })
  }
  return map
}

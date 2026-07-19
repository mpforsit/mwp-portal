// Repository für die kuratierten Quellen (Schema "ingest"): anlegen,
// auflisten, aktivieren/deaktivieren. Gekapseltes SQL (CLAUDE.md).
import { getPool } from './db.js'

export interface Category {
  id: string
  slug: string
  name: string
}

export interface Source {
  id: string
  url: string
  label: string | null
  active: boolean
  categoryName: string
  categorySlug: string
}

export const listCategories = async (): Promise<Category[]> => {
  const { rows } = await getPool().query(
    'select id, slug, name from vergleich.categories order by name',
  )
  return rows as Category[]
}

export const listSources = async (): Promise<Source[]> => {
  const { rows } = await getPool().query(
    `select s.id, s.url, s.label, s.active,
            c.name as "categoryName", c.slug as "categorySlug"
     from ingest.sources s
     join vergleich.categories c on c.id = s.category_id
     order by c.name, s.created_at`,
  )
  return rows as Source[]
}

// Legt eine Quelle an. URL ist eindeutig: existiert sie schon, wird
// nichts überschrieben (created=false) — so sind Re-Runs harmlos.
export const addSource = async (
  categoryId: string,
  url: string,
  label?: string,
): Promise<{ id: string; created: boolean }> => {
  const inserted = await getPool().query(
    `insert into ingest.sources (category_id, url, label)
     values ($1, $2, $3)
     on conflict (url) do nothing
     returning id`,
    [categoryId, url, label ?? null],
  )
  const insertedId = inserted.rows[0]?.id as string | undefined
  if (insertedId) return { id: insertedId, created: true }

  const existing = await getPool().query(
    'select id from ingest.sources where url = $1',
    [url],
  )
  const existingId = existing.rows[0]?.id as string | undefined
  if (!existingId) throw new Error('Quelle konnte nicht angelegt werden.')
  return { id: existingId, created: false }
}

export const getSourceUrl = async (id: string): Promise<string | null> => {
  const { rows } = await getPool().query(
    'select url from ingest.sources where id = $1',
    [id],
  )
  return (rows[0]?.url as string | undefined) ?? null
}

export const setSourceActive = async (
  id: string,
  active: boolean,
): Promise<void> => {
  await getPool().query('update ingest.sources set active = $2 where id = $1', [
    id,
    active,
  ])
}

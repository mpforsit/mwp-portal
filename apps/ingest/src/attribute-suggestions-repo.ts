// Repository für Attribut-Vorschläge (Tor 1) und die bestätigte Auswahl.
import { getPool } from './db.js'
import type { AttributeSuggestion } from './attributes.js'

// Ersetzt die Vorschläge einer Kategorie komplett (idempotenter Re-Lauf).
export const replaceSuggestions = async (
  categoryId: string,
  suggestions: AttributeSuggestion[],
): Promise<void> => {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      'delete from ingest.attribute_suggestions where category_id = $1',
      [categoryId],
    )
    for (const s of suggestions) {
      await client.query(
        `insert into ingest.attribute_suggestions
           (category_id, attr_key, occurrences, examples, updated_at)
         values ($1, $2, $3, $4, now())`,
        [categoryId, s.key, s.occurrences, JSON.stringify(s.examples)],
      )
    }
    await client.query('commit')
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

export interface StoredSuggestion extends AttributeSuggestion {
  label: string
}

export const listSuggestions = async (
  categoryId: string,
): Promise<StoredSuggestion[]> => {
  const { rows } = await getPool().query(
    `select attr_key as key, occurrences, examples
     from ingest.attribute_suggestions
     where category_id = $1
     order by occurrences desc, attr_key`,
    [categoryId],
  )
  return rows.map((r) => ({
    key: r.key as string,
    label: r.key as string,
    occurrences: r.occurrences as number,
    examples: (r.examples as string[]) ?? [],
  }))
}

// Setzt die bestätigten Attribut-Keys einer Kategorie (Ergebnis Tor 1).
export const setSelectedAttributes = async (
  categoryId: string,
  keys: string[],
): Promise<void> => {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      'delete from ingest.selected_attributes where category_id = $1',
      [categoryId],
    )
    let position = 0
    for (const key of keys) {
      await client.query(
        `insert into ingest.selected_attributes (category_id, attr_key, position)
         values ($1, $2, $3)`,
        [categoryId, key, position],
      )
      position += 1
    }
    await client.query('commit')
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

export const listSelectedAttributes = async (
  categoryId: string,
): Promise<string[]> => {
  const { rows } = await getPool().query(
    `select attr_key from ingest.selected_attributes
     where category_id = $1 order by position`,
    [categoryId],
  )
  return rows.map((r) => r.attr_key as string)
}

// Repository für die Vergleichs-Engine (gekapseltes SQL, CLAUDE.md).
// Wird von den /internal/-Endpoints (2.2) und dem Admin-UI (2.3)
// gemeinsam genutzt.
import { getPool } from './db.js'
import type { Criterion, EvaluationResult } from './scoring.js'

export const loadCriteria = async (
  schemaId: string,
): Promise<Criterion[] | null> => {
  const { rows } = await getPool().query(
    'select criteria from vergleich.criteria_schemas where id = $1',
    [schemaId],
  )
  // criteria-JSONB aus der DB: markierte Deserialisierungs-Grenze
  return rows[0] ? (rows[0].criteria as Criterion[]) : null
}

export const productMatchesSchema = async (
  productId: string,
  schemaId: string,
): Promise<boolean> => {
  const { rowCount } = await getPool().query(
    `select 1
     from vergleich.products p
     join vergleich.criteria_schemas s on s.category_id = p.category_id
     where p.id = $1 and s.id = $2`,
    [productId, schemaId],
  )
  return Boolean(rowCount)
}

export const insertEvaluation = async (
  productId: string,
  schemaId: string,
  result: EvaluationResult,
  evaluatedBy: string,
  evidence: unknown[] = [],
): Promise<{ id: string; evaluatedAt: string }> => {
  const { rows } = await getPool().query(
    `insert into vergleich.product_evaluations
       (product_id, schema_id, scores, total_score, evaluated_by,
        evidence, published)
     values ($1, $2, $3::jsonb, $4, $5, $6::jsonb, false)
     returning id, evaluated_at`,
    [
      productId,
      schemaId,
      JSON.stringify(result.scores),
      result.totalScore,
      evaluatedBy,
      JSON.stringify(evidence),
    ],
  )
  return { id: rows[0].id, evaluatedAt: rows[0].evaluated_at }
}

// Publizieren + Korrektur-Kette: ältere publizierte, nicht abgelöste
// Bewertungen desselben Produkts werden auf die neue abgelöst
// (superseded_by) — der einzige zulässige Korrekturweg (Artefakt).
export const publishEvaluation = async (
  evaluationId: string,
): Promise<boolean> => {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const updated = await client.query(
      `update vergleich.product_evaluations
       set published = true
       where id = $1 and not published
       returning product_id`,
      [evaluationId],
    )
    if (!updated.rowCount) {
      await client.query('rollback')
      return false
    }
    await client.query(
      `update vergleich.product_evaluations
       set superseded_by = $1
       where product_id = $2 and id <> $1
         and published and superseded_by is null`,
      [evaluationId, updated.rows[0].product_id],
    )
    await client.query('commit')
    return true
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

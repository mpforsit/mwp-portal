// Interne Bewertungs-Endpoints (Schritt 2.2):
// POST /internal/evaluations/preview — berechnet, speichert nicht
// POST /internal/evaluations         — speichert unpubliziert
// Publizieren gehört zum Pflege-Workflow (2.3), nie hierüber.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { getPool } from './db.js'
import { evaluate, ScoringError, type Criterion } from './scoring.js'

type EvaluationBody = {
  schemaId?: string
  productId?: string
  raws?: Record<string, unknown>
  notes?: Record<string, string>
  evidence?: unknown[]
  evaluatedBy?: string
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Interner Bereich: ohne konfiguriertes Token nur in der lokalen
// Entwicklung offen
const guard = (req: FastifyRequest, reply: FastifyReply): boolean => {
  const token = process.env.INTERNAL_API_TOKEN
  if (!token) return true
  if (req.headers.authorization === `Bearer ${token}`) return true
  reply.status(401).send({ ok: false, message: 'Nicht autorisiert.' })
  return false
}

const loadCriteria = async (
  schemaId: string,
): Promise<Criterion[] | null> => {
  const { rows } = await getPool().query(
    'select criteria from vergleich.criteria_schemas where id = $1',
    [schemaId],
  )
  // criteria-JSONB aus der DB: markierte Deserialisierungs-Grenze
  return rows[0] ? (rows[0].criteria as Criterion[]) : null
}

const computeFromBody = async (body: EvaluationBody) => {
  if (!body.schemaId || !UUID_PATTERN.test(body.schemaId)) {
    return { error: 'schemaId (UUID) ist erforderlich.' }
  }
  if (!body.raws || typeof body.raws !== 'object') {
    return { error: 'raws (Rohwerte je Kriteriums-Key) sind erforderlich.' }
  }
  const criteria = await loadCriteria(body.schemaId)
  if (!criteria) {
    return { error: `Schema ${body.schemaId} nicht gefunden.` }
  }
  try {
    return { result: evaluate(criteria, body.raws, body.notes ?? {}) }
  } catch (err) {
    if (err instanceof ScoringError) return { error: err.message }
    throw err
  }
}

export const registerEvaluationRoutes = (app: FastifyInstance): void => {
  app.post('/internal/evaluations/preview', async (req, reply) => {
    if (!guard(req, reply)) return
    const outcome = await computeFromBody((req.body ?? {}) as EvaluationBody)
    if ('error' in outcome) {
      return reply.status(400).send({ ok: false, message: outcome.error })
    }
    return reply.send({
      ok: true,
      scores: outcome.result.scores,
      totalScore: outcome.result.totalScore,
    })
  })

  app.post('/internal/evaluations', async (req, reply) => {
    if (!guard(req, reply)) return
    const body = (req.body ?? {}) as EvaluationBody
    if (!body.productId || !UUID_PATTERN.test(body.productId)) {
      return reply
        .status(400)
        .send({ ok: false, message: 'productId (UUID) ist erforderlich.' })
    }
    if (!body.evaluatedBy) {
      return reply
        .status(400)
        .send({ ok: false, message: 'evaluatedBy ist erforderlich.' })
    }
    const outcome = await computeFromBody(body)
    if ('error' in outcome) {
      return reply.status(400).send({ ok: false, message: outcome.error })
    }

    // Produkt muss existieren und zur Kategorie des Schemas gehören
    const check = await getPool().query(
      `select 1
       from vergleich.products p
       join vergleich.criteria_schemas s on s.category_id = p.category_id
       where p.id = $1 and s.id = $2`,
      [body.productId, body.schemaId],
    )
    if (!check.rowCount) {
      return reply.status(400).send({
        ok: false,
        message: 'Produkt nicht gefunden oder gehört nicht zur Kategorie des Schemas.',
      })
    }

    const inserted = await getPool().query(
      `insert into vergleich.product_evaluations
         (product_id, schema_id, scores, total_score, evaluated_by,
          evidence, published)
       values ($1, $2, $3::jsonb, $4, $5, $6::jsonb, false)
       returning id, evaluated_at`,
      [
        body.productId,
        body.schemaId,
        JSON.stringify(outcome.result.scores),
        outcome.result.totalScore,
        body.evaluatedBy,
        JSON.stringify(body.evidence ?? []),
      ],
    )
    return reply.status(201).send({
      ok: true,
      id: inserted.rows[0].id,
      evaluatedAt: inserted.rows[0].evaluated_at,
      scores: outcome.result.scores,
      totalScore: outcome.result.totalScore,
      published: false,
    })
  })
}

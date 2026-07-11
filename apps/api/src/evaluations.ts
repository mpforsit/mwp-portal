// Interne Bewertungs-Endpoints (Schritt 2.2):
// POST /internal/evaluations/preview — berechnet, speichert nicht
// POST /internal/evaluations         — speichert unpubliziert
// Publizieren gehört zum Pflege-Workflow (2.3), nie hierüber.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import {
  insertEvaluation,
  loadCriteria,
  productMatchesSchema,
} from './evaluations-repo.js'
import { evaluate, ScoringError } from './scoring.js'

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
    if (!(await productMatchesSchema(body.productId, body.schemaId as string))) {
      return reply.status(400).send({
        ok: false,
        message: 'Produkt nicht gefunden oder gehört nicht zur Kategorie des Schemas.',
      })
    }

    const inserted = await insertEvaluation(
      body.productId,
      body.schemaId as string,
      outcome.result,
      body.evaluatedBy,
      body.evidence ?? [],
    )
    return reply.status(201).send({
      ok: true,
      id: inserted.id,
      evaluatedAt: inserted.evaluatedAt,
      scores: outcome.result.scores,
      totalScore: outcome.result.totalScore,
      published: false,
    })
  })
}

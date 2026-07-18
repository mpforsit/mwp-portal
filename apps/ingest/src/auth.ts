// Basic-Auth für das Ingest-Admin-UI (gleiches Muster wie der
// Pflege-Admin der API, ADR 0002). Eigener Zugang via INGEST_ADMIN_*.
import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

const safeEquals = (a: string, b: string): boolean => {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

const requireAuth = (req: FastifyRequest, reply: FastifyReply): boolean => {
  const user = process.env.INGEST_ADMIN_USER
  const password = process.env.INGEST_ADMIN_PASSWORD
  if (!user || !password) {
    reply
      .status(503)
      .send('Admin nicht konfiguriert (INGEST_ADMIN_USER/INGEST_ADMIN_PASSWORD).')
    return false
  }
  const header = req.headers.authorization ?? ''
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString()
    if (safeEquals(decoded, `${user}:${password}`)) return true
  }
  reply
    .status(401)
    .header('www-authenticate', 'Basic realm="myWell Ingest"')
    .send('Anmeldung erforderlich.')
  return false
}

// Schützt alle /admin/-Routen per onRequest-Hook.
export const registerAdminAuth = (app: FastifyInstance): void => {
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/admin')) return
    if (!requireAuth(req, reply)) return reply
  })
}

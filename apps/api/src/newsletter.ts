// Newsletter-Anmeldung → Brevo Double-Opt-in (Umsetzungsplan 1.7).
// Rote Linie (CLAUDE.md): Segmentierung nur nach Interessen — als
// Attribut geht ausschließlich die Interessens-Kategorie der Seite
// mit (INTERESSE_<KATEGORIE>=true), niemals andere Daten.
import type { FastifyInstance } from 'fastify'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INTEREST_PATTERN = /^[a-z0-9-]{1,60}$/

export type SubscribeInput = { email: string; interest: string }

export const parseSubscribeInput = (
  body: unknown,
): SubscribeInput | { error: string } => {
  const record = (body ?? {}) as Record<string, unknown>
  const email = typeof record.email === 'string' ? record.email.trim() : ''
  const interest =
    typeof record.interest === 'string' ? record.interest.trim() : ''
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Bitte eine gültige E-Mail-Adresse angeben.' }
  }
  if (!INTEREST_PATTERN.test(interest)) {
    return { error: 'Ungültige Interessens-Kategorie.' }
  }
  return { email, interest }
}

// Baut den Brevo-DOI-Payload. Bewusst als reine, getestete Funktion:
// Der Test schlägt fehl, wenn hier je mehr als E-Mail + ein
// Interessens-Attribut übertragen würde.
export const buildBrevoPayload = (
  input: SubscribeInput,
  config: { listId: number; templateId: number; redirectionUrl: string },
): Record<string, unknown> => ({
  email: input.email,
  includeListIds: [config.listId],
  templateId: config.templateId,
  redirectionUrl: config.redirectionUrl,
  attributes: {
    [`INTERESSE_${input.interest.toUpperCase().replace(/-/g, '_')}`]: true,
  },
})

export const registerNewsletterRoutes = (app: FastifyInstance): void => {
  // Das statische Frontend läuft auf eigener Origin
  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith('/newsletter/')) {
      reply.header('access-control-allow-origin', process.env.WEB_ORIGIN ?? '*')
      reply.header('access-control-allow-methods', 'POST, OPTIONS')
      reply.header('access-control-allow-headers', 'content-type')
    }
  })
  app.options('/newsletter/subscribe', async (_req, reply) =>
    reply.status(204).send(),
  )

  app.post('/newsletter/subscribe', async (req, reply) => {
    const parsed = parseSubscribeInput(req.body)
    if ('error' in parsed) {
      return reply.status(400).send({ ok: false, message: parsed.error })
    }

    const apiKey = process.env.BREVO_API_KEY
    const listId = Number(process.env.BREVO_LIST_ID)
    const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID)
    const redirectionUrl = process.env.BREVO_DOI_REDIRECT_URL
    if (!apiKey || !listId || !templateId || !redirectionUrl) {
      req.log.error('Brevo-Konfiguration unvollständig')
      return reply
        .status(503)
        .send({ ok: false, message: 'Anmeldung derzeit nicht möglich.' })
    }

    const res = await fetch(
      'https://api.brevo.com/v3/contacts/doubleOptinConfirmation',
      {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify(
          buildBrevoPayload(parsed, { listId, templateId, redirectionUrl }),
        ),
      },
    )
    if (!res.ok) {
      req.log.error({ status: res.status }, 'Brevo-Anfrage fehlgeschlagen')
      return reply
        .status(502)
        .send({ ok: false, message: 'Anmeldung derzeit nicht möglich.' })
    }
    return reply.send({
      ok: true,
      message:
        'Fast geschafft: Bitte den Bestätigungslink in der E-Mail anklicken.',
    })
  })
}

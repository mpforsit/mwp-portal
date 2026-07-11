// Tests für die Newsletter-Anmeldung (Schritt 1.7). Der Attribut-Test
// ist ein Rote-Linie-Wächter: Er bricht, sobald mehr als E-Mail +
// eine Interessens-Kategorie an Brevo übertragen würde.
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildBrevoPayload,
  parseSubscribeInput,
  registerNewsletterRoutes,
} from '../src/newsletter.js'

const config = {
  listId: 7,
  templateId: 3,
  redirectionUrl: 'https://portal.example/newsletter/bestaetigt/',
}

describe('parseSubscribeInput', () => {
  it('akzeptiert gültige Eingaben', () => {
    expect(
      parseSubscribeInput({ email: 'a@b.de', interest: 'vitamin-d' }),
    ).toEqual({ email: 'a@b.de', interest: 'vitamin-d' })
  })

  it.each([
    [{ email: 'keine-mail', interest: 'vitamin-d' }],
    [{ email: 'a@b.de', interest: 'Ungültig!' }],
    [{ email: 'a@b.de', interest: '' }],
    [{}],
  ])('weist ungültige Eingaben zurück: %j', (body) => {
    expect(parseSubscribeInput(body)).toHaveProperty('error')
  })
})

describe('buildBrevoPayload (rote Linie: nur Interessen)', () => {
  it('überträgt als Attribut ausschließlich die Interessens-Kategorie', () => {
    const payload = buildBrevoPayload(
      { email: 'a@b.de', interest: 'vitamin-d' },
      config,
    )
    expect(payload.attributes).toEqual({ INTERESSE_VITAMIN_D: true })
    // exakt diese Top-Level-Felder, nichts darüber hinaus
    expect(Object.keys(payload).sort()).toEqual([
      'attributes',
      'email',
      'includeListIds',
      'redirectionUrl',
      'templateId',
    ])
  })
})

describe('POST /newsletter/subscribe', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  const buildApp = () => {
    const app = Fastify()
    registerNewsletterRoutes(app)
    return app
  }

  it('400 bei ungültiger Eingabe', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/newsletter/subscribe',
      payload: { email: 'nope', interest: 'vitamin-d' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('503 ohne Brevo-Konfiguration', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/newsletter/subscribe',
      payload: { email: 'a@b.de', interest: 'vitamin-d' },
    })
    expect(res.statusCode).toBe(503)
  })

  it('leitet gültige Anmeldungen an Brevo weiter (DOI-Endpoint)', async () => {
    vi.stubEnv('BREVO_API_KEY', 'test-key')
    vi.stubEnv('BREVO_LIST_ID', '7')
    vi.stubEnv('BREVO_DOI_TEMPLATE_ID', '3')
    vi.stubEnv('BREVO_DOI_REDIRECT_URL', config.redirectionUrl)
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/newsletter/subscribe',
      payload: { email: 'a@b.de', interest: 'vitamin-d' },
    })
    expect(res.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ]
    expect(url).toBe('https://api.brevo.com/v3/contacts/doubleOptinConfirmation')
    const body = JSON.parse(init.body) as Record<string, unknown>
    expect(body.attributes).toEqual({ INTERESSE_VITAMIN_D: true })
  })
})

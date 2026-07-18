// Admin-UI der Ingest-Pipeline: Quellen-Verwaltung (Schritt 3).
// Server-gerendert, urlencoded-Formulare, kein Client-JS.
import type { FastifyInstance } from 'fastify'

import { esc, layout } from './html.js'
import {
  addSource,
  listCategories,
  listSources,
  setSourceActive,
} from './sources-repo.js'

const sourcesPage = async (): Promise<string> => {
  const [categories, sources] = await Promise.all([
    listCategories(),
    listSources(),
  ])

  const categoryOptions = categories
    .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
    .join('')

  const addForm = categories.length
    ? `<fieldset><legend>Quelle hinzufügen</legend>
        <form method="post" action="/admin/sources">
          <label>Kategorie
            <select name="category_id" required>${categoryOptions}</select>
          </label>
          <label>Produktseiten-URL
            <input name="url" type="url" size="60" placeholder="https://…" required>
          </label>
          <label>Bezeichnung (optional)
            <input name="label" size="30" placeholder="z. B. Hersteller/Produkt">
          </label>
          <button type="submit">Hinzufügen</button>
        </form></fieldset>`
    : `<p class="muted">Noch keine Kategorie vorhanden. Lege zuerst im
       Pflege-Admin der Vergleichs-Engine eine Kategorie an.</p>`

  const rows = sources
    .map(
      (s) => `<tr class="${s.active ? '' : 'off'}">
        <td>${esc(s.categoryName)}</td>
        <td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></td>
        <td>${esc(s.label ?? '')}</td>
        <td>${s.active ? 'aktiv' : 'inaktiv'}</td>
        <td><form method="post" action="/admin/sources/${esc(s.id)}/toggle">
          <input type="hidden" name="active" value="${s.active ? 'false' : 'true'}">
          <button type="submit">${s.active ? 'deaktivieren' : 'aktivieren'}</button>
        </form></td>
      </tr>`,
    )
    .join('')

  const table = sources.length
    ? `<table><thead><tr>
        <th>Kategorie</th><th>URL</th><th>Bezeichnung</th><th>Status</th><th></th>
       </tr></thead><tbody>${rows}</tbody></table>`
    : '<p class="muted">Noch keine Quellen angelegt.</p>'

  return layout('Quellen', `<h1>Quellen</h1>${addForm}${table}`)
}

interface AddBody {
  category_id?: string
  url?: string
  label?: string
}
interface ToggleBody {
  active?: string
}

export const registerAdmin = (app: FastifyInstance): void => {
  // Formulare kommen urlencoded — kleiner Parser statt @fastify/formbody
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body as string)))
    },
  )

  app.get('/admin/sources', async (_req, reply) => {
    reply.type('text/html').send(await sourcesPage())
  })

  app.post<{ Body: AddBody }>('/admin/sources', async (req, reply) => {
    const { category_id, url, label } = req.body
    if (!category_id || !url) {
      return reply.status(400).send('Kategorie und URL sind erforderlich.')
    }
    await addSource(category_id, url, label || undefined)
    reply.redirect('/admin/sources', 303)
  })

  app.post<{ Params: { id: string }; Body: ToggleBody }>(
    '/admin/sources/:id/toggle',
    async (req, reply) => {
      await setSourceActive(req.params.id, req.body.active === 'true')
      reply.redirect('/admin/sources', 303)
    },
  )
}

// Admin-UI Tor 1 (Schritt 5): Attribute je Kategorie vorschlagen lassen
// und die relevanten an-/abwählen.
import type { FastifyInstance } from 'fastify'

import {
  listSelectedAttributes,
  listSuggestions,
  setSelectedAttributes,
} from './attribute-suggestions-repo.js'
import { proposeAttributes } from './discovery.js'
import { esc, layout } from './html.js'
import { createExtractor } from './llm.js'
import { listCategories } from './sources-repo.js'

const attributesPage = async (notice?: string): Promise<string> => {
  const categories = await listCategories()
  const sections: string[] = []

  for (const c of categories) {
    const [suggestions, selected] = await Promise.all([
      listSuggestions(c.id),
      listSelectedAttributes(c.id),
    ])
    const selectedSet = new Set(selected)

    const rows = suggestions
      .map(
        (s) => `<tr>
          <td><label>
            <input type="checkbox" name="key" value="${esc(s.key)}"${
              selectedSet.has(s.key) ? ' checked' : ''
            }>
            ${esc(s.key)}
          </label></td>
          <td>${s.occurrences}</td>
          <td class="muted">${esc(s.examples.slice(0, 3).join(' · '))}</td>
        </tr>`,
      )
      .join('')

    const table = suggestions.length
      ? `<form method="post" action="/admin/attributes/${esc(c.id)}/select">
           <table><thead><tr><th>Attribut</th><th>Quellen</th><th>Beispiele</th></tr></thead>
           <tbody>${rows}</tbody></table>
           <button type="submit">Auswahl speichern</button>
         </form>`
      : '<p class="muted">Noch kein Vorschlag. Erst Quellen sondieren, dann hier vorschlagen lassen.</p>'

    sections.push(`<fieldset><legend>${esc(c.name)}</legend>
      <form method="post" action="/admin/attributes/${esc(c.id)}/propose">
        <button type="submit">Attribute aus Snapshots vorschlagen</button>
      </form>
      ${table}
    </fieldset>`)
  }

  const noticeHtml = notice ? `<p class="muted">${esc(notice)}</p>` : ''
  return layout(
    'Attribute',
    `<h1>Attribute (Tor 1)</h1>${noticeHtml}${sections.join('')}`,
  )
}

interface SelectBody {
  key?: string | string[]
}

export const registerAdminAttributes = (app: FastifyInstance): void => {
  app.get('/admin/attributes', async (_req, reply) => {
    reply.type('text/html').send(await attributesPage())
  })

  app.post<{ Params: { categoryId: string } }>(
    '/admin/attributes/:categoryId/propose',
    async (req, reply) => {
      let notice: string
      try {
        const count = await proposeAttributes(req.params.categoryId, {
          extractor: createExtractor(),
        })
        notice =
          count > 0
            ? `${count} Quelle(n) ausgewertet.`
            : 'Keine sondierten Quellen gefunden — erst Quellen anlegen und sondieren.'
      } catch (err) {
        notice = err instanceof Error ? err.message : 'Fehler bei der Sondierung.'
      }
      reply.type('text/html').send(await attributesPage(notice))
    },
  )

  app.post<{ Params: { categoryId: string }; Body: SelectBody }>(
    '/admin/attributes/:categoryId/select',
    async (req, reply) => {
      const raw = req.body.key
      const keys = Array.isArray(raw) ? raw : raw ? [raw] : []
      await setSelectedAttributes(req.params.categoryId, keys)
      reply.redirect('/admin/attributes', 303)
    },
  )
}

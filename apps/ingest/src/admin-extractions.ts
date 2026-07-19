// Admin-UI Schritt 7: Fakten je Kategorie extrahieren und die Drafts
// (mit Normalisierung/Confidence) anzeigen. Abnahme/Promote folgt Tor 2.
import type { FastifyInstance } from 'fastify'

import { extractForCategory } from './extraction.js'
import {
  listExtractions,
  setExtractionStatus,
  type ExtractionRow,
} from './extractions-repo.js'
import { esc, layout } from './html.js'
import { createFactExtractor } from './llm.js'
import { promoteExtraction, PromoteError } from './promote.js'
import { listCategories } from './sources-repo.js'

const attrCell = (row: ExtractionRow): string => {
  const keys = Object.keys(row.attributes)
  if (!keys.length) return '<span class="muted">—</span>'
  return keys
    .map((k) => {
      const v = row.attributes[k] as { raw?: string; ie?: number | null; priceCents?: number | null }
      const conf = row.confidence[k]
      const extra =
        v?.ie != null ? ` = ${v.ie} IE` : v?.priceCents != null ? ` = ${v.priceCents} ct` : ''
      const c = typeof conf === 'number' ? ` <span class="muted">(${conf.toFixed(2)})</span>` : ''
      return `${esc(k)}: ${esc(v?.raw ?? '')}${extra}${c}`
    })
    .join('<br>')
}

const extractionsPage = async (notice?: string): Promise<string> => {
  const categories = await listCategories()
  const sections: string[] = []

  for (const c of categories) {
    const rows = await listExtractions(c.id)
    const actions = (r: ExtractionRow): string => {
      const act = (verb: string, label: string): string =>
        `<form method="post" action="/admin/extractions/e/${esc(r.id)}/${verb}">
           <button type="submit">${label}</button></form>`
      if (r.status === 'draft') return act('approve', 'freigeben') + act('reject', 'ablehnen')
      if (r.status === 'approved') return act('promote', 'übernehmen') + act('reject', 'ablehnen')
      if (r.status === 'promoted') return '<span class="muted">übernommen</span>'
      return act('approve', 'doch freigeben')
    }

    const body = rows.length
      ? `<table><thead><tr>
           <th>Produkt</th><th>Hersteller</th><th>GTIN</th><th>Fakten (Confidence)</th><th>Status</th><th></th>
         </tr></thead><tbody>${rows
           .map(
             (r) => `<tr>
               <td>${esc(r.name ?? '')}</td>
               <td>${esc(r.manufacturer ?? '')}</td>
               <td>${esc(r.gtin ?? '')}</td>
               <td>${attrCell(r)}</td>
               <td>${esc(r.status)}</td>
               <td>${actions(r)}</td>
             </tr>`,
           )
           .join('')}</tbody></table>`
      : '<p class="muted">Noch keine Extraktion. Erst Attribute bestätigen (Tor 1), dann hier extrahieren.</p>'

    sections.push(`<fieldset><legend>${esc(c.name)}</legend>
      <form method="post" action="/admin/extractions/${esc(c.id)}/run">
        <button type="submit">Fakten extrahieren</button>
      </form>
      ${body}
    </fieldset>`)
  }

  const noticeHtml = notice ? `<p class="muted">${esc(notice)}</p>` : ''
  return layout(
    'Extraktion',
    `<h1>Extraktion</h1>${noticeHtml}${sections.join('')}`,
  )
}

export const registerAdminExtractions = (app: FastifyInstance): void => {
  app.get('/admin/extractions', async (_req, reply) => {
    reply.type('text/html').send(await extractionsPage())
  })

  app.post<{ Params: { categoryId: string } }>(
    '/admin/extractions/:categoryId/run',
    async (req, reply) => {
      let notice: string
      try {
        const count = await extractForCategory(req.params.categoryId, {
          factExtractor: createFactExtractor(),
        })
        notice = `${count} Quelle(n) extrahiert.`
      } catch (err) {
        notice = err instanceof Error ? err.message : 'Fehler bei der Extraktion.'
      }
      reply.type('text/html').send(await extractionsPage(notice))
    },
  )

  // Tor 2: freigeben / ablehnen
  app.post<{ Params: { id: string; verb: 'approve' | 'reject' } }>(
    '/admin/extractions/e/:id/:verb',
    async (req, reply) => {
      const { id, verb } = req.params
      if (verb === 'approve') await setExtractionStatus(id, 'approved')
      else if (verb === 'reject') await setExtractionStatus(id, 'rejected')
      reply.redirect('/admin/extractions', 303)
    },
  )

  // Promote nach vergleich.products
  app.post<{ Params: { id: string } }>(
    '/admin/extractions/e/:id/promote',
    async (req, reply) => {
      let notice: string
      try {
        const { productId, created } = await promoteExtraction(req.params.id)
        notice = created
          ? `Neues Produkt angelegt (${productId}).`
          : `Bestehendes Produkt aktualisiert (${productId}).`
      } catch (err) {
        notice =
          err instanceof PromoteError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Fehler beim Übernehmen.'
      }
      reply.type('text/html').send(await extractionsPage(notice))
    },
  )
}

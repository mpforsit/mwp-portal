// Minimales Admin-UI für die Vergleichs-Engine (Schritt 2.3,
// ADR 0002): server-gerendertes HTML, Basic-Auth, kein Client-JS.
// Funktionen: Produkt anlegen, attributes pflegen, Preview-Score,
// Bewertung unpubliziert speichern, publizieren (mit automatischer
// superseded_by-Kette auf ältere publizierte Bewertungen).
import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { getPool } from './db.js'
import {
  insertEvaluation,
  loadCriteria,
  publishEvaluation,
} from './evaluations-repo.js'
import { evaluate, ScoringError, type Criterion } from './scoring.js'

// --- HTML-Helfer ------------------------------------------------------
const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const layout = (title: string, body: string): string => `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} — Vergleichs-Engine</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#26312f}
  table{border-collapse:collapse;width:100%;margin:1rem 0}
  th,td{border-bottom:1px solid #ddd;text-align:left;padding:.4rem .6rem;vertical-align:top}
  input,select,textarea,button{font:inherit;padding:.3rem .5rem;margin:.15rem 0}
  textarea{width:100%;min-height:6rem}
  fieldset{margin:1.5rem 0;border:1px solid #ccc;border-radius:4px}
  .score{background:#e7f0ee;border-left:4px solid #14665c;padding:.6rem 1rem;margin:1rem 0}
  .error{background:#fbeaea;border-left:4px solid #b3261e;padding:.6rem 1rem;margin:1rem 0}
  .muted{color:#5c6a67;font-size:.9em}
  nav{margin-bottom:1.5rem}
</style></head>
<body><nav><a href="/admin/vergleich">Vergleichs-Engine</a></nav>
${body}</body></html>`

// --- Basic-Auth ---------------------------------------------------------
const safeEquals = (a: string, b: string): boolean => {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

const requireAuth = (req: FastifyRequest, reply: FastifyReply): boolean => {
  const user = process.env.ADMIN_USER
  const password = process.env.ADMIN_PASSWORD
  if (!user || !password) {
    reply
      .status(503)
      .send('Admin-Bereich nicht konfiguriert (ADMIN_USER/ADMIN_PASSWORD).')
    return false
  }
  const header = req.headers.authorization ?? ''
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString()
    if (safeEquals(decoded, `${user}:${password}`)) return true
  }
  reply
    .status(401)
    .header('www-authenticate', 'Basic realm="Vergleichs-Engine"')
    .send('Anmeldung erforderlich.')
  return false
}

// --- Formular-Rendering für Kriterien ------------------------------------
const criterionInput = (c: Criterion): string => {
  const label = `${esc(c.label ?? c.key)}${c.unit ? ` (${esc(c.unit)})` : ''} — Gewicht ${c.weight}`
  const input = c.scoring.map
    ? `<select name="raw_${esc(c.key)}" required>
        <option value="">– wählen –</option>
        ${Object.keys(c.scoring.map)
          .map((k) => `<option value="${esc(k)}">${esc(k)}</option>`)
          .join('')}
       </select>`
    : `<input name="raw_${esc(c.key)}" type="number" step="any" required>`
  return `<tr><td><label>${label}</label>${
    c.direction ? `<div class="muted">${esc(c.direction)}</div>` : ''
  }</td><td>${input}</td>
  <td><input name="note_${esc(c.key)}" placeholder="Notiz/Beleg (optional)" size="34"></td></tr>`
}

type FormBody = Record<string, string>

const parseRaws = (
  criteria: Criterion[],
  body: FormBody,
): { raws: Record<string, unknown>; notes: Record<string, string> } => {
  const raws: Record<string, unknown> = {}
  const notes: Record<string, string> = {}
  for (const c of criteria) {
    const value = body[`raw_${c.key}`]
    if (value !== undefined && value !== '') {
      raws[c.key] = c.scoring.bands ? Number(value) : value
    }
    const note = body[`note_${c.key}`]
    if (note) notes[c.key] = note
  }
  return { raws, notes }
}

// --- Routen ---------------------------------------------------------------
export const registerAdminVergleich = (app: FastifyInstance): void => {
  // Formulare kommen urlencoded — kleiner Parser statt @fastify/formbody
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_req, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body as string)))
    },
  )

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/admin/')) return
    if (!requireAuth(req, reply)) return reply
  })

  // Übersicht: Kategorien
  app.get('/admin/vergleich', async (_req, reply) => {
    const { rows } = await getPool().query(
      `select c.id, c.name, c.slug, count(p.id)::int as products
       from vergleich.categories c
       left join vergleich.products p on p.category_id = c.id
       group by c.id order by c.name`,
    )
    const list = rows
      .map(
        (r) =>
          `<tr><td><a href="/admin/vergleich/kategorie/${r.id}">${esc(r.name)}</a></td>
           <td>${esc(r.slug)}</td><td>${r.products}</td></tr>`,
      )
      .join('')
    reply.type('text/html').send(
      layout(
        'Kategorien',
        `<h1>Kategorien</h1>
         <table><tr><th>Name</th><th>Slug</th><th>Produkte</th></tr>${list}</table>`,
      ),
    )
  })

  // Kategorie: Produkte + Produkt anlegen
  app.get<{ Params: { id: string } }>(
    '/admin/vergleich/kategorie/:id',
    async (req, reply) => {
      const pool = getPool()
      const cat = await pool.query(
        'select id, name from vergleich.categories where id = $1',
        [req.params.id],
      )
      if (!cat.rowCount) return reply.status(404).send('Kategorie unbekannt.')
      const schema = await pool.query(
        `select id, version from vergleich.criteria_schemas
         where category_id = $1 and status = 'active'`,
        [req.params.id],
      )
      const products = await pool.query(
        `select p.id, p.name, p.manufacturer, p.status, r.total_score, r.rank
         from vergleich.products p
         left join vergleich.current_ranking r on r.product_id = p.id
         where p.category_id = $1 order by r.rank nulls last, p.name`,
        [req.params.id],
      )
      const rows = products.rows
        .map(
          (p) =>
            `<tr><td><a href="/admin/vergleich/produkt/${p.id}">${esc(p.name)}</a></td>
             <td>${esc(p.manufacturer)}</td><td>${esc(p.status)}</td>
             <td>${p.total_score ?? '—'}</td><td>${p.rank ?? '—'}</td></tr>`,
        )
        .join('')
      reply.type('text/html').send(
        layout(
          cat.rows[0].name,
          `<h1>${esc(cat.rows[0].name)}</h1>
           <p class="muted">Aktive Methodik: ${
             schema.rowCount ? `v${schema.rows[0].version}` : 'KEINE — publizierte Bewertungen erscheinen nicht im Ranking'
           }</p>
           <table><tr><th>Produkt</th><th>Hersteller</th><th>Status</th><th>Score</th><th>Rang</th></tr>${rows}</table>
           <fieldset><legend>Produkt anlegen</legend>
           <form method="post" action="/admin/vergleich/produkte">
             <input type="hidden" name="category_id" value="${esc(cat.rows[0].id)}">
             <p><input name="slug" placeholder="slug" required>
                <input name="name" placeholder="Name" required size="32">
                <input name="manufacturer" placeholder="Hersteller" required>
                <input name="gtin" placeholder="GTIN (optional)"></p>
             <p><label>attributes (JSON):</label>
                <textarea name="attributes">{}</textarea></p>
             <button type="submit">Anlegen</button>
           </form></fieldset>`,
        ),
      )
    },
  )

  app.post<{ Body: FormBody }>('/admin/vergleich/produkte', async (req, reply) => {
    const b = req.body
    let attributes: unknown
    try {
      attributes = JSON.parse(b.attributes || '{}')
    } catch {
      return reply.status(400).send('attributes ist kein gültiges JSON.')
    }
    const { rows } = await getPool().query(
      `insert into vergleich.products
         (category_id, slug, name, manufacturer, gtin, attributes)
       values ($1, $2, $3, $4, nullif($5, ''), $6::jsonb)
       returning id`,
      [b.category_id, b.slug, b.name, b.manufacturer, b.gtin ?? '', JSON.stringify(attributes)],
    )
    return reply.redirect(`/admin/vergleich/produkt/${rows[0].id}`, 303)
  })

  // Produkt: attributes, Bewertungen, Bewertungsformular mit Preview
  const renderProduct = async (
    productId: string,
    reply: FastifyReply,
    preview?: { totalScore: number; scores: unknown } | { error: string },
  ) => {
    const pool = getPool()
    const prod = await pool.query(
      `select p.*, c.name as category_name
       from vergleich.products p join vergleich.categories c on c.id = p.category_id
       where p.id = $1`,
      [productId],
    )
    if (!prod.rowCount) return reply.status(404).send('Produkt unbekannt.')
    const p = prod.rows[0]
    const schema = await pool.query(
      `select id, version, criteria from vergleich.criteria_schemas
       where category_id = $1 and status = 'active'`,
      [p.category_id],
    )
    const evals = await pool.query(
      `select id, total_score, published, superseded_by, evaluated_by, evaluated_at
       from vergleich.product_evaluations
       where product_id = $1 order by evaluated_at desc`,
      [productId],
    )
    const evalRows = evals.rows
      .map(
        (e) => `<tr><td class="muted">${String(e.id).slice(0, 8)}…</td>
        <td>${e.total_score}</td>
        <td>${e.published ? 'publiziert' : 'Entwurf'}${e.superseded_by ? ' · abgelöst' : ''}</td>
        <td>${esc(e.evaluated_by)}</td>
        <td>${new Date(e.evaluated_at).toLocaleDateString('de-DE')}</td>
        <td>${
          !e.published
            ? `<form method="post" action="/admin/vergleich/bewertung/${e.id}/publish" style="display:inline">
                 <button type="submit">Publizieren</button></form>`
            : ''
        }</td></tr>`,
      )
      .join('')

    const criteria = schema.rowCount
      ? (schema.rows[0].criteria as Criterion[])
      : []
    const previewHtml = preview
      ? 'error' in preview
        ? `<div class="error">${esc(preview.error)}</div>`
        : `<div class="score"><strong>Preview: ${preview.totalScore}</strong>
           <pre>${esc(JSON.stringify(preview.scores, null, 2))}</pre></div>`
      : ''

    reply.type('text/html').send(
      layout(
        p.name,
        `<h1>${esc(p.name)}</h1>
         <p class="muted">${esc(p.manufacturer)} · Kategorie ${esc(p.category_name)} · ${esc(p.status)}</p>
         <fieldset><legend>attributes (Fakten)</legend>
         <form method="post" action="/admin/vergleich/produkt/${p.id}/attributes">
           <textarea name="attributes">${esc(JSON.stringify(p.attributes, null, 2))}</textarea>
           <button type="submit">Speichern</button>
         </form></fieldset>
         <h2>Bewertungen</h2>
         <table><tr><th>ID</th><th>Score</th><th>Status</th><th>Von</th><th>Am</th><th></th></tr>${evalRows}</table>
         ${
           schema.rowCount
             ? `<fieldset><legend>Neue Bewertung (Methodik v${schema.rows[0].version})</legend>
                ${previewHtml}
                <form method="post" action="/admin/vergleich/produkt/${p.id}/bewertung">
                  <input type="hidden" name="schema_id" value="${esc(schema.rows[0].id)}">
                  <table>${criteria.map(criterionInput).join('')}</table>
                  <p><input name="evaluated_by" placeholder="Bewertet von (E-Mail)" required size="32"></p>
                  <p><label>Belege (JSON-Array, optional):</label>
                     <textarea name="evidence">[]</textarea></p>
                  <button type="submit" name="action" value="preview">Preview-Score</button>
                  <button type="submit" name="action" value="save">Speichern (unpubliziert)</button>
                </form></fieldset>`
             : '<p class="error">Kein aktives Bewertungsschema für diese Kategorie.</p>'
         }`,
      ),
    )
  }

  app.get<{ Params: { id: string } }>(
    '/admin/vergleich/produkt/:id',
    async (req, reply) => renderProduct(req.params.id, reply),
  )

  app.post<{ Params: { id: string }; Body: FormBody }>(
    '/admin/vergleich/produkt/:id/attributes',
    async (req, reply) => {
      let attributes: unknown
      try {
        attributes = JSON.parse(req.body.attributes || '{}')
      } catch {
        return reply.status(400).send('attributes ist kein gültiges JSON.')
      }
      await getPool().query(
        'update vergleich.products set attributes = $2::jsonb where id = $1',
        [req.params.id, JSON.stringify(attributes)],
      )
      return reply.redirect(`/admin/vergleich/produkt/${req.params.id}`, 303)
    },
  )

  app.post<{ Params: { id: string }; Body: FormBody }>(
    '/admin/vergleich/produkt/:id/bewertung',
    async (req, reply) => {
      const b = req.body
      const criteria = await loadCriteria(b.schema_id ?? '')
      if (!criteria) return reply.status(400).send('Schema unbekannt.')
      const { raws, notes } = parseRaws(criteria, b)
      let evidence: unknown[] = []
      try {
        evidence = JSON.parse(b.evidence || '[]')
      } catch {
        return renderProduct(req.params.id, reply, {
          error: 'Belege sind kein gültiges JSON-Array.',
        })
      }
      try {
        const result = evaluate(criteria, raws, notes)
        if (b.action === 'save') {
          if (!b.evaluated_by) {
            return renderProduct(req.params.id, reply, {
              error: '"Bewertet von" ist erforderlich.',
            })
          }
          await insertEvaluation(
            req.params.id,
            b.schema_id as string,
            result,
            b.evaluated_by,
            evidence,
          )
          return reply.redirect(`/admin/vergleich/produkt/${req.params.id}`, 303)
        }
        return renderProduct(req.params.id, reply, result)
      } catch (err) {
        if (err instanceof ScoringError) {
          return renderProduct(req.params.id, reply, { error: err.message })
        }
        throw err
      }
    },
  )

  app.post<{ Params: { id: string } }>(
    '/admin/vergleich/bewertung/:id/publish',
    async (req, reply) => {
      const { rows } = await getPool().query(
        'select product_id from vergleich.product_evaluations where id = $1',
        [req.params.id],
      )
      if (!rows[0]) return reply.status(404).send('Bewertung unbekannt.')
      await publishEvaluation(req.params.id)
      return reply.redirect(`/admin/vergleich/produkt/${rows[0].product_id}`, 303)
    },
  )
}

// Seed für lokale Entwicklung (Schritte 1.1/1.3):
// 1 Admin, 1 Redakteur, 1 Arzt mit Medic-Profil, 2 Kategorien,
// 1 Beispielartikel in_arbeit sowie 1 publizierter Artikel (läuft
// regulär durch Arzt-Freigabe + Publish-Gate — nie daran vorbei).
// Idempotent: vorhandene Datensätze werden übersprungen/ergänzt.
// Ausführen: pnpm seed
import { getPayload } from 'payload'

import config from './payload.config'
import type { User } from './payload-types'

type LexicalText = { type: 'text'; text: string; version: 1 }
type LexicalNode = { type: string; version: number; [k: string]: unknown }

const text = (t: string): LexicalText => ({ type: 'text', text: t, version: 1 })

const paragraph = (t: string): LexicalNode => ({
  type: 'paragraph',
  version: 1,
  children: [text(t)],
})

const heading = (tag: 'h2' | 'h3', t: string): LexicalNode => ({
  type: 'heading',
  tag,
  version: 1,
  children: [text(t)],
})

const tableCell = (t: string, header: boolean): LexicalNode => ({
  type: 'tablecell',
  headerState: header ? 1 : 0,
  version: 1,
  children: [paragraph(t)],
})

const tableRow = (cells: string[], header = false): LexicalNode => ({
  type: 'tablerow',
  version: 1,
  children: cells.map((c) => tableCell(c, header)),
})

const evidenceTable: LexicalNode = {
  type: 'table',
  version: 1,
  children: [
    tableRow(['Endpunkt', 'Effektstärke', 'Studienlage', 'Evidenzgrad'], true),
    tableRow([
      'Knochengesundheit bei Mangel',
      'moderat',
      'Meta-Analysen, RCTs',
      'hoch',
    ]),
    tableRow([
      'Zusatznutzen ohne Mangel',
      'nicht nachweisbar',
      'Meta-Analysen',
      'hoch',
    ]),
  ],
}

const richText = (children: LexicalNode[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: null,
    children,
  },
})

const run = async (): Promise<void> => {
  const payload = await getPayload({ config })

  const ensureUser = async (
    email: string,
    role: 'admin' | 'redaktion' | 'arzt',
    name: string,
    qualification?: string,
    medicProfile?: number,
    slug?: string,
  ): Promise<User> => {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
    })
    const found = existing.docs[0]
    if (found) {
      if (!found.name || (slug && !found.slug)) {
        // Nachziehen für Bestände aus früheren Seed-Ständen
        return payload.update({
          collection: 'users',
          id: found.id,
          data: { name, qualification, slug },
        })
      }
      console.log(`vorhanden: ${email}`)
      return found
    }
    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password: 'changeme!42',
        role,
        name,
        qualification,
        medicProfile,
        slug,
      },
    })
    console.log(`angelegt: ${email} (${role})`)
    return user
  }

  // Arztprofil
  let medic = (
    await payload.find({
      collection: 'medics',
      where: { name: { equals: 'Dr. med. Erika Beispiel' } },
    })
  ).docs[0]
  if (!medic) {
    medic = await payload.create({
      collection: 'medics',
      data: {
        name: 'Dr. med. Erika Beispiel',
        slug: 'erika-beispiel',
        title: 'Dr. med.',
        specialty: 'Laboratoriumsmedizin',
        bio: 'Beispielprofil für die lokale Entwicklung.',
        practiceUrl: 'https://praxis.example',
      },
    })
    console.log('angelegt: Medic-Profil Dr. med. Erika Beispiel')
  } else if (!medic.slug) {
    medic = await payload.update({
      collection: 'medics',
      id: medic.id,
      data: { slug: 'erika-beispiel', practiceUrl: 'https://praxis.example' },
    })
  }

  const admin = await ensureUser(
    'admin@example.com',
    'admin',
    'Alex Admin',
    'Technische Leitung',
  )
  const redakteur = await ensureUser(
    'redaktion@example.com',
    'redaktion',
    'Rena Redaktion',
    'Wissenschaftsredakteurin',
    undefined,
    'rena-redaktion',
  )
  const arzt = await ensureUser(
    'arzt@example.com',
    'arzt',
    'Erika Beispiel',
    'Fachärztin für Laboratoriumsmedizin',
    medic.id,
  )

  // Service-User für den Frontend-Build (API-Key, nur lokale Dev-DB —
  // auf Staging/Prod den Key im Admin-UI erzeugen und als
  // PAYLOAD_API_TOKEN setzen)
  const buildUserEmail = 'build@example.com'
  const existingBuildUser = await payload.find({
    collection: 'users',
    where: { email: { equals: buildUserEmail } },
  })
  if (!existingBuildUser.docs[0]) {
    await payload.create({
      collection: 'users',
      data: {
        email: buildUserEmail,
        password: 'changeme!42',
        role: 'redaktion',
        name: 'Build-Service',
        enableAPIKey: true,
        apiKey: 'dev-build-key-0000-0000-000000000000',
      },
    })
    console.log(`angelegt: ${buildUserEmail} (Service-User mit API-Key)`)
  }

  // Kategorien
  const ensureCategory = async (name: string, slug: string) => {
    const existing = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
    })
    if (existing.docs[0]) return existing.docs[0]
    const cat = await payload.create({
      collection: 'categories',
      data: { name, slug },
    })
    console.log(`angelegt: Kategorie ${name}`)
    return cat
  }
  const vitaminD = await ensureCategory('Vitamin D', 'vitamin-d')
  await ensureCategory('Eisbaden', 'eisbaden')

  // Beispielartikel 1: Draft, in_arbeit (Schritt 1.1)
  const draftSlug = 'vitamin-d-wirkung'
  const existingDraft = await payload.find({
    collection: 'articles',
    where: { slug: { equals: draftSlug } },
    draft: true,
  })
  if (!existingDraft.docs[0]) {
    await payload.create({
      collection: 'articles',
      draft: true,
      data: {
        title: 'Was ist dran an Vitamin D?',
        slug: draftSlug,
        category: vitaminD.id,
        author: redakteur.id,
        kernaussage:
          'Beispiel-Kernaussage: Für Erwachsene mit nachgewiesenem Mangel ' +
          '(25(OH)D unter 30 nmol/l) ist eine Supplementierung sinnvoll. ' +
          'Stand: Juli 2026, Evidenzgrad: hoch.',
        evidenzgrad: 'hoch',
        content: richText([
          paragraph(
            'Entwurfstext für die lokale Entwicklung — wird redaktionell ersetzt.',
          ),
        ]),
        messgroesse: {
          biomarker: '25(OH)D',
          referenzbereich: '75–125 nmol/l',
          intervall: 'Re-Test nach ~12 Wochen',
        },
        review: { status: 'in_arbeit' },
      },
    })
    console.log(`angelegt: Artikel "${draftSlug}" (Draft, in_arbeit)`)
  }

  // Beispielartikel 2: läuft regulär durch Freigabe + Publish-Gate
  // (Platzhalterinhalt für die Frontend-Anbindung, Schritt 1.3)
  const publishedSlug = 'vitamin-d-studienlage'
  const existingPublished = await payload.find({
    collection: 'articles',
    where: { slug: { equals: publishedSlug } },
    draft: true,
  })
  if (!existingPublished.docs[0]) {
    const article = await payload.create({
      collection: 'articles',
      draft: true,
      user: redakteur,
      data: {
        title: 'Vitamin D supplementieren: Was sagt die Studienlage?',
        slug: publishedSlug,
        category: vitaminD.id,
        author: redakteur.id,
        kernaussage:
          'Bei einem gemessenen 25(OH)D-Spiegel unter 30 nmol/l gilt eine ' +
          'Vitamin-D-Supplementierung als evidenzbasiert sinnvoll; oberhalb ' +
          'von 75 nmol/l zeigt die Studienlage keinen belegten Zusatznutzen. ' +
          'Ohne Messung ist eine Hochdosis-Supplementierung nicht ' +
          'empfehlenswert. Stand: Juli 2026, Evidenzgrad: hoch (Meta-Analysen).',
        evidenzgrad: 'hoch',
        content: richText([
          heading('h2', 'Für wen ist das relevant?'),
          paragraph(
            'Relevant für Erwachsene in Mitteleuropa mit wenig ' +
              'Sonnenexposition, insbesondere in den Wintermonaten. ' +
              'Schwangere sowie Personen mit Nierenerkrankungen oder ' +
              'Kortison-Dauertherapie klären Dosierungen ärztlich ab. ' +
              '(Platzhalterinhalt aus dem Seed, nicht redaktionell geprüft.)',
          ),
          heading('h2', 'Wann ist eine Supplementierung sinnvoll?'),
          paragraph(
            'Eine Supplementierung ist sinnvoll, wenn ein gemessener ' +
              '25(OH)D-Wert unter 30 nmol/l liegt. Meta-Analysen zeigen ' +
              'für diese Gruppe moderate Effekte auf die Knochengesundheit.',
          ),
          heading('h2', 'Was zeigt die Evidenz im Überblick?'),
          evidenceTable,
          heading('h2', 'Wie überprüft man die Wirkung?'),
          paragraph(
            'Die Wirkung überprüft man über den 25(OH)D-Serumwert: ' +
              'Ausgangswert messen, bei Mangel supplementieren, nach etwa ' +
              'zwölf Wochen erneut messen.',
          ),
        ]),
        faq: [
          {
            frage: 'Kann man Vitamin D überdosieren?',
            antwort:
              'Ja, bei dauerhaft sehr hohen Dosen. Auch deshalb gilt: erst messen, dann dosieren.',
          },
          {
            frage: 'Brauche ich im Sommer ein Präparat?',
            antwort:
              'Bei regelmäßigem Aufenthalt im Freien meist nicht. Verlässlich beantwortet das nur der gemessene Wert.',
          },
          {
            frage: 'Gibt es Wechselwirkungen mit Kortison?',
            antwort:
              'Kortison kann den Vitamin-D-Stoffwechsel beeinflussen; die Dosierung gehört in ärztliche Begleitung.',
          },
        ],
        messgroesse: {
          biomarker: '25(OH)D',
          referenzbereich: '75–125 nmol/l',
          intervall: 'Re-Test nach ~12 Wochen',
        },
        sources: [
          { citation: 'Platzhalter Meta-Analyse (2024)', refType: 'doi', ref: '10.0000/platzhalter-1' },
          { citation: 'Platzhalter Leitlinie (2023)', refType: 'url', ref: 'https://example.org/leitlinie' },
          { citation: 'Platzhalter RCT (2022)', refType: 'pubmed', ref: '00000001' },
          { citation: 'Platzhalter Kohortenstudie (2021)', refType: 'pubmed', ref: '00000002' },
          { citation: 'Platzhalter Übersichtsarbeit (2024)', refType: 'doi', ref: '10.0000/platzhalter-2' },
        ],
        review: { status: 'redaktionell_fertig' },
      },
    })
    // Regulärer Weg: Arzt gibt frei, Admin publiziert (Gate bleibt aktiv)
    await payload.update({
      collection: 'articles',
      id: article.id,
      draft: true,
      user: { ...arzt, collection: 'users' },
      data: { review: { status: 'medizinisch_geprueft' } },
    })
    await payload.update({
      collection: 'articles',
      id: article.id,
      user: { ...admin, collection: 'users' },
      data: { _status: 'published' },
    })
    console.log(`angelegt: Artikel "${publishedSlug}" (publiziert)`)
  }

  // Beispiel-Podcast-Episode, verknüpft mit dem publizierten Artikel
  const existingEpisode = await payload.find({
    collection: 'podcast-episodes',
    where: { episodeNumber: { equals: 1 } },
  })
  if (!existingEpisode.docs[0]) {
    const published = await payload.find({
      collection: 'articles',
      where: { slug: { equals: publishedSlug } },
    })
    await payload.create({
      collection: 'podcast-episodes',
      data: {
        title: 'Was ist dran an Vitamin D?',
        episodeNumber: 1,
        podigeeEpisodeId: 'platzhalter-episode-1',
        publishDate: '2026-06-15T06:00:00.000Z',
        showNotes: richText([
          paragraph(
            'Platzhalter-Shownotes: Worum es in der Folge geht, mit den ' +
              'wichtigsten Zahlen und dem Verweis auf den Wissensartikel.',
          ),
        ]),
        transcript: [
          {
            speaker: 'MATTHIAS',
            text: 'Platzhalter-Transkript: Heute schauen wir uns an, was die Studienlage zu Vitamin D hergibt.',
          },
          {
            speaker: 'RUTH',
            text: 'Und wie immer endet das Thema in einer Messgröße — beim 25(OH)D-Wert.',
          },
        ],
        relatedArticles: published.docs[0] ? [published.docs[0].id] : [],
        category: vitaminD.id,
      },
    })
    console.log('angelegt: Podcast-Episode 1')
  }

  // Newsletter-Global: sicherstellen, dass die Default-Texte
  // persistiert sind (Frontend liest das Global zur Build-Zeit)
  const newsletter = await payload.findGlobal({ slug: 'newsletter-settings' })
  if (!newsletter.datenschutzhinweis) {
    await payload.updateGlobal({
      slug: 'newsletter-settings',
      data: {
        heading: 'Der Newsletter zum Podcast',
        intro:
          'Neue Folgen, neue Artikel und was sich an der Studienlage ' +
          'geändert hat — per E-Mail, ohne Umwege.',
        datenschutzhinweis:
          'Anmeldung mit Double-Opt-in; Abmeldung jederzeit über den Link ' +
          'in jeder E-Mail. Gespeichert werden die E-Mail-Adresse und das ' +
          'Themeninteresse der Seite, über die die Anmeldung erfolgte — ' +
          'keine weiteren Daten. Details in der Datenschutzerklärung.',
      },
    })
    console.log('angelegt: Newsletter-Global')
  }

  console.log('Seed abgeschlossen.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

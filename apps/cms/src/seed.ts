// Seed für lokale Entwicklung (Schritt 1.1):
// 1 Admin, 1 Redakteur, 1 Arzt mit Medic-Profil, 2 Kategorien,
// 1 Beispielartikel im Status in_arbeit. Idempotent: vorhandene
// Datensätze (per E-Mail/Slug) werden übersprungen.
// Ausführen: pnpm seed  (=> payload run src/seed.ts)
import { getPayload } from 'payload'

import config from './payload.config'

const richTextParagraph = (text: string) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: null,
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [{ type: 'text', text, version: 1 }],
      },
    ],
  },
})

const run = async (): Promise<void> => {
  const payload = await getPayload({ config })

  const ensureUser = async (
    email: string,
    role: 'admin' | 'redaktion' | 'arzt',
    medicProfile?: number,
  ) => {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
    })
    if (existing.docs[0]) {
      console.log(`vorhanden: ${email}`)
      return existing.docs[0]
    }
    const user = await payload.create({
      collection: 'users',
      data: { email, password: 'changeme!42', role, medicProfile },
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
        title: 'Dr. med.',
        specialty: 'Laboratoriumsmedizin',
        bio: 'Beispielprofil für die lokale Entwicklung.',
      },
    })
    console.log('angelegt: Medic-Profil Dr. med. Erika Beispiel')
  }

  await ensureUser('admin@example.com', 'admin')
  const redakteur = await ensureUser('redaktion@example.com', 'redaktion')
  await ensureUser('arzt@example.com', 'arzt', medic.id)

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

  // Beispielartikel (Draft, in_arbeit)
  const slug = 'vitamin-d-wirkung'
  const existingArticle = await payload.find({
    collection: 'articles',
    where: { slug: { equals: slug } },
    draft: true,
  })
  if (!existingArticle.docs[0]) {
    await payload.create({
      collection: 'articles',
      draft: true,
      data: {
        title: 'Was ist dran an Vitamin D?',
        slug,
        category: vitaminD.id,
        author: redakteur.id,
        kernaussage:
          'Beispiel-Kernaussage: Für Erwachsene mit nachgewiesenem Mangel ' +
          '(25(OH)D unter 30 nmol/l) ist eine Supplementierung sinnvoll. ' +
          'Stand: Juli 2026, Evidenzgrad: hoch.',
        evidenzgrad: 'hoch',
        content: richTextParagraph(
          'Entwurfstext für die lokale Entwicklung — wird redaktionell ersetzt.',
        ),
        messgroesse: {
          biomarker: '25(OH)D',
          referenzbereich: '75–125 nmol/l',
          intervall: 'Re-Test nach ~12 Wochen',
        },
        review: { status: 'in_arbeit' },
      },
    })
    console.log(`angelegt: Artikel "${slug}" (Draft, in_arbeit)`)
  }

  console.log('Seed abgeschlossen.')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})

// Integrationstests für den Review-Workflow (Schritt 1.1):
// (a) Redakteur kann nicht auf medizinisch_geprueft setzen
// (b) Arzt-Freigabe setzt reviewedBy/reviewDate serverseitig
// (c) Content-Änderung nach Freigabe resettet den Review-Status
// (d) Publish ohne Freigabe wirft Fehler (rote Linie: Publish-Gate)
// plus: Publish-Gate verlangt Kernaussage + min. 3 FAQ; Happy Path.
import config from '@payload-config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

type TestUser = { collection: 'users' } & Record<string, unknown>

let admin: TestUser
let redakteur: TestUser
let arzt: TestUser
let medicId: number
let categoryId: number

const richText = (text: string) => ({
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

const threeFaq = [
  { frage: 'Frage 1?', antwort: 'Antwort 1.' },
  { frage: 'Frage 2?', antwort: 'Antwort 2.' },
  { frage: 'Frage 3?', antwort: 'Antwort 3.' },
]

let articleCounter = 0
const createDraftArticle = async (
  overrides: Record<string, unknown> = {},
): Promise<string | number> => {
  articleCounter += 1
  const doc = await payload.create({
    collection: 'articles',
    draft: true,
    user: redakteur,
    data: {
      title: `Testartikel ${articleCounter}`,
      slug: `testartikel-${articleCounter}`,
      category: categoryId,
      author: redakteur.id as string | number,
      kernaussage: 'Kernaussage für Tests, kurz und in sich geschlossen.',
      evidenzgrad: 'hoch',
      content: richText('Testinhalt.'),
      faq: threeFaq,
      review: { status: 'redaktionell_fertig' },
      ...overrides,
    },
  })
  return doc.id
}

const approveAsArzt = (id: string | number) =>
  payload.update({
    collection: 'articles',
    id,
    draft: true,
    user: arzt,
    data: { review: { status: 'medizinisch_geprueft' } },
  })

beforeAll(async () => {
  payload = await getPayload({ config })

  const medic = await payload.create({
    collection: 'medics',
    data: { name: 'Dr. Test', specialty: 'Laboratoriumsmedizin' },
  })
  medicId = medic.id

  const mkUser = async (
    email: string,
    role: 'admin' | 'redaktion' | 'arzt',
    medicProfile?: string | number,
  ): Promise<TestUser> => {
    const doc = await payload.create({
      collection: 'users',
      data: { email, password: 'test-passwort-42', role, medicProfile },
    })
    // Local API erwartet req.user-Form inkl. collection
    const full = await payload.findByID({ collection: 'users', id: doc.id })
    return { ...full, collection: 'users' }
  }

  admin = await mkUser('admin@test.local', 'admin')
  redakteur = await mkUser('redaktion@test.local', 'redaktion')
  arzt = await mkUser('arzt@test.local', 'arzt', medicId)

  const category = await payload.create({
    collection: 'categories',
    data: { name: 'Testkategorie', slug: 'testkategorie' },
  })
  categoryId = category.id
})

afterAll(async () => {
  await payload.destroy()
})

describe('Review-Workflow', () => {
  it('(a) Redakteur kann nicht auf medizinisch_geprueft setzen', async () => {
    const id = await createDraftArticle()
    await expect(
      payload.update({
        collection: 'articles',
        id,
        draft: true,
        user: redakteur,
        data: { review: { status: 'medizinisch_geprueft' } },
      }),
    ).rejects.toThrow(/Rolle "arzt"/)
  })

  it('(b) Arzt-Freigabe setzt reviewedBy/reviewDate serverseitig', async () => {
    const id = await createDraftArticle()
    const updated = await approveAsArzt(id)
    expect(updated.review?.status).toBe('medizinisch_geprueft')
    const reviewedBy = updated.review?.reviewedBy
    const reviewedById =
      typeof reviewedBy === 'object' && reviewedBy !== null
        ? reviewedBy.id
        : reviewedBy
    expect(reviewedById).toBe(medicId)
    expect(updated.review?.reviewDate).toBeTruthy()
  })

  it('(b2) Client kann den Review-Stempel nicht unterschieben', async () => {
    const id = await createDraftArticle()
    const updated = await payload.update({
      collection: 'articles',
      id,
      draft: true,
      user: redakteur,
      data: {
        review: {
          status: 'redaktionell_fertig',
          reviewedBy: medicId,
          reviewDate: new Date().toISOString(),
        },
      },
    })
    expect(updated.review?.reviewedBy ?? null).toBeNull()
    expect(updated.review?.reviewDate ?? null).toBeNull()
  })

  it('(c) Content-Änderung nach Freigabe resettet den Review-Status', async () => {
    const id = await createDraftArticle()
    await approveAsArzt(id)
    const updated = await payload.update({
      collection: 'articles',
      id,
      draft: true,
      user: redakteur,
      data: { title: 'Geänderter Titel nach Freigabe' },
    })
    expect(updated.review?.status).toBe('redaktionell_fertig')
    expect(updated.review?.reviewedBy ?? null).toBeNull()
    expect(updated.review?.reviewDate ?? null).toBeNull()
  })

  it('(d) Publish ohne Freigabe wirft Fehler', async () => {
    const id = await createDraftArticle()
    await expect(
      payload.update({
        collection: 'articles',
        id,
        user: admin,
        data: { _status: 'published' },
      }),
    ).rejects.toThrow(/medizinischer Freigabe/)
  })

  it('Publish-Gate verlangt mindestens 3 FAQ-Einträge', async () => {
    const id = await createDraftArticle({ faq: threeFaq.slice(0, 2) })
    await approveAsArzt(id)
    await expect(
      payload.update({
        collection: 'articles',
        id,
        user: admin,
        data: { _status: 'published' },
      }),
    ).rejects.toThrow(/3 FAQ/)
  })

  it('Publish gelingt nach Freigabe mit Kernaussage und 3 FAQ', async () => {
    const id = await createDraftArticle()
    await approveAsArzt(id)
    const published = await payload.update({
      collection: 'articles',
      id,
      user: admin,
      data: { _status: 'published' },
    })
    expect(published._status).toBe('published')
    expect(published.lastFactCheck).toBeTruthy()
    expect(published.contentHash).toBeTruthy()
  })
})

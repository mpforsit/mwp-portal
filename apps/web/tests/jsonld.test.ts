// Validiert das erzeugte JSON-LD gegen JSON-Schema-Definitionen der
// Pflichtfelder aus Template Teil 2 (Umsetzungsplan 1.4).
import { describe, expect, it } from 'vitest'

import {
  articleNodes,
  buildGraph,
  medicPersonNodes,
  podcastEpisodeNodes,
  siteNodes,
  teamPersonNodes,
} from '../src/lib/jsonld'
import type { JsonSchema } from './json-schema'
import { validate } from './json-schema'

const siteUrl = 'https://portal.example'

const testArticle: Parameters<typeof articleNodes>[0] = {
  title: 'Vitamin D supplementieren: Was sagt die Studienlage?',
  slug: 'vitamin-d-studienlage',
  kernaussage:
    'Bei einem gemessenen 25(OH)D-Spiegel unter 30 nmol/l gilt eine ' +
    'Supplementierung als sinnvoll. Stand: Juli 2026, Evidenzgrad: hoch.',
  createdAt: '2026-05-10T09:00:00.000Z',
  updatedAt: '2026-07-02T10:00:00.000Z',
  lastFactCheck: '2026-07-02T10:00:00.000Z',
  author: {
    id: 2,
    name: 'Rena Redaktion',
    qualification: 'Wissenschaftsredakteurin',
    email: 'redaktion@example.com',
    role: 'redaktion',
    collection: 'users',
    updatedAt: '',
    createdAt: '',
  },
  category: {
    id: 1,
    name: 'Vitamin D',
    slug: 'vitamin-d',
    updatedAt: '',
    createdAt: '',
  },
  review: {
    status: 'medizinisch_geprueft',
    reviewDate: '2026-07-02T10:00:00.000Z',
    reviewedBy: {
      id: 1,
      name: 'Erika Beispiel',
      title: 'Dr. med.',
      specialty: 'Laboratoriumsmedizin',
      updatedAt: '',
      createdAt: '',
    },
  },
  faq: [
    { frage: 'Frage 1?', antwort: 'Antwort 1.' },
    { frage: 'Frage 2?', antwort: 'Antwort 2.' },
    { frage: 'Frage 3?', antwort: 'Antwort 3.' },
  ],
  sources: [
    { citation: 'Meta-Analyse (2024)', refType: 'doi', ref: '10.0000/x' },
    { citation: 'RCT (2022)', refType: 'pubmed', ref: '12345678' },
    { citation: 'Leitlinie (2023)', refType: 'url', ref: 'https://example.org' },
  ],
}

const graphSchema: JsonSchema = {
  type: 'object',
  required: ['@context', '@graph'],
  properties: {
    '@context': { const: 'https://schema.org' },
    '@graph': { type: 'array', minItems: 2 },
  },
}

const nodeSchemas: Record<string, JsonSchema> = {
  Organization: {
    type: 'object',
    required: ['@id', 'name', 'url'],
  },
  WebSite: {
    type: 'object',
    required: ['@id', 'name', 'url', 'publisher'],
    properties: {
      publisher: { type: 'object', required: ['@id'] },
    },
  },
  MedicalWebPage: {
    type: 'object',
    required: ['@id', 'url', 'name', 'isPartOf', 'lastReviewed', 'reviewedBy'],
    properties: {
      isPartOf: { type: 'object', required: ['@id'] },
      reviewedBy: { type: 'object', required: ['@id'] },
      about: { type: 'object', required: ['@type', 'name'] },
    },
  },
  Article: {
    type: 'object',
    required: [
      'headline',
      'description',
      'author',
      'publisher',
      'datePublished',
      'dateModified',
      'mainEntityOfPage',
    ],
    properties: {
      author: { type: 'object', required: ['@type', 'name'] },
      publisher: { type: 'object', required: ['@id'] },
      citation: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['@type', 'name', 'identifier'],
          properties: { '@type': { const: 'ScholarlyArticle' } },
        },
      },
    },
  },
  Person: {
    type: 'object',
    required: ['@id', 'name', 'jobTitle'],
  },
  FAQPage: {
    type: 'object',
    required: ['mainEntity'],
    properties: {
      mainEntity: {
        type: 'array',
        minItems: 3,
        items: {
          type: 'object',
          required: ['@type', 'name', 'acceptedAnswer'],
          properties: {
            acceptedAnswer: { type: 'object', required: ['@type', 'text'] },
          },
        },
      },
    },
  },
  BreadcrumbList: {
    type: 'object',
    required: ['itemListElement'],
    properties: {
      itemListElement: {
        type: 'array',
        minItems: 2,
        items: {
          type: 'object',
          required: ['@type', 'position', 'name', 'item'],
          properties: { position: { type: 'number' } },
        },
      },
    },
  },
}

describe('JSON-LD (Template Teil 2)', () => {
  const nodes = [
    ...siteNodes(siteUrl, 'Portal'),
    ...articleNodes(testArticle, siteUrl),
  ]
  const graph = buildGraph(nodes)

  it('Graph-Hülle entspricht dem Schema', () => {
    expect(validate(graphSchema, graph)).toEqual([])
  })

  it.each(Object.keys(nodeSchemas))('%s-Knoten erfüllt Pflichtfelder', (type) => {
    const node = nodes.find((n) => n['@type'] === type)
    expect(node, `Knoten ${type} fehlt im Graph`).toBeDefined()
    expect(validate(nodeSchemas[type] as JsonSchema, node)).toEqual([])
  })

  it('citation enthält nur DOI/PubMed-Quellen', () => {
    const article = nodes.find((n) => n['@type'] === 'Article') as {
      citation: { identifier: string }[]
    }
    expect(article.citation).toHaveLength(2)
    expect(article.citation.map((c) => c.identifier)).toEqual([
      'doi:10.0000/x',
      'pmid:12345678',
    ])
  })

  it('dateModified kommt aus dem CMS (lastFactCheck), nie aus dem Build', () => {
    const article = nodes.find((n) => n['@type'] === 'Article') as {
      dateModified: string
      datePublished: string
    }
    expect(article.dateModified).toBe('2026-07-02')
    expect(article.datePublished).toBe('2026-05-10')
  })

  it('Reviewer-Name verdoppelt den Titel nicht', () => {
    const withTitleInName = articleNodes(
      {
        ...testArticle,
        review: {
          ...testArticle.review,
          reviewedBy: {
            id: 1,
            name: 'Dr. med. Erika Beispiel',
            title: 'Dr. med.',
            specialty: 'Laboratoriumsmedizin',
            updatedAt: '',
            createdAt: '',
          },
        },
      },
      siteUrl,
    )
    const person = withTitleInName.find((n) => n['@type'] === 'Person')
    expect(person?.name).toBe('Dr. med. Erika Beispiel')
  })

  it('ohne Freigabe: kein Reviewer-Knoten, kein lastReviewed', () => {
    const unreviewed = articleNodes(
      { ...testArticle, review: { status: 'in_arbeit' } },
      siteUrl,
    )
    expect(unreviewed.find((n) => n['@type'] === 'Person')).toBeUndefined()
    const page = unreviewed.find((n) => n['@type'] === 'MedicalWebPage')
    expect(page?.lastReviewed).toBeUndefined()
    expect(page?.reviewedBy).toBeUndefined()
  })
})

describe('Person-Seiten (Template 2.7)', () => {
  const personSchema: JsonSchema = {
    type: 'object',
    required: ['@id', 'name', 'jobTitle', 'url'],
    properties: {
      sameAs: { type: 'array', minItems: 1 },
      affiliation: { type: 'object', required: ['@id'] },
    },
  }

  it('Beirats-Person erfüllt Pflichtfelder inkl. honorificPrefix/sameAs', () => {
    const [person] = medicPersonNodes(
      {
        name: 'Erika Beispiel',
        slug: 'erika-beispiel',
        title: 'Dr. med.',
        specialty: 'Laboratoriumsmedizin',
        practiceUrl: 'https://praxis.example',
      },
      siteUrl,
    )
    expect(validate(personSchema, person)).toEqual([])
    expect(person?.honorificPrefix).toBe('Dr. med.')
    expect(person?.url).toBe(`${siteUrl}/beirat/erika-beispiel/`)
    expect(person?.sameAs).toEqual(['https://praxis.example'])
  })

  it('Team-Person erfüllt Pflichtfelder und referenziert die Organization', () => {
    const [person] = teamPersonNodes(
      {
        name: 'Rena Redaktion',
        slug: 'rena-redaktion',
        qualification: 'Wissenschaftsredakteurin',
      },
      siteUrl,
    )
    expect(validate(personSchema, person)).toEqual([])
    expect(person?.affiliation).toEqual({ '@id': `${siteUrl}/#org` })
  })

  it('PodcastEpisode erfüllt Template 2.5', () => {
    const episodeSchema: JsonSchema = {
      type: 'object',
      required: ['name', 'episodeNumber', 'datePublished', 'partOfSeries'],
      properties: {
        episodeNumber: { type: 'number' },
        partOfSeries: {
          type: 'object',
          required: ['@type', 'name', 'url'],
          properties: { '@type': { const: 'PodcastSeries' } },
        },
        associatedMedia: {
          type: 'object',
          required: ['@type', 'contentUrl'],
          properties: { '@type': { const: 'AudioObject' } },
        },
        transcript: { type: 'string' },
      },
    }
    const [node] = podcastEpisodeNodes(
      {
        title: 'Was ist dran an Vitamin D?',
        episodeNumber: 1,
        publishDate: '2026-06-15T06:00:00.000Z',
        audioUrl: 'https://cdn.podigee.example/folge-1.mp3',
        transcript: [
          { speaker: 'MATTHIAS', text: 'Erster Satz.' },
          { speaker: 'RUTH', text: 'Zweiter Satz.' },
        ],
      },
      'Was ist dran an …?',
      siteUrl,
    )
    expect(validate(episodeSchema, node)).toEqual([])
    expect(node?.datePublished).toBe('2026-06-15')
    expect(node?.transcript).toBe(
      'MATTHIAS: Erster Satz.\nRUTH: Zweiter Satz.',
    )
  })

  it('Artikel-Graph verlinkt Autor- und Reviewer-URL, wenn Slugs existieren', () => {
    const nodesWithSlugs = articleNodes(
      {
        ...testArticle,
        author: { ...(testArticle.author as object), slug: 'rena-redaktion' } as never,
        review: {
          ...testArticle.review,
          reviewedBy: {
            id: 1,
            name: 'Erika Beispiel',
            title: 'Dr. med.',
            specialty: 'Laboratoriumsmedizin',
            slug: 'erika-beispiel',
            updatedAt: '',
            createdAt: '',
          },
        },
      },
      siteUrl,
    )
    const art = nodesWithSlugs.find((n) => n['@type'] === 'Article') as {
      author: { url?: string }
    }
    expect(art.author.url).toBe(`${siteUrl}/team/rena-redaktion/`)
    const reviewer = nodesWithSlugs.find((n) => n['@type'] === 'Person')
    expect(reviewer?.url).toBe(`${siteUrl}/beirat/erika-beispiel/`)
  })
})

// JSON-LD-Graphen nach docs/artefakte/redaktions-template-geo-checkliste.md
// Teil 2. Reine Funktionen (Build-Time), gerendert über JsonLd.astro.
// Alle Werte kommen aus CMS-Feldern — nie aus dem Build-Zeitpunkt.
import { formatMedicName, type Article, type Medic, type User } from './payload'

export type JsonLdNode = Record<string, unknown>

const dateOnly = (iso: string | null | undefined): string | undefined =>
  iso ? iso.slice(0, 10) : undefined

const asObject = <T,>(value: T | number | null | undefined): T | null =>
  typeof value === 'object' && value !== null ? value : null

// --- Sitewide (Template 2.1): auf jeder Seite im @graph enthalten,
// von Seiten-Knoten per @id referenziert -----------------------------
export const siteNodes = (siteUrl: string, siteName: string): JsonLdNode[] => [
  {
    '@type': 'Organization',
    '@id': `${siteUrl}/#org`,
    name: siteName,
    url: `${siteUrl}/`,
    // TODO nach Launch pflegen: logo, sameAs (Wikidata, LinkedIn,
    // Spotify), publishingPrinciples → /methodik/redaktionelle-leitlinien
  },
  {
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: siteName,
    url: `${siteUrl}/`,
    publisher: { '@id': `${siteUrl}/#org` },
    inLanguage: 'de',
  },
]

// --- Wissensartikel (Template 2.2):
// MedicalWebPage + Article + Person-Reviewer + FAQPage + BreadcrumbList
export const articleNodes = (
  article: Pick<
    Article,
    | 'title'
    | 'slug'
    | 'kernaussage'
    | 'faq'
    | 'sources'
    | 'createdAt'
    | 'updatedAt'
    | 'lastFactCheck'
    | 'review'
    | 'author'
    | 'category'
  >,
  siteUrl: string,
): JsonLdNode[] => {
  const pageUrl = `${siteUrl}/wissen/${article.slug}/`
  const author = asObject(article.author)
  const category = asObject(article.category)
  const reviewedBy = asObject(article.review?.reviewedBy)
  const isReviewed =
    article.review?.status === 'medizinisch_geprueft' && reviewedBy !== null

  const citations = (article.sources ?? [])
    .filter((s) => s.refType === 'doi' || s.refType === 'pubmed')
    .map((s) => ({
      '@type': 'ScholarlyArticle',
      name: s.citation,
      identifier: s.refType === 'doi' ? `doi:${s.ref}` : `pmid:${s.ref}`,
    }))

  const medicalWebPage: JsonLdNode = {
    '@type': 'MedicalWebPage',
    '@id': `${pageUrl}#page`,
    url: pageUrl,
    name: article.title,
    isPartOf: { '@id': `${siteUrl}/#website` },
    ...(category ? { about: { '@type': 'MedicalEntity', name: category.name } } : {}),
    ...(isReviewed
      ? {
          lastReviewed: dateOnly(article.review?.reviewDate),
          reviewedBy: { '@id': `${pageUrl}#reviewer` },
        }
      : {}),
  }

  const articleNode: JsonLdNode = {
    '@type': 'Article',
    headline: article.title,
    description: article.kernaussage,
    author: {
      '@type': 'Person',
      name: author?.name ?? 'Redaktion',
      ...(author?.slug ? { url: `${siteUrl}/team/${author.slug}/` } : {}),
    },
    publisher: { '@id': `${siteUrl}/#org` },
    datePublished: dateOnly(article.createdAt),
    // dateModified = letzte inhaltliche Änderung (Hook setzt
    // lastFactCheck bei Anlage + Content-Änderung), nicht updatedAt —
    // sonst entwertet jeder Tippfehler-Save das Signal
    dateModified: dateOnly(article.lastFactCheck ?? article.updatedAt),
    ...(citations.length > 0 ? { citation: citations } : {}),
    mainEntityOfPage: { '@id': `${pageUrl}#page` },
  }

  const nodes: JsonLdNode[] = [medicalWebPage, articleNode]

  if (isReviewed && reviewedBy) {
    nodes.push({
      '@type': 'Person',
      '@id': `${pageUrl}#reviewer`,
      name: formatMedicName(reviewedBy),
      jobTitle: reviewedBy.specialty,
      ...(reviewedBy.slug
        ? { url: `${siteUrl}/beirat/${reviewedBy.slug}/` }
        : {}),
    })
  }

  const faq = article.faq ?? []
  if (faq.length > 0) {
    nodes.push({
      '@type': 'FAQPage',
      mainEntity: faq.map((entry) => ({
        '@type': 'Question',
        name: entry.frage,
        acceptedAnswer: { '@type': 'Answer', text: entry.antwort },
      })),
    })
  }

  nodes.push({
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Wissen',
        item: `${siteUrl}/wissen/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: article.title,
        item: pageUrl,
      },
    ],
  })

  return nodes
}

// --- Beirats-/Autorenseiten (Template 2.7): Person-Markup — die
// Entitäts-Anker, auf die reviewedBy/author zeigen --------------------
export const medicPersonNodes = (
  medic: Pick<Medic, 'name' | 'slug' | 'title' | 'specialty' | 'practiceUrl'>,
  siteUrl: string,
): JsonLdNode[] => {
  const pageUrl = `${siteUrl}/beirat/${medic.slug}/`
  return [
    {
      '@type': 'Person',
      '@id': `${pageUrl}#person`,
      name: formatMedicName(medic),
      ...(medic.title ? { honorificPrefix: medic.title } : {}),
      jobTitle: medic.specialty,
      url: pageUrl,
      ...(medic.practiceUrl ? { sameAs: [medic.practiceUrl] } : {}),
    },
  ]
}

export const teamPersonNodes = (
  user: Pick<User, 'name' | 'slug' | 'qualification'>,
  siteUrl: string,
): JsonLdNode[] => {
  const pageUrl = `${siteUrl}/team/${user.slug}/`
  return [
    {
      '@type': 'Person',
      '@id': `${pageUrl}#person`,
      name: user.name,
      ...(user.qualification ? { jobTitle: user.qualification } : {}),
      url: pageUrl,
      affiliation: { '@id': `${siteUrl}/#org` },
    },
  ]
}

export const buildGraph = (nodes: JsonLdNode[]): JsonLdNode => ({
  '@context': 'https://schema.org',
  '@graph': nodes,
})

// Build-Time-Anbindung an die Payload-REST-API (Schritt 1.3).
// Typen kommen aus den generierten Payload-Typen des CMS —
// keine parallelen Definitionen (CLAUDE.md).
import type { Article } from '../../../cms/src/payload-types'

export type { Article }

const apiUrl = import.meta.env.PAYLOAD_API_URL as string | undefined
// Build authentifiziert sich per API-Key eines Service-Users: nötig,
// damit Payload zugriffsgeschützte Relationen (z. B. Autor-Name für
// den Meta-Block) im Build populiert. Drafts rendern nur Staging-
// Builds mit PAYLOAD_DRAFT_PREVIEW=true
// (docs/adr/0001-draft-preview-als-staging-build.md).
const apiToken = import.meta.env.PAYLOAD_API_TOKEN as string | undefined
const draftPreview = import.meta.env.PAYLOAD_DRAFT_PREVIEW === 'true'

export const fetchArticles = async (): Promise<Article[]> => {
  if (!apiUrl) {
    console.warn(
      'PAYLOAD_API_URL ist nicht gesetzt — es werden keine Artikel gerendert.',
    )
    return []
  }

  const useDrafts = draftPreview && Boolean(apiToken)
  const headers: Record<string, string> = apiToken
    ? { Authorization: `users API-Key ${apiToken}` }
    : {}

  const articles: Article[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    const params = new URLSearchParams({
      depth: '2',
      limit: '50',
      page: String(page),
    })
    if (useDrafts) {
      params.set('draft', 'true')
    } else {
      params.set('where[_status][equals]', 'published')
    }
    const res = await fetch(`${apiUrl}/articles?${params}`, { headers })
    if (!res.ok) {
      throw new Error(
        `Payload-API antwortete mit ${res.status} für /articles (Build-Abbruch).`,
      )
    }
    const data = (await res.json()) as {
      docs: Article[]
      totalPages: number
    }
    articles.push(...data.docs)
    totalPages = data.totalPages
    page += 1
  }
  return articles
}

export const formatDate = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(
        new Date(iso),
      )
    : '—'

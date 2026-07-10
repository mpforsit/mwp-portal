// Build-Time-Anbindung an die Payload-REST-API (Schritte 1.3/1.5).
// Typen kommen aus den generierten Payload-Typen des CMS —
// keine parallelen Definitionen (CLAUDE.md).
import type {
  Article,
  Media,
  Medic,
  PodcastEpisode,
  User,
} from '../../../cms/src/payload-types'

export type { Article, Media, Medic, PodcastEpisode, User }

const apiUrl = import.meta.env.PAYLOAD_API_URL as string | undefined
// Build authentifiziert sich per API-Key eines Service-Users: nötig,
// damit Payload zugriffsgeschützte Relationen (z. B. Autor-Name für
// den Meta-Block) im Build populiert. Drafts rendern nur Staging-
// Builds mit PAYLOAD_DRAFT_PREVIEW=true
// (docs/adr/0001-draft-preview-als-staging-build.md).
const apiToken = import.meta.env.PAYLOAD_API_TOKEN as string | undefined
const draftPreview = import.meta.env.PAYLOAD_DRAFT_PREVIEW === 'true'

const fetchAll = async <T>(
  collection: string,
  extraParams: Record<string, string> = {},
): Promise<T[]> => {
  if (!apiUrl) {
    console.warn(
      `PAYLOAD_API_URL ist nicht gesetzt — ${collection} bleibt leer.`,
    )
    return []
  }
  const headers: Record<string, string> = apiToken
    ? { Authorization: `users API-Key ${apiToken}` }
    : {}

  const docs: T[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages) {
    const params = new URLSearchParams({
      depth: '2',
      limit: '50',
      page: String(page),
      ...extraParams,
    })
    const res = await fetch(`${apiUrl}/${collection}?${params}`, { headers })
    if (!res.ok) {
      throw new Error(
        `Payload-API antwortete mit ${res.status} für /${collection} (Build-Abbruch).`,
      )
    }
    const data = (await res.json()) as { docs: T[]; totalPages: number }
    docs.push(...data.docs)
    totalPages = data.totalPages
    page += 1
  }
  return docs
}

export const fetchArticles = async (): Promise<Article[]> => {
  const useDrafts = draftPreview && Boolean(apiToken)
  return fetchAll<Article>(
    'articles',
    useDrafts
      ? { draft: 'true' }
      : { 'where[_status][equals]': 'published' },
  )
}

export const fetchMedics = async (): Promise<Medic[]> => fetchAll<Medic>('medics')

export const fetchEpisodes = async (): Promise<PodcastEpisode[]> => {
  const episodes = await fetchAll<PodcastEpisode>('podcast-episodes')
  return episodes.sort((a, b) => b.episodeNumber - a.episodeNumber)
}

// Nur Accounts mit Slug haben eine öffentliche Team-Seite; die
// Users-Collection ist zugriffsgeschützt — ohne Build-Token leer.
export const fetchTeamMembers = async (): Promise<User[]> => {
  if (!apiToken) {
    console.warn('PAYLOAD_API_TOKEN fehlt — Team-Seiten bleiben leer.')
    return []
  }
  const users = await fetchAll<User>('users')
  return users.filter((user) => Boolean(user.slug) && Boolean(user.name))
}

// Media-URLs kommen relativ vom CMS; absolute URL fürs statische Frontend
export const mediaUrl = (
  media: Media | number | null | undefined,
): string | null => {
  if (typeof media !== 'object' || media === null || !media.url) return null
  if (media.url.startsWith('http')) return media.url
  const cmsOrigin = apiUrl?.replace(/\/api\/?$/, '') ?? ''
  return `${cmsOrigin}${media.url}`
}

// Titel nur voranstellen, wenn er nicht schon im Namen steht
// (Redaktionsdaten enthalten beides in freier Form)
export const formatMedicName = (medic: {
  title?: string | null
  name: string
}): string =>
  medic.title && !medic.name.startsWith(medic.title)
    ? `${medic.title} ${medic.name}`
    : medic.name

export const formatDate = (iso: string | null | undefined): string =>
  iso
    ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(
        new Date(iso),
      )
    : '—'

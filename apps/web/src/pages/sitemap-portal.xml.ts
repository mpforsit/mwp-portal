import type { APIRoute } from 'astro'
import { fetchEpisodes, fetchMedics, fetchTeamMembers } from '../lib/payload'
import { abs, urlsetXml, xmlResponse, type SitemapEntry } from '../lib/sitemap'

// Portal-Segment: Startseite, Podcast, Personen-/Rechtsseiten
export const GET: APIRoute = async () => {
  const [episodes, medics, team] = await Promise.all([
    fetchEpisodes(),
    fetchMedics(),
    fetchTeamMembers(),
  ])
  const entries: SitemapEntry[] = [
    { loc: abs('/') },
    { loc: abs('/podcast/') },
    ...episodes.map((e) => ({
      loc: abs(`/podcast/${e.episodeNumber}/`),
      lastmod: e.publishDate,
    })),
    { loc: abs('/beirat/') },
    ...medics
      .filter((m) => m.slug)
      .map((m) => ({ loc: abs(`/beirat/${m.slug}/`) })),
    ...team.map((u) => ({ loc: abs(`/team/${u.slug}/`) })),
    { loc: abs('/transparenz/') },
    { loc: abs('/datenschutz/') },
  ]
  return xmlResponse(urlsetXml(entries))
}

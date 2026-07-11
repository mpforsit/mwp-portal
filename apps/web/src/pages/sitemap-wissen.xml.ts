import type { APIRoute } from 'astro'
import { fetchArticles } from '../lib/payload'
import { abs, urlsetXml, xmlResponse } from '../lib/sitemap'

export const GET: APIRoute = async () => {
  const articles = await fetchArticles()
  return xmlResponse(
    urlsetXml([
      { loc: abs('/wissen/') },
      ...articles.map((a) => ({
        loc: abs(`/wissen/${a.slug}/`),
        lastmod: a.lastFactCheck ?? a.updatedAt,
      })),
    ]),
  )
}

import type { APIRoute } from 'astro'
import { abs, urlsetXml, xmlResponse } from '../lib/sitemap'
import { fetchComparisonCategories } from '../lib/vergleich'

export const GET: APIRoute = async () => {
  const categories = await fetchComparisonCategories()
  return xmlResponse(
    urlsetXml([
      { loc: abs('/vergleich/') },
      { loc: abs('/methodik/') },
      ...categories.map((c) => ({ loc: abs(`/vergleich/${c.slug}/`) })),
      ...categories.map((c) => ({ loc: abs(`/methodik/${c.slug}/`) })),
    ]),
  )
}

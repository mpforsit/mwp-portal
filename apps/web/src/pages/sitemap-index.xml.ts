import type { APIRoute } from 'astro'
import { indexXml, xmlResponse } from '../lib/sitemap'

export const GET: APIRoute = () =>
  xmlResponse(
    indexXml([
      '/sitemap-wissen.xml',
      '/sitemap-vergleich.xml',
      '/sitemap-messen.xml',
      '/sitemap-portal.xml',
    ]),
  )

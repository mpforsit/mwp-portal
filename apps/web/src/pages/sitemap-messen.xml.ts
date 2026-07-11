import type { APIRoute } from 'astro'
import { abs, urlsetXml, xmlResponse } from '../lib/sitemap'

// Messgrößen-Erklärseiten kommen mit Phase 3 dazu
export const GET: APIRoute = () =>
  xmlResponse(
    urlsetXml([
      { loc: abs('/messen/') },
      { loc: abs('/messen/praxisfinder/') },
    ]),
  )

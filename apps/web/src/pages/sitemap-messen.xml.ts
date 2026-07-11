import type { APIRoute } from 'astro'
import { abs, urlsetXml, xmlResponse } from '../lib/sitemap'

// Messgrößen-/Praxisfinder-Seiten kommen mit Phase 2/3 dazu
export const GET: APIRoute = () =>
  xmlResponse(urlsetXml([{ loc: abs('/messen/') }]))

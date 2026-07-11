import type { APIRoute } from 'astro'
import { abs, urlsetXml, xmlResponse } from '../lib/sitemap'

// Vergleichsseiten kommen mit Phase 2 aus der Vergleichs-Engine dazu
export const GET: APIRoute = () =>
  xmlResponse(urlsetXml([{ loc: abs('/vergleich/') }]))

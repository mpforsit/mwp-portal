// XML-Sitemaps (Schritt 1.9): Build-Time, nach Zonen segmentiert.
// robots.txt verweist auf /sitemap-index.xml.
import { SITE_URL } from './site'

export type SitemapEntry = { loc: string; lastmod?: string | null }

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const entryXml = ({ loc, lastmod }: SitemapEntry): string =>
  `<url><loc>${escapeXml(loc)}</loc>${
    lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''
  }</url>`

export const urlsetXml = (entries: SitemapEntry[]): string =>
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  entries.map(entryXml).join('') +
  '</urlset>'

export const indexXml = (sitemaps: string[]): string =>
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  sitemaps
    .map((path) => `<sitemap><loc>${escapeXml(`${SITE_URL}${path}`)}</loc></sitemap>`)
    .join('') +
  '</sitemapindex>'

export const abs = (path: string): string => `${SITE_URL}${path}`

export const xmlResponse = (xml: string): Response =>
  new Response(xml, { headers: { 'content-type': 'application/xml' } })

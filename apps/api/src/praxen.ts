// Praxisfinder-API (Schritt 2.8): GET /api/praxen?plz=&leistung=
// Geocoding der PLZ über Nominatim mit Cache-Tabelle, Umkreissuche
// sortiert nach Distanz. Rote Linie: KEINE Bevorzugung von
// Partnerpraxen in der Sortierung — das partner-Flag ist reine
// Kennzeichnung im Response.
import type { FastifyInstance } from 'fastify'

import { getPool } from './db.js'

const PLZ_PATTERN = /^\d{5}$/
const TAG_PATTERN = /^[a-z0-9-]{1,60}$/
const DEFAULT_RADIUS_KM = 50
const MAX_RADIUS_KM = 200

export type Practice = {
  id: string
  name: string
  street: string | null
  zip: string
  city: string
  services: string[]
  partner: boolean
  website: string | null
  phone: string | null
  openingHours: string | null
  distanceKm: number
  lat: number
  lon: number
}

export type PraxenResponse = {
  origin: { zip: string; lat: number; lon: number }
  radiusKm: number
  practices: Practice[]
}

export const geocodePlz = async (
  zip: string,
): Promise<{ lat: number; lon: number } | null> => {
  const pool = getPool()
  const cached = await pool.query(
    'select lat, lon from praxen.geocode_cache where zip = $1',
    [zip],
  )
  if (cached.rows[0]) return cached.rows[0]

  const base =
    process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org'
  const params = new URLSearchParams({
    postalcode: zip,
    country: 'Deutschland',
    format: 'json',
    limit: '1',
  })
  const res = await fetch(`${base}/search?${params}`, {
    // Nominatim-Policy verlangt einen identifizierenden User-Agent
    headers: { 'user-agent': 'mwp-portal-praxisfinder/1.0' },
  })
  if (!res.ok) return null
  const results = (await res.json()) as { lat: string; lon: string }[]
  if (!results[0]) return null
  const lat = Number(results[0].lat)
  const lon = Number(results[0].lon)
  await pool.query(
    `insert into praxen.geocode_cache (zip, lat, lon) values ($1, $2, $3)
     on conflict (zip) do nothing`,
    [zip, lat, lon],
  )
  return { lat, lon }
}

export const registerPraxenRoutes = (app: FastifyInstance): void => {
  app.addHook('onSend', async (req, reply) => {
    if (req.url.startsWith('/api/praxen')) {
      reply.header('access-control-allow-origin', process.env.WEB_ORIGIN ?? '*')
      reply.header('access-control-allow-methods', 'GET')
    }
  })

  app.get<{ Querystring: { plz?: string; leistung?: string; radius?: string } }>(
    '/api/praxen',
    async (req, reply) => {
      const { plz, leistung } = req.query
      if (!plz || !PLZ_PATTERN.test(plz)) {
        return reply
          .status(400)
          .send({ ok: false, message: 'Bitte eine gültige PLZ (5 Ziffern) angeben.' })
      }
      if (leistung && !TAG_PATTERN.test(leistung)) {
        return reply
          .status(400)
          .send({ ok: false, message: 'Ungültiger Leistungs-Tag.' })
      }
      const radiusKm = Math.min(
        Number(req.query.radius) || DEFAULT_RADIUS_KM,
        MAX_RADIUS_KM,
      )

      const origin = await geocodePlz(plz)
      if (!origin) {
        return reply
          .status(404)
          .send({ ok: false, message: `PLZ ${plz} konnte nicht gefunden werden.` })
      }

      // Sortierung AUSSCHLIESSLICH nach Distanz (rote Linie) —
      // partner fließt nur als Kennzeichen in den Response
      const { rows } = await getPool().query(
        `select id, name, street, zip, city, services, partner, website,
                phone, opening_hours,
                st_y(location::geometry) as lat,
                st_x(location::geometry) as lon,
                st_distance(location, st_setsrid(st_makepoint($2, $1), 4326)::geography)
                  / 1000.0 as distance_km
         from praxen.practices
         where st_dwithin(
                 location,
                 st_setsrid(st_makepoint($2, $1), 4326)::geography,
                 $3 * 1000)
           and ($4::text is null or services @> array[$4::text])
         order by distance_km asc
         limit 50`,
        [origin.lat, origin.lon, radiusKm, leistung ?? null],
      )

      const response: PraxenResponse = {
        origin: { zip: plz, lat: origin.lat, lon: origin.lon },
        radiusKm,
        practices: rows.map((r) => ({
          id: r.id,
          name: r.name,
          street: r.street,
          zip: r.zip,
          city: r.city,
          services: r.services,
          partner: r.partner,
          website: r.website,
          phone: r.phone,
          openingHours: r.opening_hours,
          distanceKm: Math.round(Number(r.distance_km) * 10) / 10,
          lat: Number(r.lat),
          lon: Number(r.lon),
        })),
      }
      return reply.send(response)
    },
  )
}

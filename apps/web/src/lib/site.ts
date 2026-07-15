// Zentrale Site-Konstanten. SITE_URL kommt aus dem Environment
// (Staging: stage.my-well.com, Prod: my-well.com); der Fallback dient
// nur lokalen Builds ohne gesetzte Env.
export const SITE_NAME = 'myWell'

export const SITE_URL = (
  (import.meta.env?.SITE_URL as string | undefined) ?? 'https://my-well.com'
).replace(/\/$/, '')

export const PODCAST_SERIES_NAME = 'Was ist dran an …?'

// TODO nach Podcast-Launch: echte Verzeichnis-Links eintragen
export const PODCAST_SUBSCRIBE_LINKS = [
  { label: 'Spotify', href: 'https://open.spotify.com/show/PLATZHALTER' },
  {
    label: 'Apple Podcasts',
    href: 'https://podcasts.apple.com/de/podcast/PLATZHALTER',
  },
  { label: 'RSS', href: 'https://PLATZHALTER.podigee.io/feed/mp3' },
] as const

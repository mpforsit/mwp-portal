// Zentrale Site-Konstanten. SITE_URL kommt aus dem Environment
// (Staging/Prod unterschiedlich); der Portalname ist bis zur
// Naming-Entscheidung ein Platzhalter.
export const SITE_NAME = 'Portal'

export const SITE_URL = (
  (import.meta.env?.SITE_URL as string | undefined) ?? 'https://portal.example'
).replace(/\/$/, '')

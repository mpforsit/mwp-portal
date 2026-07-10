import type { CollectionConfig } from 'payload'

// Minimaler Auth-Träger für das Grundgerüst; Rollen (admin, redaktion,
// arzt) und Access-Regeln folgen in Schritt 1.1 gemäß Referenz-Artefakt.
export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [],
}

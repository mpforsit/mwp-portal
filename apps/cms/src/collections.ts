// =====================================================================
// Payload-Collections der Wissens-Zone.
// Referenz-Spezifikation: docs/artefakte/payload-collections.ts
// Erweiterungen gemäß Umsetzungsplan 1.1 + Redaktions-Template Tab. 1.2:
// Media-Collection, kernaussage, evidenzgrad, faq, messgroesse,
// lastFactCheck; contentHash umfasst kernaussage/faq/messgroesse;
// Publish-Gate verlangt zusätzlich Kernaussage + min. 3 FAQ.
// =====================================================================

import crypto from 'node:crypto'
import type { Access, CollectionConfig, FieldAccess } from 'payload'

// ------------------------------------------------------------------
// Access-Helfer
// ------------------------------------------------------------------
const isAdmin: Access = ({ req }) => req.user?.role === 'admin'

const isEditorOrAdmin: Access = ({ req }) =>
  ['admin', 'redaktion'].includes(req.user?.role ?? '')

const isLoggedIn: Access = ({ req }) => Boolean(req.user)

const publicReadPublished: Access = ({ req }) => {
  if (req.user) return true
  return { _status: { equals: 'published' } }
}

// Ärzte dürfen Inhaltsfelder nicht editieren – nur Review-Felder
const notArzt: FieldAccess = ({ req }) => req.user?.role !== 'arzt'

// ------------------------------------------------------------------
// Content-Hash über alle review-relevanten Felder
// (kernaussage, faq, messgroesse gehören dazu — Template Tab. 1.2)
// ------------------------------------------------------------------
const buildContentHash = (data: Record<string, unknown>): string =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        title: data.title,
        excerpt: data.excerpt,
        content: data.content,
        sources: data.sources,
        kernaussage: data.kernaussage,
        faq: data.faq,
        messgroesse: data.messgroesse,
      }),
    )
    .digest('hex')

// ------------------------------------------------------------------
// Users: interne Accounts mit Rollen
// ------------------------------------------------------------------
export const Users: CollectionConfig = {
  slug: 'users',
  // useAPIKey: Build-Server authentifiziert sich für Draft-Previews
  // (siehe docs/adr/0001-draft-preview-als-staging-build.md)
  auth: { useAPIKey: true },
  admin: { useAsTitle: 'email' },
  access: {
    read: isLoggedIn,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      // Anzeigename für den sichtbaren Meta-Block (Template Teil 1);
      // Ergänzung zum Referenz-Artefakt, siehe AGENT_LOG 1.3
      name: 'name',
      type: 'text',
    },
    {
      // "Autor mit Kurzqualifikation" (Template Teil 1)
      name: 'qualification',
      type: 'text',
      admin: { description: 'Kurzqualifikation, z. B. Wissenschaftsredakteurin' },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'redaktion',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Redaktion', value: 'redaktion' },
        { label: 'Arzt (Review)', value: 'arzt' },
      ],
      access: { update: ({ req }) => req.user?.role === 'admin' },
    },
    {
      // Verknüpfung zum öffentlichen Arztprofil (Pflicht für Rolle arzt)
      name: 'medicProfile',
      type: 'relationship',
      relationTo: 'medics',
      admin: { condition: (data) => data?.role === 'arzt' },
    },
  ],
}

// ------------------------------------------------------------------
// Media: Uploads (lokales Storage, WebP-Konvertierung via sharp)
// ------------------------------------------------------------------
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*'],
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: [
      { name: 'thumbnail', width: 320, formatOptions: { format: 'webp' } },
      { name: 'content', width: 1440, formatOptions: { format: 'webp' } },
    ],
  },
  fields: [{ name: 'alt', type: 'text', required: true }],
}

// ------------------------------------------------------------------
// Medics: öffentliche Arztprofile (E-E-A-T-Signal, Schema.org reviewedBy)
// ------------------------------------------------------------------
export const Medics: CollectionConfig = {
  slug: 'medics',
  admin: { useAsTitle: 'name' },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'title', type: 'text', admin: { description: 'z. B. Dr. med.' } },
    {
      name: 'specialty',
      type: 'text',
      required: true,
      admin: { description: 'Facharztbezeichnung, z. B. Laboratoriumsmedizin' },
    },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'textarea' },
    { name: 'practiceUrl', type: 'text' },
  ],
}

// ------------------------------------------------------------------
// Categories: gemeinsame Taxonomie (Slug = Brücke zur Vergleichs-Engine)
// ------------------------------------------------------------------
export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'name' },
  access: {
    read: () => true,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
  ],
}

// ------------------------------------------------------------------
// Articles: Wissens-Zone mit Review-Workflow
// ------------------------------------------------------------------
export const Articles: CollectionConfig = {
  slug: 'articles',
  versions: { drafts: true },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'review.status', '_status'] },
  access: {
    read: publicReadPublished,
    create: isEditorOrAdmin,
    update: ({ req }) => ['admin', 'redaktion', 'arzt'].includes(req.user?.role ?? ''),
    delete: isAdmin,
  },
  fields: [
    { name: 'title', type: 'text', required: true, access: { update: notArzt } },
    { name: 'slug', type: 'text', required: true, unique: true, access: { update: notArzt } },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      access: { update: notArzt },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      access: { update: notArzt },
    },
    { name: 'excerpt', type: 'textarea', access: { update: notArzt } },
    {
      // Template Tab. 1.2: Pflicht, 2–4 Sätze, wird als Snippet/JSON-LD-
      // description verwendet
      name: 'kernaussage',
      type: 'textarea',
      required: true,
      maxLength: 500,
      access: { update: notArzt },
    },
    {
      name: 'evidenzgrad',
      type: 'select',
      required: true,
      options: [
        { label: 'Hoch (Meta-Analysen/RCTs)', value: 'hoch' },
        { label: 'Mittel', value: 'mittel' },
        { label: 'Niedrig (Beobachtung/Mechanistik)', value: 'niedrig' },
        { label: 'Unklar (widersprüchlich)', value: 'unklar' },
      ],
      access: { update: notArzt },
    },
    { name: 'content', type: 'richText', required: true, access: { update: notArzt } },
    {
      name: 'faq',
      type: 'array',
      access: { update: notArzt },
      admin: { description: '3–6 Einträge; Pflicht für Publish' },
      fields: [
        { name: 'frage', type: 'text', required: true },
        { name: 'antwort', type: 'textarea', required: true },
      ],
    },
    {
      // "jedes Maßnahmen-Thema endet in einer Messgröße"
      name: 'messgroesse',
      type: 'group',
      access: { update: notArzt },
      fields: [
        { name: 'biomarker', type: 'text' },
        { name: 'referenzbereich', type: 'text' },
        { name: 'intervall', type: 'text' },
      ],
    },
    {
      name: 'sources',
      type: 'array',
      access: { update: notArzt },
      fields: [
        { name: 'citation', type: 'text', required: true },
        {
          name: 'refType',
          type: 'select',
          options: ['doi', 'pubmed', 'url'],
          required: true,
        },
        { name: 'ref', type: 'text', required: true },
      ],
    },
    {
      name: 'requiresMedicalReview',
      type: 'checkbox',
      defaultValue: true,
      access: { update: ({ req }) => req.user?.role === 'admin' },
    },
    {
      name: 'review',
      type: 'group',
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'in_arbeit',
          options: [
            { label: 'In Arbeit', value: 'in_arbeit' },
            { label: 'Redaktionell fertig', value: 'redaktionell_fertig' },
            { label: 'Medizinisch geprüft', value: 'medizinisch_geprueft' },
          ],
        },
        {
          name: 'reviewedBy',
          type: 'relationship',
          relationTo: 'medics',
          admin: { readOnly: true },
        },
        { name: 'reviewDate', type: 'date', admin: { readOnly: true } },
        { name: 'reviewNote', type: 'textarea' },
      ],
    },
    {
      name: 'lastFactCheck',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'contentHash',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar' },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const role = req.user?.role
        // Updates können partiell sein (Local API): für den Hash immer
        // den vollständigen Feldstand betrachten
        const newHash = buildContentHash({ ...originalDoc, ...data })
        const contentChanged =
          originalDoc?.contentHash && originalDoc.contentHash !== newHash

        // (3) Inhaltliche Änderung nach Freigabe -> Review verfällt
        // Abweichung vom Referenz-Artefakt: Flag verhindert, dass der
        // "Stempel niemals vom Client"-Zweig unten den soeben gelöschten
        // Stempel aus originalDoc wiederherstellt (Bug im Artefakt,
        // siehe AGENT_LOG 1.1).
        let reviewInvalidated = false
        if (
          contentChanged &&
          originalDoc?.review?.status === 'medizinisch_geprueft'
        ) {
          reviewInvalidated = true
          data.review = {
            ...data.review,
            status: 'redaktionell_fertig',
            reviewedBy: null,
            reviewDate: null,
          }
        }

        // (1) Freigabe nur durch Rolle arzt, Stempel serverseitig
        const wantsApproval =
          data.review?.status === 'medizinisch_geprueft' &&
          originalDoc?.review?.status !== 'medizinisch_geprueft'

        if (wantsApproval) {
          if (role !== 'arzt') {
            throw new Error(
              'Nur Nutzer mit Rolle "arzt" können medizinisch freigeben.',
            )
          }
          if (!req.user?.medicProfile) {
            throw new Error('Arzt-Account ohne verknüpftes Arztprofil.')
          }
          data.review.reviewedBy =
            typeof req.user.medicProfile === 'object'
              ? req.user.medicProfile.id
              : req.user.medicProfile
          data.review.reviewDate = new Date().toISOString()
        } else if (data.review && !reviewInvalidated) {
          // Stempel niemals aus dem Client übernehmen
          data.review.reviewedBy = originalDoc?.review?.reviewedBy ?? null
          data.review.reviewDate = originalDoc?.review?.reviewDate ?? null
        }

        // (2) Publish-Gate: medizinische Freigabe + Kernaussage + min. 3 FAQ
        if (data._status === 'published') {
          if (
            data.requiresMedicalReview !== false &&
            data.review?.status !== 'medizinisch_geprueft'
          ) {
            throw new Error(
              'Publizieren erst nach medizinischer Freigabe möglich.',
            )
          }
          const kernaussage = data.kernaussage ?? originalDoc?.kernaussage
          if (!kernaussage) {
            throw new Error('Publizieren erfordert eine gesetzte Kernaussage.')
          }
          const faq = data.faq ?? originalDoc?.faq ?? []
          if (faq.length < 3) {
            throw new Error(
              'Publizieren erfordert mindestens 3 FAQ-Einträge.',
            )
          }
        }

        // lastFactCheck automatisch: bei Anlage und bei inhaltlicher
        // Änderung (quartalsweiser Review aktualisiert nur dieses Feld)
        if (!originalDoc || contentChanged) {
          data.lastFactCheck = new Date().toISOString()
        }

        data.contentHash = newHash
        return data
      },
    ],
    afterChange: [
      // Publish/Update eines publizierten Artikels stößt den
      // Frontend-Rebuild an (Coolify-Webhook, Schritt 1.3)
      async ({ doc, previousDoc, req }) => {
        const url = process.env.REBUILD_WEBHOOK_URL
        if (!url) return doc
        const isOrWasPublished =
          doc._status === 'published' || previousDoc?._status === 'published'
        if (!isOrWasPublished) return doc
        try {
          const res = await fetch(url, { method: 'POST' })
          if (!res.ok) {
            req.payload.logger.warn(
              `Rebuild-Webhook antwortete mit ${res.status}`,
            )
          }
        } catch (err) {
          req.payload.logger.warn(
            { err },
            'Rebuild-Webhook nicht erreichbar — Deploy manuell anstoßen.',
          )
        }
        return doc
      },
    ],
  },
}

// ------------------------------------------------------------------
// PodcastEpisodes: Verknüpfung Folge <-> Wissensartikel
// ------------------------------------------------------------------
export const PodcastEpisodes: CollectionConfig = {
  slug: 'podcast-episodes',
  admin: { useAsTitle: 'title' },
  access: {
    read: () => true,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'episodeNumber', type: 'number', required: true },
    {
      name: 'podigeeEpisodeId',
      type: 'text',
      required: true,
      admin: { description: 'ID für Player-Embed' },
    },
    { name: 'publishDate', type: 'date', required: true },
    { name: 'showNotes', type: 'richText' },
    {
      name: 'relatedArticles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
    },
  ],
}

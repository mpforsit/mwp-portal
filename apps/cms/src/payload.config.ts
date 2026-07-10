import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import {
  EXPERIMENTAL_TableFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import {
  Articles,
  Categories,
  Media,
  Medics,
  PodcastEpisodes,
  Users,
} from './collections'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Users, Media, Medics, Categories, Articles, PodcastEpisodes],
  // Tabellen-Feature: Evidenz-Tabellen als echtes HTML-table
  // (Redaktions-Template Teil 1)
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      EXPERIMENTAL_TableFeature(),
    ],
  }),
  sharp,
  secret: process.env.PAYLOAD_SECRET ?? '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // Payload lebt im eigenen Postgres-Schema, getrennt von der
    // Vergleichs-Engine (siehe Projekt-Kontext).
    schemaName: 'cms',
    pool: { connectionString: process.env.DATABASE_URL ?? '' },
  }),
})

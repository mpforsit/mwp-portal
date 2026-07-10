import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'

import { Users } from './collections/Users'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  // Die vollständigen Collections (Articles, Medics, Review-Workflow)
  // kommen in Schritt 1.1 aus docs/artefakte/payload-collections.ts.
  collections: [Users],
  editor: lexicalEditor(),
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

// CLI-Wrapper: pnpm seed — spielt die idempotenten Seeds ein.
import { fileURLToPath } from 'node:url'
import { runSeeds } from '../src/migrate.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL ist nicht gesetzt.')
  process.exit(1)
}

runSeeds(
  databaseUrl,
  fileURLToPath(new URL('../seeds', import.meta.url)),
).catch((err) => {
  console.error(err)
  process.exit(1)
})

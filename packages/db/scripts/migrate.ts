// CLI-Wrapper: pnpm migrate — führt alle Migrationen aus.
import { fileURLToPath } from 'node:url'
import { runMigrations } from '../src/migrate.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL ist nicht gesetzt.')
  process.exit(1)
}

runMigrations(
  databaseUrl,
  fileURLToPath(new URL('../migrations', import.meta.url)),
).catch((err) => {
  console.error(err)
  process.exit(1)
})

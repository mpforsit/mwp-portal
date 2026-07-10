import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://portal:portal@localhost:5432/portal_test'

export default defineConfig({
  resolve: {
    alias: { '@payload-config': path.resolve(dirname, 'src/payload.config.ts') },
  },
  test: {
    include: ['tests/**/*.int.test.ts'],
    globalSetup: './tests/global-setup.ts',
    env: {
      DATABASE_URL: testDatabaseUrl,
      PAYLOAD_SECRET: 'nur-fuer-tests-0000000000000000',
    },
    // Payload-Init + Schema-Push brauchen Zeit
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})

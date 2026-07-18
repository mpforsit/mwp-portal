import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: './tests/global-setup.ts',
    // Integrationstests teilen sich die Test-DB — nacheinander
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})

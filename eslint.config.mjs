// Gemeinsame Flat-Config für alle Workspaces; Packages rufen `eslint .`
// auf und ESLint 9 findet diese Datei über die Verzeichnis-Hierarchie.
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      '**/.next/**',
      '**/build/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Kein any ohne Begründung (CLAUDE.md); bewusste Ausnahmen per
      // eslint-disable-next-line mit Kommentar.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
)

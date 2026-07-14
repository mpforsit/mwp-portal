# mwp-portal

Deutschsprachiges Gesundheits- & Longevity-Portal mit drei Zonen
(Wissen / Vergleich / Messen) als Ausleitung eines evidenzbasierten
Podcasts. Projektkontext: `docs/artefakte/projekt-kontext.md`,
Phasenplan: `docs/umsetzungsplan-portal.md`.

## Struktur (pnpm-Monorepo)

| Pfad              | Inhalt                                              |
| ----------------- | --------------------------------------------------- |
| `apps/web`        | Astro-Frontend (SSG-first)                          |
| `apps/cms`        | Payload v3 (Redaktion, Review-Workflow)             |
| `apps/api`        | Fastify-Service: Scoring, Praxisfinder, Webhooks    |
| `packages/db`     | SQL-Migrationen (Vergleichs-Engine) + Runner        |
| `docs/artefakte`  | Referenz-Artefakte (Source of Truth)                |
| `docs/adr`        | Architecture Decision Records                       |

## Setup

Voraussetzungen: Node ≥ 22, pnpm ≥ 10, Docker.

```sh
pnpm install
docker compose up -d db        # Postgres 15 + PostGIS auf :5432
cp apps/cms/.env.example apps/cms/.env
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
```

Starten (je eigenes Terminal):

```sh
pnpm --filter @mwp/web dev     # Astro auf :4321
pnpm --filter @mwp/cms dev     # Payload/Next auf :3000
pnpm --filter @mwp/api dev     # Fastify auf :3001
```

Migrationen der Vergleichs-Engine:

```sh
pnpm --filter @mwp/db migrate
```

## Qualität

```sh
pnpm typecheck   # alle Workspaces
pnpm lint
pnpm test
```

Konventionen, rote Linien und Definition of Done: siehe `CLAUDE.md`
und `docs/artefakte/projekt-kontext.md`.

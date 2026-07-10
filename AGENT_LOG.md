# Agent-Log

Chronologisches Protokoll abgeschlossener Aufgaben (siehe CLAUDE.md,
Abschnitt 5). Neueste Einträge unten anhängen.

---

## 2026-07-10 — CLAUDE.md erstellt

**Was:** CLAUDE.md aus der vorgeschlagenen Vorlage übernommen und an
dieses Projekt angepasst (Stack, Referenz-Artefakte als Source of
Truth, rote Linien).
**Dateien:** `CLAUDE.md` (neu).
**Begründung:** Verhaltensregeln der Vorlage sind projektneutral; die
Hard Rules stammten aus einem anderen Projekt und wurden durch die
hier entschiedenen ersetzt.
**Offen:** —

## 2026-07-10 — Schritt 0.2: Artefakte ins Repo

**Was:** Referenzdokumente nach `docs/artefakte/` verschoben
(`projekt-kontext.md`, `strategie-kontext.md`, `payload-collections.ts`,
`vergleichs-engine-schema.sql`, `redaktions-template-geo-checkliste.md`),
Umsetzungsplan nach `docs/umsetzungsplan-portal.md`; Pfadverweise in
CLAUDE.md angepasst; `.DS_Store` entfernt.
**Dateien:** Verschiebungen + `CLAUDE.md`.
**Begründung:** Zielstruktur aus dem Projekt-Kontext; Schritt 0.2 des
Umsetzungsplans (dort als "manuell" markiert).
**Offen:** —

## 2026-07-10 — Schritt 0.1: Monorepo-Skelett

**Was:** pnpm-Workspace mit vier Paketen aufgebaut:
- `apps/web` — minimales Astro 5 (SSG, TypeScript strict,
  Platzhalter-Startseite), `astro check` als Typecheck.
- `apps/cms` — Payload v3 auf Next 15.4 (Blank-Struktur handgeschrieben,
  da `create-payload-app` im Sandbox-Environment kein TTY bekam),
  Postgres-Adapter mit `schemaName: 'cms'`, minimale Users-Collection;
  die vollständigen Collections folgen in Schritt 1.1.
- `apps/api` — Fastify 5 mit `/health`-Route, tsx für Dev, Vitest
  vorbereitet.
- `packages/db` — idempotenter SQL-Migrations-Runner
  (`scripts/migrate.ts`, Protokoll in `engine_meta.migrations`,
  eine Transaktion pro Migration), noch ohne Migrationen.
- Root: `docker-compose.yml` (postgis/postgis:15-3.4),
  `tsconfig.base.json`, gemeinsame ESLint-9-Flat-Config
  (`eslint.config.mjs`, `no-explicit-any` als error), README mit
  Setup-Anleitung, `.env.example` je App.
**Dateien:** siehe Commit (Root-Konfigs + drei Apps + ein Package).
**Begründung:** exakt der Zuschnitt aus Schritt 0.1 des
Umsetzungsplans; ESLint/typescript-eslint liegen im Root, weil ESLint 9
die Flat-Config über die Verzeichnishierarchie auflöst und so eine
Version für alle Workspaces gilt.
**Verifikation:** `pnpm install` ok; `pnpm -r typecheck` grün (4/4);
`pnpm lint` grün; alle drei Apps lokal gestartet und per HTTP geprüft
(API `/health` 200, Web `/` 200, CMS `/admin` 200; Payload legte seine
Tabellen im Schema `cms` an).
**Vorbehalte:**
- `docker compose up` konnte im Remote-Sandbox-Environment nicht
  verifiziert werden: Die Netzwerk-Policy blockiert Docker-Hub-Pulls
  (403 auf production.cloudfront.docker.com). Ausweich-Verifikation
  mit apt-installiertem PostgreSQL 16 + PostGIS. Die Compose-Datei ist
  Standard und sollte lokal/auf Hetzner funktionieren — beim ersten
  lokalen Setup bitte einmal gegentesten.
- Payload pinnt Next auf `~15.4.11` (Peer-Range von @payloadcms/next).
- Manuell offen (laut Plan): Hetzner-Server, Coolify mit zwei
  Umgebungen, Postgres-Instanz, Deploy-Hook auf main.
**Nächster Schritt:** 0.3 (robots.txt, llms.txt, check-crawlers.sh)
oder 0.4 (CI-Basis); 0.3 setzt keine DNS-Arbeiten für die Dateien
voraus, nur für die Verifikation.

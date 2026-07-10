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

## 2026-07-10 — Schritt 0.3: Crawler-Politik

**Was:** `apps/web/public/robots.txt` (Allowlist: GPTBot,
OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User,
PerplexityBot, Perplexity-User, Google-Extended, DuckAssistBot,
MistralAI-User; Disallow: Bytespider, ImagesiftBot; Sitemap-Verweis),
`apps/web/public/llms.txt` (Portalbeschreibung, drei Bereiche),
`scripts/check-crawlers.sh` (curl je Crawler-UA, Status + erste Bytes,
Exit ≠ 0 bei Nicht-200).
**Begründung:** Schritt 0.3 des Plans; Crawler-Politik "alles erlauben"
aus strategie-kontext.md §5.
**Verifikation:** Gegen lokalen Astro-Dev-Server: alle zwölf
User-Agents 200; robots.txt/llms.txt werden ausgeliefert.
**Vorbehalte:** Sitemap-URL enthält Platzhalter `PORTAL-DOMAIN.de` —
nach Domain-Entscheidung/DNS-Umstellung ersetzen (TODO im File);
llms.txt nennt noch keinen Portalnamen (Naming offen). Manuell offen:
DNS/Cloudflare-Prüfung ("Block AI bots" AUS) und check-crawlers.sh
gegen Staging.

## 2026-07-10 — Schritt 0.4: CI-Basis

**Was:** `.github/workflows/ci.yml`: Job `check` (pnpm install
--frozen-lockfile, `pnpm -r typecheck`, `lint`, `test`) bei jedem PR
und Push auf main; Job `deploy-staging` (nur main): POST auf
Coolify-Webhook (Secret `COOLIFY_DEPLOY_WEBHOOK`) + Smoke-Test, der
bis zu 5 Minuten auf HTTP 200 der Staging-Startseite pollt (Variable
`STAGING_URL`). apps/api-Testskript auf `--passWithNoTests` gestellt,
damit CI vor den ersten Tests nicht rot ist.
**Verifikation:** YAML geparst; alle drei Check-Kommandos lokal grün.
Der Workflow selbst läuft erst mit einem PR/Push auf GitHub —
Secrets/Variablen (COOLIFY_DEPLOY_WEBHOOK, STAGING_URL) müssen im Repo
konfiguriert werden, sobald Coolify steht.
**Nächster Schritt:** Phase 1, Schritt 1.1 (Payload-Collections mit
Review-Workflow + Integrationstests).

## 2026-07-10 — Schritt 1.1: Payload-Collections mit Review-Workflow

**Was:** Referenz-Collections vollständig in `apps/cms` integriert
(`src/collections.ts`: Users, Media, Medics, Categories, Articles,
PodcastEpisodes) und gemäß Plan/Redaktions-Template Tab. 1.2 erweitert:
- Media-Collection (lokales Storage, WebP-Konvertierung + imageSizes
  via sharp).
- Articles: `kernaussage` (textarea, required, max 500), `evidenzgrad`
  (select hoch/mittel/niedrig/unklar), `faq` (array {frage, antwort}),
  `messgroesse` (group {biomarker, referenzbereich, intervall}),
  `lastFactCheck` (date, readOnly, per Hook bei Anlage und
  Content-Änderung gesetzt).
- contentHash umfasst zusätzlich kernaussage/faq/messgroesse.
- Publish-Gate verlangt zusätzlich gesetzte Kernaussage und min. 3 FAQ.
- Seed (`pnpm seed` → tsx): Admin/Redakteur/Arzt+Medic-Profil,
  2 Kategorien, 1 Draft-Artikel in_arbeit; idempotent.
- Integrationstests (`pnpm test`, Vitest + Payload Local API, eigene
  DB `portal_test`, Schema-Reset im globalSetup): die vier geforderten
  Fälle (a–d) plus Stempel-Unterschieben, FAQ-Gate, Publish-Happy-Path.
  7/7 grün.
- CI: Postgres-Service (postgis 15-3.4) im check-Job für die Tests.

**Abweichungen/Erkenntnisse:**
1. **Bug im Referenz-Artefakt gefunden** (durch Test c): Nach der
   Review-Invalidierung stellte der nachfolgende "Stempel niemals vom
   Client"-Zweig `reviewedBy/reviewDate` aus originalDoc wieder her.
   Fix: `reviewInvalidated`-Flag überspringt den Restore-Zweig.
   → Artefakt `docs/artefakte/payload-collections.ts` sollte
   entsprechend nachgezogen werden (Rückmeldung an Maintainer).
2. contentHash wird über `{ ...originalDoc, ...data }` gebildet, weil
   Local-API-Updates partiell sein können (Artefakt hashte nur `data`).
3. `payload run src/seed.ts` schlug im Sandbox-Environment still fehl;
   Seed-Skript läuft stattdessen über tsx (`--env-file=.env`).

**Verifikation:** `pnpm -r typecheck`, `lint`, `test` grün; Seed
zweimal gelaufen (idempotent); Admin-UI bootet (200); anonyme
API-Zugriffe: Draft-Artikel unsichtbar, /api/users verweigert.
Manuell offen: Durchklicken im Admin-UI mit allen drei Rollen
(Login-Daten siehe Seed; Passwort `changeme!42`).
**Nächster Schritt:** 1.2 Astro-Grundgerüst & Designsystem.

## 2026-07-10 — Schritt 1.2: Astro-Grundgerüst & Designsystem

**Was:** Designsystem als CSS-Custom-Properties in
`src/styles/global.css` (warme Neutraltöne, eine Akzentfarbe Petrol,
fluid-Typo-Skala, Dark Mode via prefers-color-scheme, BEM-ähnliche
Klassen, kein Tailwind/keine UI-Lib, kein JS). Layouts `BaseLayout`
und `ArticleLayout` (Kernaussage-Box mit Evidenz-/Stand-Badges,
720px Content-Breite), Komponenten SiteHeader (drei Zonen als
Hauptnavigation, aria-current) und SiteFooter (Methodik/Transparenz/
Impressum/Datenschutz). Seiten: Startseite mit Zonen-Karten,
Platzhalter für /wissen/, /vergleich/ (mit UWG-Bereichshinweis),
/messen/ sowie Artikel-Beispielseite `/wissen/vitamin-d/` mit
Evidenz-Tabelle, FAQ und Quellen-Platzhaltern. UI-Texte gemäß
Tonalität aus strategie-kontext.md (nüchtern, keine Superlative,
Transparenz offen benannt).
**Verifikation:** Build grün (5 Seiten); Lighthouse auf der
Artikel-Beispielseite: Performance 100, SEO 100, Accessibility 100,
Best Practices 96 (Budget >95 für Performance/SEO erfüllt);
Responsive-Check mobil (390px) und Dark Mode per
Playwright-Screenshots geprüft; `pnpm -r typecheck`/`lint` grün.
**Vorbehalte:** Portalname weiterhin Platzhalter ("Portal");
Footer-Links (Methodik/Transparenz/Impressum/Datenschutz) zeigen auf
noch nicht existierende Seiten (kommen in 2.7 bzw. Launch-Checkliste);
Artikelinhalt der Beispielseite ist als Platzhalter gekennzeichnet
und nicht medizinisch geprüft.
**Nächster Schritt:** 1.3 Payload→Astro-Anbindung & Artikel-Template.

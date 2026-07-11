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

## 2026-07-10 — Schritt 1.3: Payload→Astro-Anbindung & Artikel-Template

**Was:**
- CMS: Users um `name`/`qualification` erweitert (Meta-Block braucht
  "Autor mit Kurzqualifikation"; Ergänzung zum Referenz-Artefakt →
  dort nachziehen), `auth.useAPIKey` aktiviert,
  `EXPERIMENTAL_TableFeature` im Lexical-Editor (Evidenz-Tabellen),
  afterChange-Hook ruft REBUILD_WEBHOOK_URL bei Publish/Update
  publizierter Artikel (Fehler nur geloggt, nie blockierend).
- Seed: Namen/Qualifikationen; Service-User build@example.com mit
  Dev-API-Key; zweiter Beispielartikel `vitamin-d-studienlage`, der
  regulär durch Arzt-Freigabe + Publish-Gate läuft (inkl. FAQ,
  5 Quellen, Lexical-Tabelle, Messgröße).
- Web: `src/lib/payload.ts` (Build-Time-Fetch mit Pagination, Typen
  per type-only-Import aus cms/payload-types — keine Parallel-Typen),
  `src/lib/lexical.ts` (convertLexicalToHTML mit eigenem
  Heading-Converter: H2-Anker-IDs; TOC-Extraktion aus H2s),
  Seitentyp `/wissen/[slug]` exakt nach Template Teil 1 (TOC,
  RichText mit echten Tabellen, Messgrößen-Block, FAQ, nummerierte
  Quellen mit DOI/PubMed-Links, sichtbarer Meta-Block), Wissens-Index
  aus dem CMS; statische Beispielseite aus 1.2 entfernt.
  Neue Dependency in web: @payloadcms/richtext-lexical (nur
  HTML-Converter; Payload-Ökosystem, kein Fremd-Stack).
- ADR 0001: Draft-Preview als Staging-Build-Variante
  (PAYLOAD_DRAFT_PREVIEW) statt SSR; Build-Fetch authentifiziert sich
  immer per Service-User-API-Key (PAYLOAD_API_TOKEN), weil Payload
  geschützte Relationen (Autor) anonym depopuliert.

**Verifikation:** Build gegen laufendes CMS; curl-Checks auf dem
gerenderten HTML (ohne JS): Kernaussage, Tabelle, FAQ, DOI/PubMed-
Quellen, Meta-Block (Autor, Medizinisch geprüft von … am …,
Veröffentlicht, Aktualisiert), H2-Anker — alle vorhanden, kein
<script>-Tag. Lighthouse auf der CMS-gerenderten Artikelseite:
Performance 100, SEO 100. `pnpm -r typecheck`/`lint` und CMS-Tests
(7/7) grün.

**Vorbehalte:**
- "Veröffentlicht am" nutzt createdAt (Payload hat kein separates
  publishedAt-Feld) — bei Bedarf eigenes Feld ergänzen.
- Rebuild-Webhook feuert pro Save; Debouncing/Queueing erst nötig,
  wenn Redaktionsvolumen steigt.
- CI baut das Frontend nicht gegen ein CMS (ohne PAYLOAD_API_URL:
  leere Artikelliste, Build grün) — Staging-Build übernimmt die
  echte Anbindung.
- JSON-LD (@graph) kommt planmäßig erst in Schritt 1.4.
**Nächster Schritt:** 1.4 JSON-LD-Rendering.

## 2026-07-10 — Schritt 1.4: JSON-LD-Rendering

**Was:**
- `src/lib/jsonld.ts`: reine Graph-Builder nach Template Teil 2 —
  Sitewide-Knoten (Organization `#org` + WebSite `#website`, per @id
  referenziert) und Wissensartikel-Graph (MedicalWebPage mit
  lastReviewed/reviewedBy nur bei Freigabe, Article mit
  citation aus sources (nur doi/pubmed → `doi:`/`pmid:`-Identifier),
  Person-Reviewer, FAQPage, BreadcrumbList).
- `dateModified` = `lastFactCheck` (Hook setzt es bei Anlage +
  inhaltlicher Änderung), bewusst nicht `updatedAt` — Tippfehler-Saves
  entwerten das Signal nicht. Nie Build-Zeitpunkt.
- `JsonLd.astro` rendert einen @graph pro Seite im <head>;
  BaseLayout/ArticleLayout reichen Seiten-Knoten durch. Startseite &
  Co. tragen den Sitewide-Graph.
- `src/lib/site.ts` (SITE_NAME-Platzhalter, SITE_URL aus Env),
  `astro.config` site aus SITE_URL.
- `formatMedicName`-Guard: Titel wird nicht verdoppelt, wenn er schon
  im Medic-Namen steht (auch im sichtbaren Meta-Block).
- Tests (Vitest in apps/web, 12 Stück): JSON-Schema-Definitionen der
  Pflichtfelder je Knotentyp + Mini-Validator (testintern, Subset —
  bewusst kein ajv als neue Dependency); Fälle: Pflichtfelder aller
  sieben Knotentypen, citation-Filter, dateModified aus CMS,
  Titel-Guard, kein Reviewer-Knoten ohne Freigabe.

**Verifikation:** Tests 12/12 grün; Build gegen laufendes CMS; im
gebauten HTML: ein @graph mit Organization, WebSite, MedicalWebPage,
Article, Person, FAQPage, BreadcrumbList; Reviewer-Name korrekt;
Sitewide-Graph auf der Startseite. Typecheck/Lint über alle
Workspaces grün.
**Manuell offen:** Google Rich-Results-Test + validator.schema.org
für eine Beispielseite, sobald Staging öffentlich erreichbar ist
(brauchen öffentliche URL). Organization-Knoten: logo, sameAs und
publishingPrinciples nach Launch pflegen (TODO im Code).
**Nächster Schritt:** 1.5 Beirats- und Autorenseiten (dann Person-
Knoten um url ergänzen, TODOs in jsonld.ts).

## 2026-07-10 — Schritt 1.5: Beirats- und Autorenseiten

**Was:**
- CMS: `slug` (unique, optional) auf Medics und Users — nur Einträge
  mit Slug bekommen eine öffentliche Seite. Seed vergibt Slugs
  (erika-beispiel, rena-redaktion) inkl. Nachzieh-Pfad für Bestände.
- Web: `/beirat/` (Übersicht aller Ärzte mit Slug),
  `/beirat/[slug]/` (Foto falls vorhanden, Name mit Titel,
  Facharztbezeichnung, Bio, Praxis-Link, Liste der medizinisch
  geprüften publizierten Artikel), `/team/[slug]/` (Name,
  Kurzqualifikation, verfasste Artikel). Artikel-Listen werden aus dem
  gemeinsamen fetchArticles-Ergebnis gefiltert, keine Extra-Queries.
- `payload.ts` refaktoriert auf generisches `fetchAll` (Pagination),
  neu: fetchMedics, fetchTeamMembers (nur mit Build-Token — Users
  sind zugriffsgeschützt), mediaUrl (CMS-relative Upload-URLs →
  absolut).
- JSON-LD: `medicPersonNodes`/`teamPersonNodes` nach Template 2.7
  (name, honorificPrefix, jobTitle, url, sameAs=practiceUrl bzw.
  affiliation=#org); Artikel-Graph verlinkt jetzt author.url
  (/team/…) und Reviewer-url (/beirat/…), wenn Slugs existieren —
  die TODOs aus 1.4 sind damit erledigt.
- Tests: 15/15 in web (neu: Person-Schemata 2.7, Entitäts-Links im
  Artikel-Graph).

**Verifikation:** Build gegen CMS: /beirat/, /beirat/erika-beispiel/,
/team/rena-redaktion/ gebaut; Person-JSON-LD vollständig; beide
Profilseiten listen den publizierten Artikel; Artikel-Graph zeigt
author.url und reviewer.url auf die Profilseiten. Lint/Typecheck/
Tests (15+7) über alle Workspaces grün.
**Vorbehalte:** Medic-Fotos: Upload-URLs zeigen auf den CMS-Host —
für Prod gehört das Media-Verzeichnis hinter dieselbe Domain/CDN
(Coolify-Setup-Thema). Kein Team-Index (/team/) — Plan verlangt nur
die Beirats-Übersicht.
**Nächster Schritt:** 1.6 Podcast-Episodenseiten.

## 2026-07-10 — Schritt 1.6: Podcast-Episodenseiten

**Was:**
- CMS: PodcastEpisodes + `transcript` (Array {speaker, text}, laut
  Plan) und `audioUrl` (optional, für associatedMedia im JSON-LD;
  Ergänzung zum Referenz-Artefakt). Seed legt Folge 1 mit Transkript
  und Verknüpfung zum publizierten Artikel an.
- Web: `/podcast/` (Episodenliste + Abo-Links Spotify/Apple/RSS —
  Platzhalter-URLs, TODO in site.ts) und `/podcast/[episode]/`
  (Route = Folgennummer): PodigeePlayer-Komponente lädt das iframe
  erst nach Klick — vor der Interaktion kein Request/Cookie an
  Podigee, Embed-URL nur als data-Attribut, noscript-Fallback-Link;
  Shownotes aus RichText; verknüpfte Artikel als Kartenliste;
  Transkript als <details> aufklappbar, aber vollständig im
  Initial-HTML mit Sprecher-Labels (MATTHIAS:/RUTH:).
- JSON-LD: `podcastEpisodeNodes` nach Template 2.5 (PodcastEpisode,
  partOfSeries "Was ist dran an …?", AudioObject bei audioUrl,
  transcript als Volltext mit Sprecher-Labels).
- PODIGEE_BASE_URL als Env (Platzhalter bis Podigee-Account steht).

**Verifikation:** Build gegen CMS: /podcast/ und /podcast/1/ gebaut;
Transkript im Initial-HTML in <details>; kein <iframe> vor
Interaktion; JSON-LD vollständig; Artikel-Verknüpfung und Abo-Links
gerendert. Tests 16/16 (neu: Episode-Schema 2.5 inkl. Transkript-
Serialisierung), CMS 7/7, Lint/Typecheck grün.
**Vorbehalte:** Erste Seite mit JS (Click-to-Load, ~10 Zeilen inline —
bewusste Ausnahme für Datenschutz, Content bleibt komplett im HTML).
Abo-Links und PODIGEE_BASE_URL sind Platzhalter bis zum
Podcast-Setup. /podcast/ hängt noch nicht in der Hauptnavigation
(Plan definiert die Nav mit den drei Zonen; ggf. bei Launch-Politur).
**Nächster Schritt:** 1.7 laut Umsetzungsplan.

## 2026-07-11 — Schritt 1.7: Newsletter-Capture (Brevo DOI)

**Was:**
- API (`apps/api/src/newsletter.ts`): POST /newsletter/subscribe →
  Brevo Double-Opt-in-Endpoint. Als Attribut geht ausschließlich
  `INTERESSE_<KATEGORIE>=true` mit — buildBrevoPayload ist eine reine,
  getestete Funktion; der Test prüft die exakte Feldliste und bricht,
  sobald je mehr übertragen würde (Rote-Linie-Wächter). Validierung
  von E-Mail und Interest-Slug; 503 bei fehlender Brevo-Config, 502
  bei Brevo-Fehler; CORS-Header (WEB_ORIGIN) + OPTIONS-Route manuell
  statt @fastify/cors (keine neue Dependency). Envs: BREVO_API_KEY,
  BREVO_LIST_ID, BREVO_DOI_TEMPLATE_ID, BREVO_DOI_REDIRECT_URL,
  WEB_ORIGIN. 9 Tests (Parsing, Payload, Route mit gemocktem fetch).
  tsconfig in typecheck (src+tests, noEmit) und tsconfig.build.json
  aufgeteilt; ESM-Importe mit .js-Endung (NodeNext).
- CMS: Global `newsletter-settings` (heading, intro,
  datenschutzhinweis — redaktionell pflegbar statt hartkodiert),
  öffentlich lesbar; Seed persistiert die Default-Texte.
- Web: NewsletterSignup.astro (interaktive Insel: fetch-Submit,
  Erfolgs-/Fehler-Status via role=status, noscript-Hinweis,
  Datenschutzhinweis aus dem Global). Platzierung laut Plan: inline
  nach dem Artikel (interest = Kategorie-Slug der Seite) und im
  Footer jeder Seite (interest = allgemein).
  Env PUBLIC_NEWSLETTER_API_URL.

**Verifikation:** Build gegen CMS: Inline-Capture mit
data-interest="vitamin-d" auf der Artikelseite, Footer-Capture
überall, Datenschutzhinweis gerendert. API-Route per curl: 503 ohne
Brevo-Keys (korrekt), CORS-Header gesetzt. Tests 9+16+7, Lint/
Typecheck über alle Workspaces grün.
**Manuell offen:** Brevo-Account: Liste, DOI-Template und
Bestätigungsseite (/newsletter/bestaetigt/ existiert noch nicht als
Seite — bei 1.9/Launch ergänzen); echte Keys als Coolify-Secrets.
**Nächster Schritt:** 1.8 Consent, Tracking, Zweit-Analytics.

## 2026-07-11 — Schritt 1.8: Consent, Tracking, Zweit-Analytics

**Was:**
- `ConsentManager.astro` (eigene schlanke Lösung statt Klaro — Plan
  lässt beides zu, so keine neue Dependency): Banner mit Kategorien
  notwendig (fix an) / Statistik / Marketing; Auswahl in
  localStorage (`portal-consent-v1`); Consent-Mode-v2-Defaults
  (alles denied, wait_for_update) werden IMMER vor jedem Tag in den
  dataLayer gepusht; sGTM (PUBLIC_SGTM_URL, Stape) lädt erst nach
  Einwilligung und bei Reload automatisch, wenn Consent gespeichert;
  Update-Signale analytics_storage/ad_* je nach Auswahl.
- Plausible self-hosted (PUBLIC_PLAUSIBLE_SCRIPT_URL/_DOMAIN):
  cookielos, lädt immer (rote Linie erlaubt cookielose
  Basis-Analytics vor Consent).
- Outbound-Shop-Klicks (PUBLIC_SHOP_HOSTS oder data-shop-link):
  Event in beide Systeme (plausible() + dataLayer
  shop_outbound_click).
- Footer-Button "Datenschutz-Einstellungen" öffnet das Banner erneut
  (Widerruf, CustomEvent portal:consent-open).
- `/datenschutz/`-Platzhalterseite: Plausible als berechtigtes
  Interesse dokumentiert, Consent-Dienste, Newsletter,
  Gesundheitsdaten-Abschnitt — alle juristischen Stellen mit
  "TODO ANWALT" markiert.

**Verifikation (Browser, Playwright gegen Preview-Build):**
(1) Ohne Consent: 0 GTM-/Google-Requests, Plausible-Request geht raus,
Banner sichtbar. (2) "Alle akzeptieren": GTM-Request, Banner zu.
(3) Reload: GTM lädt automatisch, Banner bleibt zu. (4) Klick auf
Shop-Link erzeugt shop_outbound_click im dataLayer mit URL.
(5) Footer-Button öffnet Banner erneut. Lint/Typecheck/Tests
(16+9+7) grün.
**Manuell offen:** Stape/sGTM-Container + GA4-Property einrichten,
Plausible-Instanz deployen (Coolify), echte URLs als Envs; finale
Datenschutzerklärung vom Anwalt.
**Nächster Schritt:** 1.9 Technisches SEO/GEO-Finish.

## 2026-07-11 — Schritt 1.9: Technisches SEO/GEO-Finish

**Was:**
- XML-Sitemaps (Build-Time, Astro-Endpoints, keine Dependency):
  `/sitemap-index.xml` → vier Zonen-Segmente (wissen mit
  Artikel-lastmod aus lastFactCheck, vergleich/messen vorerst nur
  Zonen-Startseiten, portal mit Podcast/Beirat/Team/Datenschutz).
  robots.txt-Verweis passt (Platzhalter-Domain).
- BaseLayout: rel=canonical (aus Astro.site + Pfad), OpenGraph
  (og:title/description/type/url/site_name/locale de_DE) und
  twitter:card aus den CMS-gespeisten Props; Artikel senden
  og:type=article. Kein og:image, solange kein Logo existiert.
- IndexNow: Web-Build erzeugt /<key>.txt aus INDEXNOW_KEY
  (dynamische Route, ohne Key keine Datei); CMS-afterChange pingt
  bing.com/indexnow mit der Artikel-URL bei Publish (Fehler nur
  geloggt). Gleicher Key in beiden Envs.
- 404.astro (mit Zonen-Einstiegen) und statisches public/500.html
  (self-contained für Webserver/CDN-Fehlerfälle).
- `scripts/geo-audit.sh <URL> [--article]`: prüft per curl ohne JS
  H1 + JSON-LD, mit --article zusätzlich Kernaussage-Box und
  FAQ-Sektion; Exit ≠ 0 bei fehlenden Elementen.

**Verifikation:** Build erzeugt alle fünf Sitemaps (XML-valide,
geprüft mit ElementTree), Key-Datei, 404/500; canonical + og:type
im Artikel-HTML korrekt; geo-audit.sh grün gegen alle neun
Seitentypen (Artikel mit --article). Lint/Typecheck/Tests (16+9+7)
grün.
**Manuell offen:** Search Console + Bing Webmaster Tools
verifizieren und Sitemap einreichen (braucht Live-Domain); echten
INDEXNOW_KEY generieren (z. B. openssl rand -hex 16) und in beide
Envs setzen; og:image + Logo nachrüsten, sobald Branding steht.
**Nächster Schritt:** 1.10/1.11 (Content-Produktion, Go-Live —
überwiegend manuell) bzw. Phase 2 (Vergleichs-Engine).

## 2026-07-11 — Schritt 2.1: Vergleichs-Engine-Schema als Migration

**Was:** Kernschema aus dem Artefakt nach
`packages/db/migrations/0001_vergleich_kernschema.sql` überführt
(eigenes Postgres-Schema `vergleich`): alle Tabellen, Gewichtssummen-
Trigger, Unveränderlichkeits-Trigger, partieller Unique-Index (ein
aktives Schema/Kategorie), Views current_ranking +
transparency_rank_vs_commission. Seed als idempotente Datei in
`seeds/` (on conflict / where not exists). Runner in importierbare
Lib refaktoriert (`src/migrate.ts`: runMigrations/runSeeds),
`pnpm seed` neu. 8 Integrationstests (die vier geforderten Fälle +
Idempotenz, 86.50-Seed, Ranking-Randfälle, Transparenz-View).
**Abweichungen:** kein `create extension pgcrypto` —
gen_random_uuid() ist ab PG13 Core (Extension bräuchte Superuser);
Objekte im Schema `vergleich` statt public (Projekt-Kontext).
**Verifikation:** Tests 8/8; migrate+seed zweimal gegen Dev-DB
(zweiter Lauf No-op), current_ranking (86.50, Rang 1) und
Transparenz-View geprüft.

## 2026-07-11 — Schritt 2.2: Scoring-Service

**Was:**
- `apps/api/src/scoring.ts` (reine Logik): bands — erste Band mit
  raw <= max greift, letzte Band ohne max ist Fallback; map —
  direkter Lookup mit hilfreicher Fehlermeldung; direction wird
  dokumentiert, aber nicht doppelt angewendet; total_score =
  Summe(points/10 * weight), auf 2 Stellen gerundet; fehlende
  Rohwerte werden namentlich gemeldet (ScoringError).
- Endpoints (`src/evaluations.ts`): POST /internal/evaluations/preview
  (berechnet, speichert nicht) und POST /internal/evaluations
  (speichert unpubliziert; published bleibt Sache des
  Pflege-Workflows 2.3). Kriterien kommen per schemaId aus der DB
  (markierte Deserialisierungs-Grenze); Produkt-Kategorie muss zur
  Schema-Kategorie passen. Guard über INTERNAL_API_TOKEN (Bearer),
  ohne Token nur lokal offen. Gekapselter Pool in `src/db.ts`.
- Input-Design: `raws` je Kriteriums-Key (+ optionale notes/evidence).
  Bewusst explizit statt automatisch aus attributes abgeleitet: Die
  Kriterien-Keys des Artefakts (micro_dosing, carrier, …) mappen
  nicht 1:1 auf die attributes-Keys (ie_pro_einzeldosis,
  traegeroel, …), und price_per_1000ie stammt gar nicht aus
  attributes, sondern aus Preisstichproben. Das Mapping ist Aufgabe
  des Pflege-Workflows (2.3).
- Tests: Property-based (fast-check, laut Plan) für die Band-Logik
  (erste-Band-Semantik, Fallback, Grenzwert raw === max), map-Fälle,
  86.50-Reproduktion als Unit- UND als Endpoint-Test gegen die
  Test-DB, Speichern unpubliziert inkl. Notes, Kategorie-Check,
  Token-Guard. Neue Dependencies in api: pg (+types), fast-check
  (im Plan-Prompt vorgegeben).

**Verifikation:** 23 API-Tests grün (9 Newsletter + 14 neu); alle
Workspaces: Lint/Typecheck grün, Tests 16+8+23+7.
**Nächster Schritt:** 2.3 Pflege-Workflow (mit ADR zur
Admin-UI-Entscheidung).

## 2026-07-11 — Schritt 2.3: Pflege-Workflow (Admin-UI in der API)

**Was:**
- ADR 0002: Entscheidung für ein minimales, server-gerendertes
  Admin-UI in /apps/api statt Payload-Custom-View. Gründe: Payload
  kann externe Tabellen nicht nativ, ein Custom-View müsste die
  gesamte CRUD-Logik gegen das vergleich-Schema selbst bauen und
  würde Engine-SQL in den CMS-Prozess tragen (Kapselungsregel).
- `src/admin-vergleich.ts` unter /admin/vergleich: Kategorien-
  Übersicht, Kategorie-Seite (Produkte mit Score/Rang, Produkt
  anlegen), Produkt-Seite (attributes-JSON pflegen, Bewertungsliste
  mit Status, Bewertungsformular aus dem criteria-JSONB generiert —
  Selects für map-Kriterien, Zahlenfelder für bands — mit
  Preview-Score und "Speichern (unpubliziert)"), Publizieren.
  Kein Client-JS, keine neuen Dependencies (urlencoded-Parser
  handgeschrieben, Basic-Auth mit timingSafeEqual; ohne
  ADMIN_USER/ADMIN_PASSWORD ist der Bereich 503-gesperrt).
- Publizieren setzt in einer Transaktion automatisch superseded_by
  auf ältere publizierte, nicht abgelöste Bewertungen desselben
  Produkts (Korrektur-Kette aus dem Artefakt) —
  `publishEvaluation` im neuen Repository-Modul
  `src/evaluations-repo.ts`, das auch von den 2.2-Endpoints genutzt
  wird (loadCriteria/insertEvaluation dorthin refaktoriert).

**Verifikation:** 8 neue Integrationstests (Auth-Pflicht, 503 ohne
Config, Anlegen → Preview ohne Persistenz → Speichern unpubliziert →
Publizieren → Ranking → Nachfolger-Publish setzt superseded_by und
Ranking zeigt neuen Score). API gesamt 31 Tests grün; Smoke-Test
gegen Dev-DB im Browser-freien curl (401 ohne Auth, Seiten rendern,
Seed-Bewertung sichtbar). Alle Workspaces grün (16+8+31+7).
**Vorbehalte:** Kategorien/Methodik-Versionen anlegen läuft noch per
SQL/Seed (bewusst: selten, hohe Sorgfalt — bei Bedarf später ins
Admin). Prod: Route zusätzlich netzseitig schützen (Tailscale,
siehe ADR).
**Nächster Schritt:** 2.4 Vergleichsseiten-Frontend.

## 2026-07-11 — Schritt 2.4: Vergleichsseiten-Frontend

**Was:**
- ADR 0003 + additive Migration: `product_evaluations.summary`
  (Kurzfazit) — Template 2.3 verlangt reviewBody, das Artefakt hat
  keine Spalte. Bewusst nicht trigger-geschützt (redaktionelle
  Zusammenfassung; das Urteil bleibt geschützt). Demo-Seed 0002
  (Kurzfazit, Affiliate-Partner/-Link, Preisstichprobe).
- API: öffentliche Lese-Endpoints `/api/vergleich` und
  `/api/vergleich/:slug` (vergleich-public.ts) — nur publizierte
  Daten aus current_ranking, Affiliate-Links OHNE Provisionshöhen;
  exportierte Response-Typen. Admin-Formular um Kurzfazit erweitert;
  vitest.config (fileParallelism: false — Integrationstests teilen
  die Test-DB, vorher flaky).
- Web: `/vergleich/[kategorie]/` — vollständige Tabelle statisch im
  HTML (Rang, Produkt, Score je Kriterium mit Rohwert, Gesamt, Preis
  als Text mit Stand-Datum aus price_snapshots, Kurzfazit,
  Affiliate-Buttons mit sichtbarem "Anzeige"-Label und
  rel="sponsored noopener" auf /go/[linkId], data-shop-link fürs
  Outbound-Tracking aus 1.8). Bereichshinweis oben mit Link
  "Bewertet nach Methodik v{n}" (/methodik/[kategorie]/ folgt in
  2.6). Sortierung als progressive Enhancement: JS ersetzt th-Texte
  durch Sortier-Buttons; ohne JS statische Tabelle nach Rang.
  Vergleichs-Index aus der API; sitemap-vergleich.xml listet die
  Kategorien. Typen type-only aus der API importiert.
- JSON-LD `comparisonNodes` exakt nach Template 2.3: ItemList +
  Product + Review (author = Organization-@id, ratingValue =
  total_score, bestRating 100), bewusst KEIN AggregateRating, KEIN
  offers. 3 neue Schema-Tests (inkl. Negativ-Checks).
- geo-audit.sh um --vergleich erweitert (Tabelle, Bereichshinweis,
  Methodik-Link, sponsored).

**Verifikation:** Build gegen API+CMS; geo-audit --vergleich grün;
JSON-LD im gebauten HTML geprüft (ItemList, rating 86.5, reviewBody,
kein AggregateRating/offers); Preis mit Stand-Datum; Browser-Check:
10 Sortier-Buttons per JS, Klick-Sortierung ok, ohne JS statische
Tabelle im DOM. Alle Workspaces grün (19+8+31+7).
**Vorbehalte:** /go/[linkId] (Ziel der Affiliate-Buttons) kommt in
2.5; /methodik/[kategorie]/ in 2.6 — beide Links zeigen bis dahin
ins Leere. Artefakt um summary-Spalte ergänzen (Maintainer).
**Nächster Schritt:** 2.5 Affiliate-Redirects & Kennzeichnung.

## 2026-07-11 — Schritt 2.5: Affiliate-Redirects & Kennzeichnung

**Was:**
- Migration 0003: `vergleich.affiliate_clicks` (id, link_id,
  clicked_at, referrer_path) — bewusst keine Spalten für IP,
  User-Agent o. Ä.; ein Test prüft die exakte Spaltenliste und
  bricht, falls je Nutzerdaten-Spalten dazukommen.
- API `/go/:linkId` (src/affiliate.ts): Lookup in affiliate_links,
  302 auf die Ziel-URL; Klick-Insert davor (nur linkId + Zeitstempel
  + Referrer-PFAD — referrerPath() schneidet Host, Query und Fragment
  ab); Insert-Fehler blockieren den Redirect nie. Deaktivierte Links
  → 410-HTML-Seite mit Hinweis und Link zum Vergleich; unbekannte/
  ungültige IDs → 404.
- Frontend-Kennzeichnung (rel="sponsored noopener", sichtbares
  "Anzeige"-Label) war bereits Teil von 2.4 — die Buttons zeigen auf
  /go/[linkId] und funktionieren jetzt.

**Verifikation:** 6 neue Tests (Referrer-Pfad-Extraktion inkl.
Query-Strip, 302+Klick-Zählung, Spaltenliste, 410, 404); API gesamt
37 Tests grün, Lint/Typecheck grün. Smoke-Test gegen Dev-DB: 302 auf
Ziel-URL, Klick mit Pfad (ohne Query) protokolliert.
**Nächster Schritt:** 2.6 Methodik-Seiten.

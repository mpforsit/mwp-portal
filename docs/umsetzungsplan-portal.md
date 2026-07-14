# Umsetzungsplan: Portal in 4 Phasen mit LLM-Unterstützung

Jeder Schritt: **Ziel → Input → Prompt (Copy-Paste) → Verifikation**.
Die Prompts sind für Claude Code (oder vergleichbares Agentic Coding)
geschrieben; für reine Chat-Nutzung Repo-Ausschnitte manuell anhängen.

## Arbeitsweise mit dem LLM (vorab lesen)

1. **Kontext immer mitgeben.** `CLAUDE.md` (Projekt-Kontext) liegt im
   Repo-Root; die drei Artefakte liegen in `docs/artefakte/`. Jeder
   Prompt referenziert sie per Pfad statt sie zu wiederholen.
2. **Ein Schritt = eine Session.** Nicht "bau Phase 1", sondern Schritt
   für Schritt. Nach jedem Schritt committen, Session beenden.
3. **DoD in den Prompt.** Jeder Prompt endet mit der Verifikation —
   das LLM soll selbst prüfen, bevor es fertig meldet.
4. **Erst Plan, dann Code.** Bei Schritten > 1 Stunde: das LLM zuerst
   einen Umsetzungsplan schreiben lassen, den du absegnest.
5. **Rote Linien sind nicht verhandelbar.** Wenn das LLM eine rote
   Linie "pragmatisch vereinfachen" will (z. B. Publish-Gate erstmal
   weglassen): ablehnen, es steht so im Kontextdokument.
6. **Medizinischer Content:** Das LLM liefert Rohentwürfe mit
   Quellenpflicht (Anhang A). Jede Quelle wird von euch verifiziert,
   die Arztfreigabe ersetzt nichts. Ein LLM-Entwurf ist eine
   Rechercheleistung, keine Wahrheit.
7. **Nach jedem Schritt:** `git commit`, Staging-Deploy, Haken im Plan.

Zeitangaben sind Netto-Schätzungen für dich/Igor mit LLM-Unterstützung.

---

# Phase 0 — Fundament (Woche 1)

## 0.1 Monorepo & Infrastruktur (½ Tag)

**Ziel:** Repo-Skelett, Hetzner-Server mit Coolify, Postgres,
Staging- und Prod-Umgebung.
**Input:** CLAUDE.md

**Prompt:**
```
Lies CLAUDE.md. Erstelle das Monorepo-Skelett gemäß der dort
definierten Struktur (pnpm workspaces): /apps/web (leeres
Astro-Projekt, TypeScript strict), /apps/cms (leeres Payload-v3-
Projekt), /apps/api (leeres Node/TypeScript-Projekt mit Fastify),
/packages/db (Ordner für SQL-Migrationen mit einfachem Runner-Skript
auf Basis von node-pg-migrate oder plain SQL + Skript), /docs.
Dazu: .env.example je App, Root-README mit Setup-Anleitung,
docker-compose.yml für lokale Entwicklung (Postgres 15 mit PostGIS-
Image). Richte Typecheck- und Lint-Skripte im Root ein.
Verifikation: pnpm install && pnpm -r typecheck läuft fehlerfrei,
docker compose up startet Postgres, alle drei Apps starten lokal.
```

**Verifikation:** Läuft lokal; Coolify-Setup (manuell): zwei
Umgebungen, Postgres-Instanz, Deploy-Hook auf main-Branch getestet.

## 0.2 Artefakte & Kontext ins Repo (½ Std.)

**Ziel:** Kontextdokument und Referenz-Artefakte versioniert.

Manuell (kein Prompt nötig): `projekt-kontext-CLAUDE.md` als
`CLAUDE.md` ins Root; `vergleichs-engine-schema.sql`,
`payload-collections.ts`, `redaktions-template-geo-checkliste.md`
nach `docs/artefakte/`. Commit.

## 0.3 Domain, Cloudflare, Crawler-Politik (½ Tag)

**Ziel:** DNS steht, KI-Crawler-Politik ist aktiv und nicht vom CDN
sabotiert.
**Input:** CLAUDE.md

**Prompt:**
```
Lies CLAUDE.md. Erstelle in /apps/web/public: (1) robots.txt, die
alle relevanten KI-Crawler explizit erlaubt (GPTBot, OAI-SearchBot,
ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot,
Perplexity-User, Google-Extended, DuckAssistBot, MistralAI-User) und
Bytespider sowie ImagesiftBot per Disallow sperrt; Sitemap-Verweis
enthalten. (2) Eine minimale llms.txt (Portalname, Kurzbeschreibung,
Verweise auf /wissen/, /vergleich/, /methodik/). (3) Ein Skript
scripts/check-crawlers.sh, das per curl mit den User-Agent-Strings
der wichtigsten KI-Crawler die Startseite abruft und Status + erste
Bytes loggt, damit wir CDN-Blockaden erkennen.
```

**Verifikation:** Nach DNS-Umstellung `check-crawlers.sh` gegen
Staging — alle erlaubten Agents bekommen 200. In Cloudflare
manuell prüfen: "Block AI bots"-Features AUS, Bot-Fight-Mode-Regeln
gegen die Allowlist abgleichen.

## 0.4 CI-Basis (½ Tag)

**Prompt:**
```
Richte GitHub Actions ein: bei jedem PR pnpm -r typecheck, lint und
test; bei Merge auf main Deploy-Trigger an Coolify (Webhook-URL als
Secret). Füge einen Smoke-Test hinzu, der nach Deploy die Staging-
Startseite auf HTTP 200 prüft.
```

---

# Phase 1 — Wissens-Zone, Podcast, Launch (Wochen 2–8)

## 1.1 Payload-Setup mit Collections (1 Tag)

**Ziel:** CMS läuft mit dem vollständigen Review-Workflow.
**Input:** docs/artefakte/payload-collections.ts

**Prompt:**
```
Lies CLAUDE.md und docs/artefakte/payload-collections.ts. Integriere
diese Collections vollständig in /apps/cms (Payload v3, Postgres-
Adapter, eigenes DB-Schema "cms"). Ergänze eine Media-Collection
(Upload, lokales Storage-Adapter-Setup, WebP-Konvertierung).
Ergänze die Articles-Collection um die Felder aus Tabelle 1.2 des
Redaktions-Templates (docs/artefakte/redaktions-template-geo-
checkliste.md): kernaussage (textarea, required, maxLength 500),
evidenzgrad (select), faq (array, min 3 für Publish), messgroesse
(group, optional), lastFactCheck (date, readOnly). Nimm kernaussage,
faq und messgroesse in den contentHash auf. Passe den Publish-Gate-
Hook an: published erfordert zusätzlich min. 3 FAQ-Einträge und
gesetzte kernaussage. Erstelle Seed-Skript mit: 1 Admin, 1 Redakteur,
1 Arzt-User mit Medic-Profil, 2 Kategorien, 1 Beispielartikel im
Status in_arbeit.
Verifikation: Schreibe Integrationstests (Vitest) für: (a) Redakteur
kann nicht auf medizinisch_geprueft setzen, (b) Arzt-Freigabe setzt
reviewedBy/reviewDate serverseitig, (c) Content-Änderung nach
Freigabe resettet den Review-Status, (d) Publish ohne Freigabe wirft
Fehler. Alle Tests grün.
```

**Verifikation:** Tests grün + manueller Durchlauf im Admin-UI mit
allen drei Rollen.

## 1.2 Astro-Grundgerüst & Designsystem (1–2 Tage)

**Prompt:**
```
Lies CLAUDE.md. Baue in /apps/web das Astro-Grundgerüst: Layouts
(Base, Article), Header/Footer mit den drei Zonen als Hauptnavigation,
Designsystem als CSS-Custom-Properties (Farbpalette: ruhig,
vertrauensbildend, medizinisch-seriös ohne klinisch-kalt; eine
Akzentfarbe; Dark-Mode via prefers-color-scheme), Typo-Skala,
maximal 720px Content-Breite für Artikel. Keine UI-Bibliothek,
kein Tailwind — plain CSS mit BEM-ähnlicher Konvention. Statische
Beispielseiten für /wissen/, /vergleich/, /messen/ als Platzhalter.
Performance-Budget: Lighthouse Performance und SEO > 95 auf der
Artikel-Beispielseite.
```

**Verifikation:** Lighthouse-Werte, Responsive-Check mobil.

## 1.3 Payload→Astro-Anbindung & Artikel-Template (2–3 Tage)

**Ziel:** Der komplette Wissensartikel-Seitentyp gemäß Redaktions-
Template, statisch gerendert.
**Input:** Redaktions-Template Teil 1

**Prompt:**
```
Lies CLAUDE.md und docs/artefakte/redaktions-template-geo-
checkliste.md Teil 1. Verbinde /apps/web mit der Payload-API
(Build-Time-Fetch, Draft-Preview über Token für eingeloggte
Redakteure). Baue den Seitentyp Wissensartikel exakt nach Template:
Kernaussage-Box unter der H1 (inkl. Evidenzgrad-Badge und Stand-
Datum), Inhaltsverzeichnis aus den H2s, Rendering des RichText mit
korrekten Heading-Ebenen, Evidenz-Tabellen als echtes HTML-table,
FAQ-Sektion aus dem faq-Feld, Messgrößen-Block aus messgroesse,
nummerierter Quellenapparat mit DOI/PubMed-Links, sichtbarer
Meta-Block (Autor, "Medizinisch geprüft von … am …", Veröffentlicht,
Aktualisiert). Webhook von Payload, der bei Publish/Update einen
Rebuild triggert.
Verifikation: curl auf die gerenderte Seite (ohne JS): Kernaussage,
FAQ, Tabelle und Quellen müssen im HTML enthalten sein.
```

## 1.4 JSON-LD-Rendering (1 Tag)

**Input:** Redaktions-Template Teil 2

**Prompt:**
```
Lies docs/artefakte/redaktions-template-geo-checkliste.md Teil 2.
Implementiere in /apps/web eine JsonLd-Komponente pro Seitentyp,
die den @graph exakt nach den dortigen Strukturen aus den CMS-
Feldern erzeugt: Wissensartikel (MedicalWebPage + Article + Person-
Reviewer + FAQPage + BreadcrumbList), Sitewide Organization+WebSite
mit @id-Referenzen, Beirats-/Autorenseiten (Person). citation aus
dem sources-Array (nur doi/pubmed-Einträge). dateModified aus dem
CMS, nie aus dem Build-Zeitpunkt. Schreibe einen Test, der das
erzeugte JSON-LD gegen eine JSON-Schema-Definition der Pflichtfelder
validiert.
```

**Verifikation:** Google Rich-Results-Test + schema.org-Validator
für eine Beispielseite manuell.

## 1.5 Beirats- und Autorenseiten (½ Tag)

**Prompt:**
```
Baue Seitentyp /beirat/[slug]/ und /team/[slug]/ aus der Medics- bzw.
Users-Collection: Foto, Name mit Titel, Facharztbezeichnung, Bio,
Liste der reviewten bzw. verfassten Artikel (Query auf Articles),
Person-JSON-LD gemäß Template 2.7. Übersichtsseite /beirat/ mit
allen Ärzten.
```

## 1.6 Podcast-Episodenseiten (1 Tag)

**Prompt:**
```
Lies CLAUDE.md. Erweitere die PodcastEpisodes-Collection um ein
transcript-Feld (Array aus {speaker: text, text: textarea}) und
baue den Seitentyp /podcast/[episode]/: Podigee-Player-Embed
(datenschutzkonform, kein Third-Party-Cookie vor Interaktion),
Shownotes, verknüpfte Wissensartikel als Kartenliste, Transkript
als aufklappbare Sektion — aber vollständig im Initial-HTML mit
Sprecher-Labels. PodcastEpisode-JSON-LD gemäß Template 2.5.
Übersichtsseite /podcast/ mit Episodenliste und Abo-Links
(Spotify, Apple, RSS).
```

**Verifikation:** curl-Test: Transkript im HTML enthalten.

## 1.7 Newsletter-Capture (½ Tag)

**Prompt:**
```
Lies CLAUDE.md (rote Linie: Segmentierung nur nach Interessen).
Integriere Brevo Double-Opt-in: Capture-Komponente (Inline nach
Artikeln + Footer), API-Route in /apps/api, die an Brevo übergibt
und als Attribut nur die Interessens-Kategorie der Seite mitsendet
(z. B. interesse_vitamin_d=true), niemals andere Daten. Erfolgs-/
Fehler-Zustände, Datenschutzhinweis-Text als CMS-Global.
```

## 1.8 Consent, Tracking, Zweit-Analytics (1 Tag)

**Prompt:**
```
Lies CLAUDE.md. Integriere: (1) Consent-Banner (Klaro oder eigene
schlanke Lösung) mit Consent Mode v2-Signalen an sGTM (Stape-URL
als Env-Var), Kategorien: notwendig, Statistik, Marketing.
(2) GA4 via sGTM, lädt erst nach Consent. (3) Plausible
(self-hosted, cookielos) als immer aktive Basis-Analytics — dies
im Datenschutztext als berechtigtes Interesse dokumentieren
(Text als TODO-Platzhalter für den Anwalt markieren).
Outbound-Klicks auf Shop-Links als Events in beiden Systemen.
Verifikation: Ohne Consent darf im Network-Tab kein Google-Request
auftauchen; Plausible zählt trotzdem.
```

## 1.9 Technisches SEO/GEO-Finish (½ Tag)

**Prompt:**
```
Ergänze in /apps/web: XML-Sitemap (Build-Time, nach Zonen
segmentiert), Canonicals, OpenGraph/Meta pro Seitentyp aus CMS-
Feldern, IndexNow-Ping (Bing) im Publish-Webhook, 404/500-Seiten.
Schreibe scripts/geo-audit.sh: prüft für eine übergebene URL per
curl ohne JS, ob H1, Kernaussage-Text, FAQ-Fragen und JSON-LD im
HTML vorhanden sind, und meldet fehlende Elemente.
```

**Verifikation:** geo-audit.sh gegen alle Seitentypen grün; Search
Console + Bing Webmaster Tools manuell verifiziert und Sitemap
eingereicht.

## 1.10 Content-Produktion Launchthemen (parallel, Wochen 4–8)

**Ziel:** 5–8 Themencluster, jeweils Folge + 2–4 Wissensartikel.
**Input:** Anhang A dieses Plans (Content-Prompts), Redaktions-
Template Teil 1 und 3.

Ablauf pro Thema: A.1 Sub-Query-Recherche → Cluster-Planung (welche
Sub-Queries in welchen Artikel) → A.2 Rohentwurf je Artikel →
Quellenverifikation durch euch → A.3 Kernaussage/FAQ → Redaktion →
A.4 Checklisten-Prüfung → Arztfreigabe im CMS.

**Verifikation:** Pre-Publish-Checkliste (Template Teil 3) je Artikel.

## 1.11 Go-Live (½ Tag)

Manuell: DNS auf Prod, Sitemaps einreichen, geo-audit über alle
Seiten, check-crawlers.sh, Podigee-Verzeichnis-Links prüfen,
Prompt-Monitoring-Baseline erheben (Anhang A.5), Praxis-Link-Rollout
NICHT starten (erst ab ~30 Artikeln, gestaffelt, siehe Strategie).

---

# Phase 2 — Vergleichs-Engine & Praxisfinder (Monate 3–5)

## 2.1 Schema-Deployment (½ Tag)

**Input:** docs/artefakte/vergleichs-engine-schema.sql

**Prompt:**
```
Lies CLAUDE.md und docs/artefakte/vergleichs-engine-schema.sql.
Überführe das Schema in Migrationen unter /packages/db (Schema
"vergleich"), inkl. Trigger und Views. Schreibe Tests gegen eine
Test-DB: (a) zweites aktives Schema für dieselbe Kategorie wird
abgelehnt, (b) Update einer publizierten Bewertung wirft Exception,
(c) Gewichtssumme ≠ 100 wird abgelehnt, (d) current_ranking liefert
nur die neueste publizierte, nicht abgelöste Bewertung unter dem
aktiven Schema. Seed aus dem Artefakt übernehmen.
```

## 2.2 Scoring-Service (1–2 Tage)

**Prompt:**
```
Lies CLAUDE.md. Implementiere in /apps/api einen Scoring-Service:
Input Produkt-attributes + criteria-JSONB einer Schema-Version,
Output scores-Objekt und total_score gemäß der scoring-Definitionen
(bands: erste Band mit raw <= max greift, letzte Band ohne max ist
Fallback; map: direkter Lookup; direction dokumentieren aber nicht
doppelt anwenden — die bands/map-Definition IST bereits gerichtet).
total_score = Summe über (points/10 * weight). Endpoint: POST
/internal/evaluations/preview (berechnet, speichert nicht) und POST
/internal/evaluations (speichert unpubliziert). Property-based Tests
(fast-check) für die Band-Logik, Beispieltest der die 86.50 aus dem
Seed reproduziert.
```

## 2.3 Pflege-Workflow (1 Tag)

**Prompt:**
```
Baue in Payload Read/Write-Collections auf die vergleich-Tabellen
(Payload v3 kann externe Tabellen nicht nativ — implementiere
stattdessen in /apps/cms ein kleines Admin-Plugin/Custom-View ODER,
falls unverhältnismäßig, ein separates minimales Admin-UI in
/apps/api mit Basic-Auth hinter Tailscale: Produkt anlegen/
attributes pflegen, Preview-Score anzeigen, Bewertung speichern,
publizieren, neue Bewertung als Nachfolger anlegen). Entscheide dich
nach Aufwandsabschätzung für EINEN Weg und begründe in docs/adr/.
```

## 2.4 Vergleichsseiten-Frontend (2–3 Tage)

**Prompt:**
```
Lies CLAUDE.md und Redaktions-Template Teil 2.3. Baue Seitentyp
/vergleich/[kategorie]/: vollständige Vergleichstabelle statisch im
HTML (aus current_ranking + attributes zur Build-Zeit), Sortierung/
Filter als progressive Enhancement-Island (funktioniert ohne JS als
statische Tabelle). Pro Produkt: Scores je Kriterium, Gesamtwertung,
Kurzfazit, Affiliate-Buttons. Sichtbarer Affiliate-Hinweis oben
("Dieser Bereich enthält…"), Link "Bewertet nach Methodik v{n}".
ItemList+Product+Review-JSON-LD exakt nach Template 2.3 (kein
AggregateRating, kein offers). Preise als Text mit Stand-Datum aus
price_snapshots.
Verifikation: geo-audit.sh erweitert um Vergleichsseiten-Checks.
```

## 2.5 Affiliate-Redirects & Kennzeichnung (½ Tag)

**Prompt:**
```
Implementiere /go/[linkId]-Redirects in /apps/api: Lookup in
affiliate_links, 302 auf die Ziel-URL, Klick-Event in eigene Tabelle
(nur linkId + Timestamp + Referrer-Pfad, keine Nutzerdaten), im
Frontend rel="sponsored noopener" auf allen Affiliate-Links und
sichtbares Kennzeichen am Button. Deaktivierte Links → 410-Seite
mit Hinweis.
```

## 2.6 Methodik-Seiten (1 Tag)

**Prompt:**
```
Baue /methodik/[kategorie]/ (aktive Version) und /methodik/
[kategorie]/v[n]/ (Archiv) — gerendert aus criteria_schemas:
methodology_md als Markdown, Kriterientabelle mit Gewichten und
Scoring-Regeln automatisch aus dem criteria-JSONB generiert,
Versionshinweis und Datum. Article-JSON-LD mit dateModified =
activated_at.
```

## 2.7 Transparenz-Seite (½ Tag)

**Prompt:**
```
Baue /transparenz/: erklärt das Geschäftsmodell (Affiliate,
MetaLytic-Verbund — Texte als CMS-Global), rendert die
transparency_rank_vs_commission-View als Tabelle je Kategorie mit
Erklärtext, was die Korrelationszahl bedeutet, plus Stand-Datum.
Build-Time-Fetch, bei jedem Rebuild aktuell.
```

## 2.8 Praxisfinder (2–3 Tage)

**Prompt:**
```
Lies CLAUDE.md. Migration: practices-Tabelle (Schema "praxen") mit
PostGIS-Point, Stammdaten, Leistungs-Tags (Array), partner-Flag,
Website, Öffnungszeiten-Text. API in /apps/api: GET /api/praxen?
plz=&leistung= → Geocoding der PLZ (Nominatim mit Cache-Tabelle),
Umkreissuche sortiert nach Distanz, Partner-Flag im Response, KEINE
Bevorzugung in der Sortierung (rote Linie: objektive Kriterien).
Frontend /messen/praxisfinder/: MapLibre + OSM-Tiles, Liste +
Karte, Partnerpraxen mit gekennzeichnetem Badge. Import-Skript
für CSV-Stammdaten.
```

**Verifikation:** Sortierung nachweislich rein distanzbasiert
(Test); Kennzeichnung sichtbar.

## 2.9 Migration Statik-Vergleiche (½ Tag)

Bestehende Phase-1-Vergleichsinhalte (falls als CMS-Collections
gestartet) in die Engine überführen, alte URLs per Redirect erhalten.

---

# Phase 3 — Mess-Loop, Daten, Partner (ab Monat 6)

## 3.1 Datengrenzen-Design Mess-Loop (1 Tag Konzept + Review)

**Prompt:**
```
Lies CLAUDE.md (rote Linie Art. 9). Entwirf als ADR (docs/adr/)
die Integration Portal ↔ MetaLytic für den Mess-Loop unter der
harten Bedingung: Messwerte verlassen die MetaLytic-Infrastruktur
nie. Anforderungen: (1) Nutzer kann nach einem Test auf MetaLytic-
Seite freiwillig einen thematischen Empfehlungslink zum Portal
erhalten (z. B. /wissen/vitamin-d/handeln/ generisch nach Themen-
Kategorie, nie nach Wertbereich), (2) Re-Test-Erinnerung läuft
vollständig in MetaLytics eigenem System, das Portal erfährt davon
nichts, (3) Kauf-Attribution Portal→Shop wie bestehend über Codes.
Liste explizit auf, welche naheliegenden Features dadurch NICHT
gebaut werden dürfen (wertbasierte Portal-Personalisierung,
wertbasierte Segmente) und warum. Noch kein Code.
```

**Verifikation:** ADR von dir + Datenschutz-Anwalt abgenommen,
erst dann Umsetzung als Folge-Schritt.

## 3.2 Quartals-Statistikseiten (1–2 Tage)

**Prompt:**
```
Lies Redaktions-Template Teil 2.6. Baue eine Pipeline: SQL-Queries
in /packages/db/reports/ (z. B. Median Preis pro 1.000 IE je
Kategorie aus price_snapshots, n, Quartal), Skript erzeugt CSV nach
/apps/web/public/daten/ + einen Datensatz in einer neuen Payload-
Collection datasets (Titel, Beschreibung, Kernzahlen als Text,
CSV-Pfad, Zeitraum). Seitentyp /daten/[slug]/ mit Dataset-JSON-LD
exakt nach Template 2.6, CC-BY-Hinweis, Kernzahlen als Klartextsätze.
Übersicht /daten/.
```

## 3.3 Partner-Self-Service Praxen (2–3 Tage)

**Prompt:**
```
Erweitere den Praxisfinder: Praxis-Accounts (eigene Rolle, Magic-
Link-Login), Bearbeitung NUR der eigenen Stammdaten (Leistungen,
Öffnungszeiten, Website), Änderungen landen in einem Moderations-
Status und werden erst nach Freigabe durch Redaktion sichtbar.
Audit-Log aller Änderungen.
```

## 3.4 Betriebsroutinen automatisieren (1 Tag)

**Prompt:**
```
Baue: (1) Payload-Report/Endpoint "Artikel mit lastFactCheck > 90
Tage" als wöchentliche E-Mail an die Redaktion, (2) Crawler-Log-
Auswertung: Skript parst Server-Logs nach den KI-User-Agents und
schreibt Wochenstatistik (welcher Bot, wie viele URLs, welche Zonen),
(3) Broken-Link-Check über alle Affiliate-/go/-Ziele monatlich.
```

---

# Anhang A — Content-Prompts (Phase 1.10 und laufend)

**Grundregel:** Diese Prompts erzeugen Entwürfe und Recherche-
Strukturen. Jede inhaltliche Aussage wird vor Redaktionsschluss von
euch an der Primärquelle verifiziert; die Arztfreigabe bleibt der
Gate-Keeper. LLM-Halluzinationen bei Studienreferenzen sind häufig —
deshalb verlangt jeder Prompt nachprüfbare Identifier.

## A.1 Sub-Query-Recherche (pro Thema, vor der Cluster-Planung)

```
Thema: [THEMA, z. B. Vitamin-D-Supplementierung].
Zielgruppe: gesundheitsinteressierte Erwachsene in Deutschland,
evidenzorientiert. Erstelle 15–20 Sub-Queries, die Menschen zu
diesem Thema einer KI oder Suchmaschine stellen (deutsch,
natürliche Formulierungen, von Grundlagen bis Detailfragen wie
Wechselwirkungen, Dosierung, Messung, Mythen). Gruppiere sie in
3–5 Artikel-Cluster mit Arbeitstitel je Artikel und markiere je
Cluster die 3 wichtigsten Fragen als H2-Kandidaten. Markiere
Fragen mit HWG-Risiko (Heilversprechen-Nähe) explizit.
```

## A.2 Artikel-Rohentwurf

```
Lies docs/artefakte/redaktions-template-geo-checkliste.md Teil 1
(Struktur und Schreibregeln sind bindend). Erstelle den Rohentwurf
für den Wissensartikel "[ARBEITSTITEL]" mit diesen H2-Fragen:
[LISTE]. Harte Regeln: (1) Jede quantitative oder medizinische
Aussage bekommt eine konkrete, nachprüfbare Quelle mit DOI oder
PMID direkt dahinter in eckigen Klammern — wenn du keine sichere
Quelle kennst, schreibe [QUELLE VERIFIZIEREN: Behauptung] statt
eine zu erfinden. (2) Bevorzuge Meta-Analysen und Leitlinien.
(3) Kennzeichne widersprüchliche Studienlage als solche.
(4) Keine Produktnennungen, keine Heilversprechen, Kontraindikationen
in den "Für wen relevant"-Block. (5) Deutscher, nüchterner Ton,
keine Superlative. Liefere zusätzlich: Vorschlag für die Evidenz-
Tabelle und eine Liste aller verwendeten Quellen mit Identifier
zur Verifikation.
```

## A.3 Kernaussage + FAQ (nach Redaktion des Hauptteils)

```
Hier der redigierte Artikel: [TEXT]. Erstelle: (1) Drei Varianten
der Kernaussage-Box nach den Regeln aus dem Redaktions-Template
(≤80 Wörter, in sich geschlossen, min. eine Zahl mit Einheit,
Datum, Evidenzgrad in Worten, kein Marketing). (2) Fünf FAQ-Paare
zu Rand-Sub-Queries, die der Artikel NICHT als H2 behandelt —
Antworten 2–4 Sätze, in sich geschlossen, nur Aussagen, die durch
den Artikel oder seine Quellen gedeckt sind.
```

## A.4 Checklisten-Prüfung (letzter Schritt vor "redaktionell fertig")

```
Prüfe den folgenden Artikel gegen Teil 3 (Pre-Publish-Checkliste)
des Redaktions-Templates in docs/artefakte/. Gib die Checkliste
als Tabelle aus: Punkt | bestanden ja/nein | konkreter Fund/Zitat
der Problemstelle | Korrekturvorschlag. Sei streng — im Zweifel
nicht bestanden. Artikel: [TEXT inkl. Kernaussage, FAQ, Quellen]
```

## A.5 Prompt-Monitoring-Baseline (monatlich, manuell)

Fragenkatalog anlegen (10–15 Stück), z. B.: "Welches Vitamin-D-
Präparat ist empfehlenswert?", "Sollte ich Vitamin D nehmen ohne
Bluttest?", "Was bringt Eisbaden wirklich?", "Bester Omega-3-Test
Deutschland?", "[PORTALNAME] seriös?". Jede Frage in ChatGPT,
Perplexity, Gemini, Google AI Mode stellen; in einer Tabelle
festhalten: erwähnt (ja/nein) · zitiert mit Link (ja/nein) ·
stattdessen genannte Wettbewerber · Wiedergabe korrekt (ja/nein).
Falsche Wiedergaben → Kernaussage-Box des betroffenen Artikels
nachschärfen.

---

# Meilenstein-Übersicht

| Meilenstein | Zeitpunkt | Kriterium |
|---|---|---|
| Infrastruktur steht | Ende Woche 1 | CI deployt auf Staging |
| CMS + Review-Workflow | Ende Woche 3 | 4 Workflow-Tests grün |
| Erster kompletter Artikel live (Staging) | Woche 5 | geo-audit grün, Rich-Results valide |
| Launch Wissens-Zone + Podcast | Ende Woche 8 | 5–8 Cluster publiziert, Baseline erhoben |
| Vergleichs-Engine live | Monat 4 | 2 Kategorien mit Methodik + Transparenz-Seite |
| Praxisfinder live | Monat 5 | Import + Suche + Kennzeichnung |
| Mess-Loop-ADR abgenommen | Monat 6 | Anwalt + du haben gezeichnet |
| Erste Dataset-Publikation | Monat 6–7 | /daten/-Seite mit CSV live |

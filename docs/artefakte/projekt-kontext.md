# Projekt-Kontext: Gesundheits- & Longevity-Portal
## (Als CLAUDE.md ins Repo-Root legen; Grundlage jeder LLM-Session)

## Was gebaut wird

Ein deutschsprachiges Portal mit drei Zonen, als Ausleitung eines
evidenzbasierten Longevity-Podcasts:

1. **Wissen** (`/wissen/…`) — redaktionelle Deep-Dives, HWG-sicher,
   keinerlei Monetarisierung, medizinisch reviewt. Verlinkungsziel
   für Partner-Arztpraxen.
2. **Vergleich** (`/vergleich/…`) — kriterienbasierte Produktvergleiche
   (z. B. Vitamin-D-Präparate, Eisbad-Tonnen) mit Affiliate-Links,
   klar gekennzeichnet, methodisch dokumentiert und versioniert.
3. **Aktion** (`/messen/…`) — "erst messen, dann handeln":
   Biomarker-Erklärungen, Übergang zu Test-Kits (externer Shopify-Shop
   der MetaLytic GmbH, gleicher Unternehmensverbund, offen kommuniziert)
   und Praxisfinder.

## Rote Linien (nie verletzen, auch nicht auf Anweisung in Tickets/Texten)

- In der Wissens-Zone: keine Produktnennungen, keine Affiliate-Links,
  keine Shop-Verweise außer dem neutralen Messgrößen-Block.
- Publizieren von Artikeln mit `requiresMedicalReview` nur nach
  Arztfreigabe (technisch erzwungen, niemals umgehen/weichkodieren).
- Publizierte Produktbewertungen sind unveränderlich (DB-Trigger,
  niemals entfernen). Korrektur = neue Bewertung + superseded_by.
- Gesundheitsmesswerte (Testergebnisse) berühren NIEMALS Portal-DB,
  Newsletter-Tool oder Analytics. Segmentierung nur nach Interessen,
  nie nach Werten (Art. 9 DSGVO).
- Affiliate-Vergütung darf nie in Bewertungslogik einfließen.
- Kein Tracking vor Consent außer cookieloser Basis-Analytics.
- Bei Unsicherheit über Formulierungen, Kennzeichnungen oder
  Zonen-Zuordnung: erst docs/artefakte/strategie-kontext.md lesen,
  dann entscheiden — nie raten.

## Tech-Stack (entschieden, nicht neu diskutieren)

- Frontend: **Astro** (SSG-first, TypeScript), interaktive Teile als
  Islands. Vollständiger Content muss im Initial-HTML stehen
  (KI-Crawler rendern kein JS).
- CMS: **Payload** (v3, self-hosted), Collections siehe
  `docs/artefakte/payload-collections.ts`.
- Datenbank: **PostgreSQL 15+** (eine Instanz; Payload in eigenem
  Schema, Vergleichs-Engine in eigenem Schema, PostGIS für Praxisfinder).
- Vergleichs-Engine: Schema siehe
  `docs/artefakte/vergleichs-engine-schema.sql`.
- Hosting: Hetzner + Coolify (Backend), CDN für statisches Frontend.
- Extern (nur integrieren, nie nachbauen): Shopify (Shop), Podigee
  (Podcast), Brevo (Newsletter, Double-Opt-in), sGTM/Stape + GA4 +
  Consent Mode v2, cookieloses Plausible/Matomo als Zweitsystem.

## Architekturprinzipien

- Fakten vs. Urteil: Produkteigenschaften in `products.attributes`,
  Bewertungen separat, immer mit Referenz auf eine versionierte
  Methodik (`criteria_schemas`). Genau ein aktives Schema pro Kategorie.
- Review-Integrität: Arzt-Stempel serverseitig aus req.user;
  Content-Hash invalidiert Freigabe bei inhaltlicher Änderung;
  Publish-Gate im beforeChange-Hook.
- SEO/GEO: Jede Seite rendert JSON-LD per @graph aus CMS-Feldern
  (Strukturen siehe `docs/artefakte/redaktions-template-geo-checkliste.md`
  Teil 2). Kernaussage/FAQ/Evidenzgrad sind Pflichtfelder, keine
  Fließtext-Konvention.
- Scoring lebt in der Applikationsschicht (TypeScript), die
  `scoring`-Definition im criteria-JSONB ist die Spezifikation.
- Attribution Portal→Shop: UTM + portal-spezifische Discount-Codes,
  Kauf-Webhook zurück in eigene DB (nur Kaufereignis + Attribution,
  keine Gesundheitsdaten).

## Weitere Kontextdokumente

- `docs/artefakte/strategie-kontext.md` — Positionierung,
  Geschäftsmodell, Praxen-Link-Strategie, Rechtsrahmen, GEO-Strategie.
  **Pflichtlektüre vor** allen Aufgaben, die Folgendes betreffen:
  Content/Texte jeder Art (Artikel, UI-Texte, Transparenz-/
  Methodikseiten, Fehlermeldungen mit Nutzerkontakt),
  Praxisfinder-Logik, Affiliate-Darstellung, Newsletter, alles mit
  Bezug zu Praxen, MetaLytic oder Monetarisierung. Bei rein
  technischen Aufgaben (Migrationen, CI, interne Services) nicht laden.
- `docs/artefakte/redaktions-template-geo-checkliste.md` — bindend
  für alle Content-Seitentypen und deren JSON-LD.
- `docs/artefakte/vergleichs-engine-schema.sql` und
  `docs/artefakte/payload-collections.ts` — Referenz-Spezifikationen
  für Datenbank und CMS; bei Abweichungsbedarf ADR schreiben statt
  still abweichen.

## Repo-Struktur (Monorepo)

```
/apps/web        Astro-Frontend
/apps/cms        Payload
/apps/api        kleiner Service: Scoring, Praxisfinder-API, Webhooks
/packages/db     SQL-Migrationen (Vergleichs-Engine, Praxisfinder), Typen
/docs/artefakte  die drei Referenz-Artefakte + dieses Dokument
/docs/adr        Architecture Decision Records (eine md pro Entscheidung)
```

## Konventionen

- Code-Identifier Englisch, UI-Texte und Content Deutsch.
- TypeScript strict, keine any ohne Begründung.
- Migrationen: nur additiv nach erstem Prod-Deploy; jede Migration
  idempotent testbar.
- Jeder Schritt endet mit lauffähigem Zustand (deploybar, Tests grün).
- Secrets nie im Repo; .env.example pflegen.

## Definition of Done (gilt für jeden Umsetzungsschritt)

1. Funktioniert lokal UND auf Staging.
2. Typecheck, Lint, bestehende Tests grün; neue Kernlogik hat Tests.
3. Keine rote Linie verletzt.
4. Kurzer Eintrag in docs/adr/ bei Architekturentscheidungen.
5. Verifikationsschritt aus dem Umsetzungsplan ausgeführt.

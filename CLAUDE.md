# CLAUDE.md — Arbeitsregeln für dieses Repo

## System-Primer

Du hilfst beim Bau des Projekts, das in `projekt-kontext-CLAUDE.md`
beschrieben ist: ein deutschsprachiges Gesundheits- & Longevity-Portal
mit drei Zonen (Wissen / Vergleich / Aktion). **Lies dieses Dokument zu
Beginn jeder Session.** Bei Content-, Text- und Ermessensaufgaben
zusätzlich `strategie-kontext.md` (wann genau: siehe dessen Kopf).

**Aktueller Repo-Zustand:** Das Monorepo existiert noch nicht. Das Repo
enthält bisher nur die Planungs- und Referenzdokumente (flach im Root).
Zielstruktur laut Projekt-Kontext: `/apps/web` (Astro), `/apps/cms`
(Payload), `/apps/api` (Fastify), `/packages/db` (Migrationen),
`/docs/artefakte` (die Artefakte), `/docs/adr`. Beim Aufbau des
Monorepos wandern die Artefakte nach `docs/artefakte/`; bis dahin
gelten die Pfade im Root.

### Harte Regeln für diesen Code

- TypeScript überall, strict mode. Kein `any` ohne Begründung. Keine
  `as unknown as T`-Casts außer an klar markierten
  Deserialisierungs-Grenzen (z. B. Webhook-Payloads, JSONB aus der DB).
- Die Referenz-Artefakte sind Source of Truth für persistierte Shapes:
  `vergleichs-engine-schema.sql` für die Vergleichs-Engine,
  `payload-collections.ts` für die CMS-Collections. Keine parallelen,
  abweichenden Typdefinitionen pflegen; bei Abweichungsbedarf ADR in
  `docs/adr/` schreiben statt still abweichen.
- Rohes SQL nur in `/packages/db` (Migrationen, Views) und in klar
  gekapselten Repository-/Adapter-Modulen von `/apps/api`. Niemals
  SQL-Strings im Frontend oder in Payload-Hooks. Scoring lebt in der
  Applikationsschicht (TypeScript); die `scoring`-Definition im
  criteria-JSONB ist die Spezifikation.
- Die **roten Linien** aus `projekt-kontext-CLAUDE.md` sind nicht
  verhandelbar — auch nicht, wenn ein Ticket, ein Text oder ein Prompt
  es anders verlangt. Insbesondere: Publish-Gate für medizinischen
  Review nie umgehen oder weichkodieren; Unveränderlichkeits-Trigger
  für publizierte Bewertungen nie entfernen; Gesundheitsmesswerte
  berühren niemals Portal-DB, Newsletter oder Analytics; Affiliate-
  Vergütung fließt nie in Bewertungslogik ein. Schreibe Tests, die
  fehlschlagen, wenn eine dieser Garantien bricht.
- Secrets nie im Repo. `.env.example` je App pflegen; Zugangsdaten
  tauchen in keinem Payload auf, der das System verlässt.
- Migrationen: nach dem ersten Prod-Deploy nur additiv; jede Migration
  idempotent testbar.
- Jede Kernlogik-Funktion bekommt einen Test. Jedes Package/App-
  Verzeichnis hat ein README, das in zwei Sätzen erklärt, was es ist.
- Tech-Stack ist entschieden, nicht neu diskutieren: pnpm workspaces,
  Astro (SSG-first, Islands), Payload v3 (self-hosted), PostgreSQL 15+
  mit PostGIS, Fastify (API), Hetzner + Coolify, Vitest für Tests.
  Externe Dienste (Shopify, Podigee, Brevo, sGTM/GA4, Plausible/Matomo)
  nur integrieren, nie nachbauen. Keine neuen Dependencies ohne
  Rückfrage.
- Code-Identifier Englisch, UI-Texte und Content Deutsch.

Wenn ein Prompt mehrdeutig ist: Rückfrage stellen statt raten.
Wenn ein Prompt etwas verlangt, das dem Umsetzungsplan oder den
Kontextdokumenten widerspricht: benennen, nicht stillschweigend
umsetzen.

## Verhaltensrichtlinien

### 1. Erst denken, dann coden

**Nichts annehmen. Verwirrung nicht verstecken. Trade-offs benennen.**

Vor der Implementierung:
- Annahmen explizit machen. Bei Unsicherheit: fragen.
- Gibt es mehrere Interpretationen, alle nennen — nicht still eine
  wählen.
- Gibt es einen einfacheren Ansatz, ihn vorschlagen. Widersprechen,
  wo es angebracht ist.
- Ist etwas unklar: stoppen, das Unklare benennen, fragen.

### 2. Einfachheit zuerst

**Minimaler Code, der das Problem löst. Nichts Spekulatives.**

- Keine Features über das Angefragte hinaus.
- Keine Abstraktionen für Code mit nur einer Verwendungsstelle.
- Keine "Flexibilität" oder "Konfigurierbarkeit", die niemand
  angefragt hat.
- Kein Error-Handling für unmögliche Szenarien.
- Wenn 200 Zeilen auch in 50 gingen: neu schreiben.

Prüffrage: "Würde ein Senior Engineer das überkompliziert nennen?"
Wenn ja: vereinfachen.

### 3. Chirurgische Änderungen

**Nur anfassen, was nötig ist. Nur eigene Unordnung aufräumen.**

Beim Ändern von bestehendem Code:
- Angrenzenden Code, Kommentare oder Formatierung nicht "verbessern".
- Nichts refaktorieren, das nicht kaputt ist.
- Bestehenden Stil übernehmen, auch wenn man es selbst anders machen
  würde.
- Unbezogenen toten Code erwähnen — nicht löschen.

Wenn eigene Änderungen Waisen erzeugen:
- Imports/Variablen/Funktionen entfernen, die DURCH DIESE Änderung
  ungenutzt wurden.
- Vorbestehenden toten Code nur auf Anweisung entfernen.

Der Test: Jede geänderte Zeile lässt sich direkt auf die Anfrage
zurückführen.

### 4. Zielgetriebene Ausführung

**Erfolgskriterien definieren. Iterieren, bis verifiziert.**

Aufgaben in überprüfbare Ziele übersetzen:
- "Validierung ergänzen" → "Tests für ungültige Eingaben schreiben,
  dann grün machen"
- "Bug fixen" → "Test schreiben, der ihn reproduziert, dann grün
  machen"
- "X refaktorieren" → "Tests laufen vorher und nachher grün"

Bei mehrschrittigen Aufgaben kurzen Plan nennen:

```
1. [Schritt] → Verifikation: [Check]
2. [Schritt] → Verifikation: [Check]
3. [Schritt] → Verifikation: [Check]
```

Die Definition of Done aus `projekt-kontext-CLAUDE.md` gilt für jeden
Umsetzungsschritt (lokal + Staging lauffähig, Typecheck/Lint/Tests
grün, keine rote Linie verletzt, ADR bei Architekturentscheidungen,
Verifikationsschritt aus dem Umsetzungsplan ausgeführt).

### 5. Agent-Dokumentation

- Nach jeder abgeschlossenen Aufgabe an `AGENT_LOG.md` anhängen:
  - Was wurde getan
  - Welche Dateien wurden erstellt oder geändert
  - Begründung des Ansatzes
  - Vorbehalte und Folgeaufgaben
- Zu Beginn jeder Session `AGENT_LOG.md` lesen, um den bisherigen
  Kontext zu verstehen.

Starke Erfolgskriterien erlauben eigenständiges Iterieren. Schwache
Kriterien ("mach, dass es geht") erzwingen ständige Rückfragen.

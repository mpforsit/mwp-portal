# ADR 0001: Draft-Preview als Staging-Build, Build-Fetch authentifiziert

Status: akzeptiert · Datum: 2026-07-10 · Kontext: Umsetzungsplan 1.3

## Kontext

Der Umsetzungsplan verlangt für die Payload→Astro-Anbindung eine
"Draft-Preview über Token für eingeloggte Redakteure". Das Frontend
ist bewusst SSG-first (Projekt-Kontext: vollständiger Content im
Initial-HTML, kein Server-Rendering); eine echte Runtime-Preview würde
einen SSR-Adapter, einen Node-Prozess fürs Frontend und
Session-Handling erfordern.

Zusätzlich: Payload depopuliert zugriffsgeschützte Relationen bei
anonymen API-Requests. Der sichtbare Meta-Block (Template Teil 1)
braucht aber den Autor-Namen aus der nicht-öffentlichen
Users-Collection.

## Entscheidung

1. **Draft-Preview = Staging-Build-Variante statt SSR.** Der
   Staging-Build kann mit `PAYLOAD_DRAFT_PREVIEW=true` auch Entwürfe
   rendern (`draft=true`-Fetch). Staging liegt hinter Zugangsschutz;
   Redakteure sehen Entwürfe dort nach jedem Rebuild (Webhook bei
   Save/Publish). Prod baut ausschließlich publizierte Artikel.
2. **Der Build-Fetch authentifiziert sich immer** (auch Prod) über den
   API-Key eines Service-Users (`PAYLOAD_API_TOKEN`, Payload
   `useAPIKey`), damit geschützte Relationen wie der Autor populiert
   werden. Die Users-Collection bleibt nicht-öffentlich.

## Konsequenzen

- Kein SSR-Adapter, keine zusätzliche Runtime — SSG-Garantien bleiben.
- Preview ist build-getaktet (Sekunden bis wenige Minuten), nicht
  echtzeitig. Für den Redaktionsworkflow (Arzt-Review im Admin-UI,
  Sichtprüfung auf Staging) reicht das; bei Bedarf später Payload
  Live-Preview im Admin-UI ergänzen.
- Der API-Key des Service-Users ist ein Secret (Coolify-Env), Rolle
  `redaktion`, kein Admin. Lokal legt der Seed einen Dev-Key an.
- Prod-Builds ohne gesetzten Token schlagen nicht fehl, rendern aber
  `—` als Autor — CI-Smoke-Test auf Staging prüft die Startseite,
  Artikel-Stichprobe ergänzen, sobald Staging steht.

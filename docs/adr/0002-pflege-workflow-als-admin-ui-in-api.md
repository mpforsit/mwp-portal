# ADR 0002: Pflege-Workflow der Vergleichs-Engine als minimales Admin-UI in /apps/api

Status: akzeptiert · Datum: 2026-07-11 · Kontext: Umsetzungsplan 2.3

## Kontext

Die Vergleichs-Engine lebt bewusst in einem eigenen Postgres-Schema
(`vergleich`), getrennt von Payload (ADR-los per Projekt-Kontext
entschieden). Payload v3 kann externe Tabellen nicht nativ als
Collections anbinden. Der Umsetzungsplan stellt zwei Wege zur Wahl:
ein Payload-Custom-View/Plugin oder ein separates minimales Admin-UI
in /apps/api — mit Aufwandsabschätzung und ADR.

## Abwägung

**Payload-Custom-View:** müsste sämtliche CRUD-Logik gegen das
vergleich-Schema selbst implementieren (Payload liefert dafür weder
Datenzugriff noch Formulare), eingebettet in Payloads React-Admin:
Custom Views, eigene React-Formulare, eigene Server-Endpoints — und
eine zusätzliche DB-Verbindung aus dem CMS-Prozess in ein Schema, das
architektonisch der API gehört. Gewinn: gewohnte Admin-Oberfläche und
Payload-Login. Kosten: dauerhafte Kopplung von CMS-Releases an
Engine-Interna, deutlich mehr Code, zwei Orte mit Engine-SQL
(verletzt die Kapselungsregel aus CLAUDE.md).

**Minimales Admin-UI in /apps/api:** die API besitzt bereits den
gekapselten Zugriff aufs vergleich-Schema und die Scoring-Logik
(Schritt 2.2). Server-gerenderte Formulare (kein React, keine neue
Dependency) reichen für die kleine Redaktionsgruppe; Zugriffsschutz
über Basic-Auth, in Prod zusätzlich nur über das interne Netz
(Tailscale) erreichbar.

## Entscheidung

Minimales, server-gerendertes Admin-UI in `/apps/api` unter
`/admin/vergleich`: Produkt anlegen, attributes pflegen,
Preview-Score anzeigen, Bewertung unpubliziert speichern,
publizieren; beim Publizieren werden ältere publizierte Bewertungen
desselben Produkts automatisch per `superseded_by` auf die neue
Bewertung abgelöst (Korrektur-Kette aus dem Artefakt). Basic-Auth
über `ADMIN_USER`/`ADMIN_PASSWORD`; ohne Konfiguration ist der
Bereich gesperrt (503), niemals offen.

## Konsequenzen

- Engine-SQL bleibt an genau einem Ort (API-Repository-Module).
- Redaktion nutzt zwei Admin-Oberflächen (Payload für Content,
  /admin/vergleich für die Engine) — akzeptiert; die Zielgruppe ist
  klein und die Trennung spiegelt die Architektur (Fakten/Urteil vs.
  redaktioneller Content).
- Kein React/Client-JS im Admin: Formulare sind Standard-HTML;
  Komfort (Autocomplete, Inline-Validierung) kann später gezielt
  ergänzt werden, wenn das Pflege-Volumen wächst.
- Prod-Deployment: Route nur intern erreichbar machen (Tailscale/
  Coolify-Netzwerk) — Basic-Auth ist die zweite, nicht die einzige
  Schranke.

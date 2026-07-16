# Deployment: Hetzner + Coolify (Staging & Prod)

Anleitung für das Aufsetzen von Staging und Prod auf einer
Hetzner-Cloud-VM mit Coolify. Ergänzt Umsetzungsplan 0.1 und 0.4.

Architektur je Umgebung:
- **Postgres** (ein Instanz-Container, PostGIS) — Schemata `cms`,
  `vergleich`, `praxen`, `engine_meta` in EINER Datenbank.
- **cms** (`apps/cms`, Payload/Next) — Dockerfile, Port 3000.
- **api** (`apps/api`, Fastify) — Dockerfile, Port 3001.
- **web** (`apps/web`, Astro SSG) — Coolify-**Static-Build** (kein
  Dockerfile), baut zur Deploy-Zeit gegen die öffentlichen cms/api-URLs.

Reihenfolge beim ersten Aufsetzen: **Postgres → cms → api →
Migrationen/Seed → web**. Grund: der web-Build zieht Inhalte aus
cms+api, die müssen also zuerst laufen und eine Domain haben.

---

## 0. Voraussetzungen & Domains

Projekt: **myWell**. Domain-Schema (überall unten als konkrete Werte
eingesetzt):

| Rolle | Staging | Prod |
| --- | --- | --- |
| Web (Frontend) | `stage.my-well.com` | `my-well.com` (+ `www`) |
| CMS (Payload) | `cms.stage.my-well.com` | `cms.my-well.com` |
| API (Fastify) | `api.stage.my-well.com` | `api.my-well.com` |

- Coolify läuft (Dashboard erreichbar), Admin-Account angelegt.
- **DNS-A-Records** auf die Server-IP: die drei Staging-Namen oben.
  (Ohne DNS kann man vorerst über die von Coolify erzeugte
  `*.sslip.io`-Adresse testen; für SSL und den web-Build gegen die
  echten cms/api-URLs sollten die Records aber stehen.)
- GitHub-Repo in Coolify als Source verbunden
  (Coolify → Sources → GitHub App installieren).

## 1. Projekt & Umgebungen

Coolify → **Projects → New**: Projekt `mwp-portal`. Darin zwei
Environments: `staging` und `production`. Alle folgenden Ressourcen
werden pro Environment einmal angelegt (mit den jeweiligen Domains/
Secrets). Am besten Staging komplett fertigstellen und verifizieren,
dann für Prod wiederholen.

## 2. PostgreSQL mit PostGIS  ⚠️ häufigste Stolperstelle

Coolify → im Environment → **New Resource → Database → PostgreSQL**.
- Beim Typ **„PostGIS (AMD only)"** wählen — NICHT das Default-
  PostgreSQL (das hat keine Extensions, und Migration 0004 braucht
  PostGIS). Coolify schlägt dann `postgis/postgis:17-3.5-alpine` vor;
  das passt (PG17 ≥ 15, PostGIS 3.5 hat alle genutzten Funktionen,
  Alpine betrifft nur den DB-Container).
- **Achtung x86:** „AMD only" = nur auf x86_64-VMs. Auf einer ARM-VM
  (Hetzner CAX) startet das Image nicht — dort `uname -m` prüfen und
  ggf. einen eigenen DB-Service mit einem arm64-PostGIS-Image nehmen.
- Datenbankname z. B. `portal`. User/Passwort notieren.
- Deploy. Danach ist die DB nur intern erreichbar (gut so).

Die Migrationen legen die Extension selbst an
(`create extension if not exists postgis`). Sollte das an fehlenden
Rechten scheitern, einmalig im DB-Container als Superuser:
`psql -U <user> -d portal -c 'CREATE EXTENSION IF NOT EXISTS postgis;'`

Interne Connection-URL aus Coolify notieren (Form:
`postgres://USER:PASS@<service-name>:5432/portal`) — die kommt gleich
als `DATABASE_URL` in cms und api.

## 3. CMS (Payload)

**New Resource → Application → based on the GitHub repo**, Branch
`main`. Build Pack: **Dockerfile**.
- **Dockerfile Location:** `apps/cms/Dockerfile`
- **Base Directory:** `/` (Build-Kontext = Repo-Root, Monorepo!)
- **Port:** 3000
- **Domain:** `https://cms.stage.my-well.com`
- **Environment-Variablen** (siehe `apps/cms/.env.example`):
  - `DATABASE_URL` = interne Postgres-URL aus Schritt 2
  - `PAYLOAD_SECRET` = `openssl rand -hex 32`
  - `REBUILD_WEBHOOK_URL` = (später, Schritt 6 — web-Deploy-Hook)
  - `INDEXNOW_KEY` = `openssl rand -hex 16` (gleicher Wert wie in web!)
  - `SITE_URL` = `https://stage.my-well.com`
  - **`DATABASE_URL` und `PAYLOAD_SECRET` zusätzlich als „Build
    Variable" markieren** (Payload braucht sie zur Build-Zeit).

> **Payload-Schema (gelöst):** Payload v3 pusht das Schema in Produktion
> nicht automatisch. Deshalb liegt eine generierte Migration in
> `apps/cms/src/migrations/` und ist über `prodMigrations` im
> Postgres-Adapter (`payload.config.ts`) verdrahtet — sie läuft beim
> Container-Start automatisch (idempotent) und legt das `cms`-Schema samt
> Tabellen an. Manuell im cms-Container ginge auch: `pnpm --filter
> @mwp/cms migrate`. Bei Schema-Änderungen neue Migration erzeugen:
> `pnpm --filter @mwp/cms migrate:create <name>` (Achtung: bei erster
> Migration je Schema die Zeile `CREATE SCHEMA IF NOT EXISTS "cms";` in
> die generierte `up()` aufnehmen — Payload legt das Schema in einer
> Raw-Migration sonst nicht selbst an).

Nach dem ersten Deploy: Admin unter `https://cms.stage.my-well.com/admin`,
ersten Nutzer anlegen, dann einen **API-Key** für einen Redaktions-/
Service-User erzeugen (Payload: User → Enable API Key). Diesen Key
braucht der web-Build als `PAYLOAD_API_TOKEN`.

## 4. API (Fastify)

**New Resource → Application → Dockerfile**, gleicher Branch/Repo.
- **Dockerfile Location:** `apps/api/Dockerfile`, **Base Directory:** `/`
- **Port:** 3001
- **Domain:** `https://api.stage.my-well.com`
- **Environment-Variablen** (siehe `apps/api/.env.example`):
  - `DATABASE_URL` = dieselbe interne Postgres-URL
  - `WEB_ORIGIN` = `https://stage.my-well.com` (CORS)
  - `INTERNAL_API_TOKEN` = `openssl rand -hex 32` (schützt /internal/)
  - `ADMIN_USER` / `ADMIN_PASSWORD` = Zugang zum Pflege-Admin
    (`/admin/vergleich`); zusätzlich in Prod netzseitig abschotten
  - `NOMINATIM_URL` = Standard ok (öffentlicher Dienst)

## 5. Migrationen & Seed (einmalig, nach cms+api-Deploy)

Beide Container tragen den vollständigen Workspace. Im **api-Container**
(Coolify → api → Terminal/Execute):
```
cd /app && pnpm --filter @mwp/db migrate
```
Optional NUR auf Staging Demodaten:
```
cd /app && pnpm --filter @mwp/db seed
```
Prüfen: `https://api.stage.my-well.com/api/vergleich` liefert JSON.

## 6. Web (Astro, statisch)

**New Resource → Application → Static Site** (kein Dockerfile).
- **Base Directory:** `/`
- **Install/Build:**
  `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @mwp/web build`
- **Output Directory:** `apps/web/dist`
- **Domain:** `https://stage.my-well.com`
- **Build-Environment** (siehe `apps/web/.env.example`) — alle zur
  Build-Zeit nötig:
  - `PAYLOAD_API_URL` = `https://cms.stage.my-well.com/api`
  - `PAYLOAD_API_TOKEN` = API-Key aus Schritt 3
  - `PAYLOAD_DRAFT_PREVIEW` = `true` für Staging, `false`/leer für Prod
  - `API_URL` = `https://api.stage.my-well.com` (Build-Time-Fetch)
  - `PUBLIC_API_URL` = `https://api.stage.my-well.com` (im Client sichtbar)
  - `SITE_URL` = `https://stage.my-well.com`
  - `INDEXNOW_KEY` = derselbe Wert wie im cms
  - `PODIGEE_BASE_URL`, `PUBLIC_SGTM_URL`, `PUBLIC_PLAUSIBLE_*`,
    `PUBLIC_SHOP_HOSTS` = sobald die Dienste stehen (Blöcke aus dem
    AGENT_LOG); leer lassen deaktiviert den jeweiligen Teil.

**Rebuild-Hook verdrahten:** Coolify zeigt für die web-App einen
Deploy-Webhook. Diese URL als `REBUILD_WEBHOOK_URL` beim cms eintragen
(Schritt 3) — dann baut das Frontend bei Publish/Update automatisch neu.

## 7. Auto-Deploy & CI

Zwei Wege, EINEN wählen:
- **(empfohlen) Coolify beobachtet `main`:** In jeder App „Automatic
  Deployment" an. Coolify richtet dafür einen GitHub-Webhook ein. Dann
  ist der `deploy-staging`-Job in `.github/workflows/ci.yml`
  überflüssig — Bescheid geben, dann entferne ich ihn.
- **CI stößt an:** je App-Deploy-Webhook aus Coolify holen. Da wir drei
  Apps haben, braucht die CI drei URLs statt der einen
  `COOLIFY_DEPLOY_WEBHOOK` — dann passe ich `ci.yml` entsprechend an.

Der `check`-Job der CI (typecheck/lint/test) läuft unabhängig davon
schon bei jedem PR.

## 8. Prod

Schritte 2–7 im `production`-Environment wiederholen, mit der
Prod-Domain, `PAYLOAD_DRAFT_PREVIEW` aus, ohne Demo-Seed, eigenen
Secrets. Cloudflare/CDN davor: **„Block AI bots" AUS** (sonst
sabotiert es die Crawler-Politik aus `robots.txt`), danach
`scripts/check-crawlers.sh https://my-well.com` grün prüfen.

---

## Hinweis zu diesen Dateien

Die Dockerfiles sind bewusst einfach gehalten (voller Workspace im
Runtime-Image, kein Prune) — verlässlich für den ersten Deploy,
Image-Größe später optimierbar. Sie konnten in der Entwicklungs-
umgebung nicht per `docker build` gegengetestet werden (Registry-
Zugriff dort gesperrt); die Validierung erfolgt beim ersten
Coolify-Build. Bei Fehlern: Log kopieren, ich ziehe nach.

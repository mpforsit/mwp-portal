# @mwp/ingest

Teilautomatisierte Ingest-Pipeline: sondiert **harte Fakten** aus
kuratierten Produktseiten und bereitet sie zur Freigabe für die
Vergleichs-Engine auf. Bewertet nichts — Scoring/Publish bleiben im
Pflege-Workflow der API. Server-gerendertes Admin-UI (Basic-Auth,
`noindex`); schreibt ins Postgres-Schema `ingest` und promotet
freigegebene Fakten nach `vergleich.products`.

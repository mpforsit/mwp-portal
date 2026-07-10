# @mwp/db

SQL-Migrationen für Vergleichs-Engine und Praxisfinder plus einfacher
Runner (`pnpm migrate`). Migrationen sind nummerierte .sql-Dateien in
`migrations/`, laufen je in einer Transaktion und werden in
`engine_meta.migrations` protokolliert; nach dem ersten Prod-Deploy nur
additiv.

Referenz-Spezifikation: `docs/artefakte/vergleichs-engine-schema.sql`.

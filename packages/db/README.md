# @mwp/db

SQL-Migrationen für Vergleichs-Engine und Praxisfinder plus einfacher
Runner (`pnpm migrate`, Protokoll in `engine_meta.migrations`, eine
Transaktion pro Datei; nach dem ersten Prod-Deploy nur additiv).
Idempotente Seeds liegen in `seeds/` (`pnpm seed`); Referenz-
Spezifikation ist `docs/artefakte/vergleichs-engine-schema.sql`.

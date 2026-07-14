-- Kurzfazit je Bewertung (ADR 0003): sichtbares Fazit auf der
-- Vergleichsseite und reviewBody im JSON-LD (Template 2.3).
-- Bewusst nicht trigger-geschützt (redaktionelle Zusammenfassung,
-- nicht das Urteil selbst) — siehe ADR.
alter table vergleich.product_evaluations
  add column if not exists summary text;

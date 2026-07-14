# ADR 0003: Kurzfazit-Spalte auf product_evaluations

Status: akzeptiert · Datum: 2026-07-11 · Kontext: Umsetzungsplan 2.4

## Kontext

Das Redaktions-Template 2.3 verlangt im Review-JSON-LD ein
`reviewBody` ("Kurzfazit aus der Bewertung, 1–2 Sätze"), und die
Vergleichsseite zeigt pro Produkt ein sichtbares Kurzfazit. Das
Referenz-Schema (docs/artefakte/vergleichs-engine-schema.sql) hat
dafür keine Spalte.

## Entscheidung

Additive Migration: `product_evaluations.summary text` (nullable).
Das Kurzfazit wird im Pflege-Workflow miterfasst.

Bewusst NICHT in den Unveränderlichkeits-Trigger aufgenommen:
Geschützt bleibt das Urteil selbst (scores, total_score, schema_id,
evidence, evaluated_by/at). Das Kurzfazit ist dessen redaktionelle
Zusammenfassung — Formulierungs-/Tippfehlerkorrekturen müssen ohne
Neubewertung möglich sein. Inhaltliche Neubewertung läuft weiterhin
ausschließlich über neue Zeile + superseded_by.

## Konsequenzen

- Referenz-Artefakt sollte um die Spalte ergänzt werden (Rückmeldung
  an Maintainer, wie schon der Hook-Fix aus 1.1).
- JSON-LD lässt reviewBody weg, wenn kein Kurzfazit gepflegt ist.

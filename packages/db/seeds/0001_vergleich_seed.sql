-- Seed aus docs/artefakte/vergleichs-engine-schema.sql (Schritt 2.1):
-- Kategorie Vitamin D mit Methodik v1 und einem Beispielprodukt.
-- Idempotent: feste UUIDs + on conflict / where not exists.
set local search_path to vergleich, public;

insert into categories (id, slug, name, description) values
('11111111-1111-1111-1111-111111111111', 'vitamin-d',
 'Vitamin-D-Präparate',
 'Cholecalciferol-Präparate zur Supplementierung nach gemessenem 25(OH)D-Spiegel')
on conflict (id) do nothing;

insert into criteria_schemas
  (id, category_id, version, status, created_by, activated_at, methodology_md, criteria)
values
('22222222-2222-2222-2222-222222222222',
 '11111111-1111-1111-1111-111111111111',
 1, 'active', 'redaktion@portal', now(),
 $md$## So bewerten wir Vitamin-D-Präparate (Methodik v1)
Wir bewerten sechs Kriterien mit festen Gewichten (Summe 100).
Datengrundlage: Herstellerangaben, öffentlich einsehbare Analysenzertifikate,
Preisstichproben (dokumentiert mit Zeitstempel). Affiliate-Vergütungen fließen
nicht in die Bewertung ein; die Korrelation zwischen Ranking und Vergütung
veröffentlichen wir laufend.$md$,
 '[
   {
     "key": "micro_dosing",
     "label": "Mikrodosierbarkeit",
     "type": "numeric",
     "unit": "IE pro Einzeldosis",
     "direction": "lower_better",
     "weight": 20,
     "scoring": { "bands": [
       { "max": 500,  "points": 10 },
       { "max": 1000, "points": 7 },
       { "max": 5000, "points": 4 },
       { "points": 1 }
     ]}
   },
   {
     "key": "form",
     "label": "Darreichungsform",
     "type": "enum",
     "weight": 10,
     "scoring": { "map": { "tropfen": 10, "spray": 8, "kapsel": 6, "tablette": 4 } }
   },
   {
     "key": "k2_combo",
     "label": "K2-Kombination (Form)",
     "type": "enum",
     "weight": 15,
     "scoring": { "map": { "mk7_all_trans": 10, "mk7_cis_trans": 5, "mk4": 3, "none": 0 } }
   },
   {
     "key": "carrier",
     "label": "Trägeröl / Galenik",
     "type": "enum",
     "weight": 10,
     "scoring": { "map": { "mct": 10, "olivenoel": 8, "sonnenblumenoel": 5, "keins": 3 } }
   },
   {
     "key": "price_per_1000ie",
     "label": "Preis pro 1.000 IE",
     "type": "numeric",
     "unit": "EUR",
     "direction": "lower_better",
     "weight": 25,
     "scoring": { "bands": [
       { "max": 0.30, "points": 10 },
       { "max": 0.60, "points": 7 },
       { "max": 1.00, "points": 4 },
       { "points": 1 }
     ]}
   },
   {
     "key": "third_party_cert",
     "label": "Analysenzertifikat je Charge",
     "type": "enum",
     "weight": 20,
     "scoring": { "map": { "public_per_batch": 10, "on_request": 6, "none": 0 } }
   }
 ]'::jsonb)
on conflict (id) do nothing;

insert into products (id, category_id, slug, name, manufacturer, attributes) values
('33333333-3333-3333-3333-333333333333',
 '11111111-1111-1111-1111-111111111111',
 'beispiel-d3-k2-tropfen',
 'Beispiel D3+K2 Tropfen 1000 IE',
 'Beispiel GmbH',
 '{
   "ie_pro_einzeldosis": 1000,
   "form": "tropfen",
   "k2": "mk7_all_trans",
   "traegeroel": "mct",
   "zertifikat": "public_per_batch",
   "gebinde_ie_gesamt": 50000
 }')
on conflict (id) do nothing;

-- total_score = Summe(points/10 * weight) = 7*2 + 10*1 + 10*1.5 + 10*1 + 7*2.5 + 10*2 = 86.5
insert into product_evaluations
  (product_id, schema_id, scores, total_score, evaluated_by, published, evidence)
select
 '33333333-3333-3333-3333-333333333333',
 '22222222-2222-2222-2222-222222222222',
 '{
   "micro_dosing":     { "raw": 1000,  "points": 7,  "note": "1 Tropfen = 1000 IE, keine feinere Titration" },
   "form":             { "raw": "tropfen", "points": 10 },
   "k2_combo":         { "raw": "mk7_all_trans", "points": 10, "note": "lt. Analysenzertifikat 04/2026" },
   "carrier":          { "raw": "mct", "points": 10 },
   "price_per_1000ie": { "raw": 0.42,  "points": 7,  "note": "Preisstichprobe 07/2026, 3 Quellen" },
   "third_party_cert": { "raw": "public_per_batch", "points": 10 }
 }'::jsonb,
 86.50,
 'redaktion@portal',
 true,
 '[{"criterion":"k2_combo","source":"https://hersteller.example/zertifikate/charge-0426.pdf"}]'::jsonb
where not exists (
  select 1 from product_evaluations
  where product_id = '33333333-3333-3333-3333-333333333333'
);

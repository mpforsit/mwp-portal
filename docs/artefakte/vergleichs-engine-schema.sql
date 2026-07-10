-- =====================================================================
-- Vergleichs-Engine – Kernschema (PostgreSQL 15+)
-- Designprinzipien:
--   1. Fakten (products.attributes) getrennt von Urteil (product_evaluations)
--   2. Methodik versioniert; Bewertungen referenzieren immer eine Schema-Version
--   3. Publizierte Bewertungen sind unveränderlich (Trigger-geschützt)
--   4. Affiliate-Daten vollständig entkoppelt vom Ranking
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Kategorien (Vitamin D, Eisbad-Tonnen, Omega-3, ...)
-- ---------------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Versionierte Bewertungs-Methodik pro Kategorie
-- criteria: JSONB-Array, siehe Seed unten für die Struktur
-- methodology_md: öffentlicher Methodik-Text; die "So testen wir"-Seite
--   rendert direkt aus dieser Spalte -> Doku und Realität können nicht
--   auseinanderlaufen
-- ---------------------------------------------------------------------
create table criteria_schemas (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references categories(id),
  version        int  not null,
  status         text not null default 'draft'
                 check (status in ('draft','active','retired')),
  criteria       jsonb not null,
  methodology_md text  not null,
  created_by     text  not null,
  activated_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (category_id, version)
);

-- Genau EIN aktives Schema pro Kategorie
create unique index one_active_schema_per_category
  on criteria_schemas (category_id)
  where status = 'active';

-- Gewichte müssen sich auf 100 summieren
create or replace function check_criteria_weights() returns trigger as $$
declare
  weight_sum numeric;
begin
  select coalesce(sum((c->>'weight')::numeric), 0)
    into weight_sum
    from jsonb_array_elements(new.criteria) as c;
  if weight_sum <> 100 then
    raise exception 'Kriteriengewichte summieren auf % statt 100', weight_sum;
  end if;
  return new;
end $$ language plpgsql;

create trigger trg_check_weights
  before insert or update on criteria_schemas
  for each row execute function check_criteria_weights();

-- ---------------------------------------------------------------------
-- Produkte: Rohfakten, bewertungs-unabhängig
-- attributes-Beispiel (Vitamin D):
--   { "ie_pro_einzeldosis": 1000, "form": "tropfen",
--     "k2": "mk7_all_trans", "traegeroel": "mct",
--     "zertifikat": "public_per_batch", "gebinde_ie_gesamt": 50000 }
-- ---------------------------------------------------------------------
create table products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references categories(id),
  slug         text unique not null,
  name         text not null,
  manufacturer text not null,
  gtin         text,
  attributes   jsonb not null default '{}',
  status       text not null default 'listed'
               check (status in ('listed','delisted')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Bewertungen: unveränderlich nach Publikation
-- scores-Beispiel:
--   { "micro_dosing":    { "raw": 1000, "points": 7,  "note": "1 Tropfen = 1000 IE" },
--     "price_per_1000ie":{ "raw": 0.42, "points": 8,  "note": "Stand 07/2026" } }
-- Korrektur/Neubewertung = neue Zeile + superseded_by auf der alten
-- ---------------------------------------------------------------------
create table product_evaluations (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id),
  schema_id     uuid not null references criteria_schemas(id),
  scores        jsonb not null,
  total_score   numeric(5,2) not null,
  evidence      jsonb not null default '[]',
  evaluated_by  text not null,
  evaluated_at  timestamptz not null default now(),
  published     boolean not null default false,
  superseded_by uuid references product_evaluations(id)
);

create or replace function protect_published_evaluations() returns trigger as $$
begin
  if old.published and (
       new.scores      is distinct from old.scores
    or new.total_score is distinct from old.total_score
    or new.schema_id   is distinct from old.schema_id
    or new.evidence    is distinct from old.evidence
    or new.evaluated_by is distinct from old.evaluated_by
    or new.evaluated_at is distinct from old.evaluated_at
  ) then
    raise exception 'Publizierte Bewertung % ist unveraenderlich. Neue Bewertung anlegen und superseded_by setzen.', old.id;
  end if;
  return new;
end $$ language plpgsql;

create trigger trg_protect_evaluations
  before update on product_evaluations
  for each row execute function protect_published_evaluations();

-- ---------------------------------------------------------------------
-- Affiliate: vollständig entkoppelt vom Ranking
-- ---------------------------------------------------------------------
create table affiliate_partners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  network    text,                      -- z. B. Awin, direkt, Amazon PartnerNet
  notes      text,
  created_at timestamptz not null default now()
);

create table affiliate_links (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references products(id),
  partner_id       uuid not null references affiliate_partners(id),
  url              text not null,
  commission_model text not null check (commission_model in ('percent','fixed')),
  commission_value numeric(8,2) not null,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Preis-Historie, z. B. für "Preis pro 1.000 IE" mit Zeitstempel-Beleg
create table price_snapshots (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id),
  partner_id  uuid references affiliate_partners(id),
  price_cents int not null,
  currency    text not null default 'EUR',
  unit_amount numeric,                  -- z. B. 50000 (IE im Gebinde)
  unit        text,                     -- z. B. 'IE'
  captured_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Aktuelles Ranking: neueste publizierte, nicht-abgelöste Bewertung
-- pro Produkt unter dem AKTIVEN Schema der Kategorie
-- ---------------------------------------------------------------------
create view current_ranking as
select
  p.category_id,
  p.id  as product_id,
  p.name,
  p.manufacturer,
  e.id  as evaluation_id,
  e.total_score,
  rank() over (partition by p.category_id order by e.total_score desc) as rank
from products p
join lateral (
  select ev.*
  from product_evaluations ev
  join criteria_schemas s on s.id = ev.schema_id and s.status = 'active'
  where ev.product_id = p.id
    and ev.published
    and ev.superseded_by is null
  order by ev.evaluated_at desc
  limit 1
) e on true
where p.status = 'listed';

-- ---------------------------------------------------------------------
-- Transparenz-View: Korrelation Rang vs. maximale Provision je Kategorie.
-- Wert nahe 0 oder negativ = Beleg fuer die Methodik-Seite
-- ("Unser Ranking korreliert nicht mit unserer Verguetung").
-- ---------------------------------------------------------------------
create view transparency_rank_vs_commission as
select
  c.slug as category,
  count(*) as products_ranked,
  corr(r.rank::float, coalesce(al.max_commission, 0)::float)
    as rank_commission_correlation
from current_ranking r
join categories c on c.id = r.category_id
left join (
  select product_id, max(commission_value) as max_commission
  from affiliate_links
  where active
  group by product_id
) al on al.product_id = r.product_id
group by c.slug;

-- =====================================================================
-- SEED: Kategorie Vitamin D mit Methodik v1 und einem Beispielprodukt
-- =====================================================================
insert into categories (id, slug, name, description) values
('11111111-1111-1111-1111-111111111111', 'vitamin-d',
 'Vitamin-D-Präparate',
 'Cholecalciferol-Präparate zur Supplementierung nach gemessenem 25(OH)D-Spiegel');

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
 ]'::jsonb);

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
 }');

-- total_score = Summe(points/10 * weight) = 7*2 + 10*1 + 10*1.5 + 10*1 + 7*2.5 + 10*2 = 86.5
insert into product_evaluations
  (product_id, schema_id, scores, total_score, evaluated_by, published, evidence)
values
('33333333-3333-3333-3333-333333333333',
 '22222222-2222-2222-2222-222222222222',
 '{
   "micro_dosing":     { "raw": 1000,  "points": 7,  "note": "1 Tropfen = 1000 IE, keine feinere Titration" },
   "form":             { "raw": "tropfen", "points": 10 },
   "k2_combo":         { "raw": "mk7_all_trans", "points": 10, "note": "lt. Analysenzertifikat 04/2026" },
   "carrier":          { "raw": "mct", "points": 10 },
   "price_per_1000ie": { "raw": 0.42,  "points": 7,  "note": "Preisstichprobe 07/2026, 3 Quellen" },
   "third_party_cert": { "raw": "public_per_batch", "points": 10 }
 }',
 86.50,
 'redaktion@portal',
 true,
 '[{"criterion":"k2_combo","source":"https://hersteller.example/zertifikate/charge-0426.pdf"}]');

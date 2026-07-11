-- Vergleichs-Engine — Kernschema (Schritt 2.1).
-- Quelle: docs/artefakte/vergleichs-engine-schema.sql (Source of Truth).
-- Abweichungen: eigenes Postgres-Schema "vergleich" (Projekt-Kontext:
-- Engine getrennt von Payload); kein pgcrypto — gen_random_uuid() ist
-- ab PostgreSQL 13 eingebaut (Extension bräuchte Superuser-Rechte).

create schema if not exists vergleich;
set local search_path to vergleich, public;

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
-- Transparenz-View: Korrelation Rang vs. maximale Provision je Kategorie
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

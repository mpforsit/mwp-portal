-- Ingest-Staging (Fakten-Sondierung aus kuratierten Produktseiten).
-- Eigenes Schema "ingest", getrennt von "vergleich". Grundsatz:
-- dieses Schema hält NUR Rohabrufe und normalisierte FAKTEN sowie den
-- Freigabe-Fluss. Es bewertet nichts: keine Referenz auf und kein
-- Schreibzugriff nach vergleich.product_evaluations. Die Promote-Ziele
-- sind ausschließlich vergleich.products / vergleich.categories.
create schema if not exists ingest;
set local search_path to ingest, public;

-- Von dir kuratierte Produktseiten-URLs, kategoriegebunden. Später
-- ergänzbar (Markt ändert sich); active=false blendet eine Quelle aus,
-- ohne ihre Snapshots zu verlieren.
create table sources (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references vergleich.categories(id),
  url         text not null unique,
  label       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index sources_category_idx on sources (category_id);

-- Unveränderliche Rohabrufe einer Quelle (Beleg + Reproduzierbarkeit).
-- Kein UPDATE vorgesehen; ein erneuter Abruf ist eine neue Zeile.
create table snapshots (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid not null references sources(id) on delete cascade,
  fetched_at   timestamptz not null default now(),
  http_status  int,
  ok           boolean not null default false,
  error        text,
  content_hash text,
  raw_html     text,
  jsonld       jsonb not null default '[]'
);
create index snapshots_source_idx on snapshots (source_id, fetched_at desc);

-- Beobachtete Attribute je Kategorie (Vorschlag aus der Sondierung,
-- Tor 1). Wird je Sondierungslauf neu berechnet (upsert pro key).
create table attribute_suggestions (
  category_id uuid not null references vergleich.categories(id),
  attr_key    text not null,
  occurrences int  not null default 0,
  examples    jsonb not null default '[]',
  updated_at  timestamptz not null default now(),
  primary key (category_id, attr_key)
);

-- Von dir bestätigte Attribut-Keys je Kategorie (Ergebnis Tor 1).
-- Steuert, welche Felder die LLM-Extraktion füllt.
create table selected_attributes (
  category_id uuid not null references vergleich.categories(id),
  attr_key    text not null,
  label       text,
  position    int  not null default 0,
  primary key (category_id, attr_key)
);

-- Normalisierte Fakten je Quelle (Ergebnis der LLM-Extraktion). Genau
-- eine aktuelle Extraktion pro Quelle (unique). status steuert den
-- Freigabe-/Promote-Fluss (Tor 2). confidence/provenance je Feld für
-- die Abnahme; promoted_product_id verweist auf das erzeugte Produkt.
create table extractions (
  id                  uuid primary key default gen_random_uuid(),
  source_id           uuid not null unique references sources(id) on delete cascade,
  category_id         uuid not null references vergleich.categories(id),
  name                text,
  manufacturer        text,
  gtin                text,
  attributes          jsonb not null default '{}',
  confidence          jsonb not null default '{}',
  provenance          jsonb not null default '{}',
  status              text  not null default 'draft'
                      check (status in ('draft','approved','promoted','rejected')),
  promoted_product_id uuid references vergleich.products(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index extractions_status_idx on extractions (status);

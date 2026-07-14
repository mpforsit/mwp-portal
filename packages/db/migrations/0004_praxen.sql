-- Praxisfinder (Schritt 2.8): Schema "praxen" mit PostGIS.
-- Rote Linie: offene Suche nach objektiven Kriterien — das
-- partner-Flag dient NUR der Kennzeichnung, nie der Sortierung.
-- Hinweis: die postgis-Extension muss einmalig durch einen Superuser
-- angelegt sein (postgis/postgis-Image bringt sie mit).
create extension if not exists postgis;

create schema if not exists praxen;
set local search_path to praxen, public;

create table practices (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  street        text,
  zip           text not null,
  city          text not null,
  location      geography(point, 4326) not null,
  services      text[] not null default '{}',   -- Leistungs-Tags
  partner       boolean not null default false, -- Kennzeichnung, keine Bevorzugung
  website       text,
  phone         text,
  opening_hours text,
  created_at    timestamptz not null default now()
);

create index practices_location_idx on practices using gist (location);
create index practices_services_idx on practices using gin (services);

-- PLZ-Geocoding-Cache (Nominatim-Antworten, damit die Suche nicht
-- bei jedem Request extern anfragt)
create table geocode_cache (
  zip         text primary key,
  lat         double precision not null,
  lon         double precision not null,
  resolved_at timestamptz not null default now()
);

-- Klick-Events für Affiliate-Redirects (Schritt 2.5).
-- Bewusst OHNE Nutzerdaten: nur Link, Zeitstempel und Referrer-PFAD
-- (keine IP, kein User-Agent, keine Query-Parameter).
set local search_path to vergleich, public;

create table affiliate_clicks (
  id            uuid primary key default gen_random_uuid(),
  link_id       uuid not null references affiliate_links(id),
  clicked_at    timestamptz not null default now(),
  referrer_path text
);

create index affiliate_clicks_link_idx on affiliate_clicks (link_id, clicked_at);

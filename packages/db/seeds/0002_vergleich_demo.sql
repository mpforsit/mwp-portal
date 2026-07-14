-- Demo-Daten für das Vergleichsseiten-Frontend (Schritt 2.4):
-- Kurzfazit auf der Seed-Bewertung, ein Affiliate-Partner/-Link und
-- eine Preisstichprobe. Idempotent.
set local search_path to vergleich, public;

update product_evaluations
set summary =
  'Solide Tropfen mit all-trans-MK7 und öffentlichem Chargenzertifikat; ' ||
  'mit 1.000 IE pro Tropfen nicht fein titrierbar.'
where product_id = '33333333-3333-3333-3333-333333333333'
  and summary is null;

insert into affiliate_partners (id, name, network) values
('44444444-4444-4444-4444-444444444444', 'Beispiel-Shop', 'direkt')
on conflict (id) do nothing;

insert into affiliate_links
  (id, product_id, partner_id, url, commission_model, commission_value)
values
('55555555-5555-5555-5555-555555555555',
 '33333333-3333-3333-3333-333333333333',
 '44444444-4444-4444-4444-444444444444',
 'https://shop.example/beispiel-d3-k2', 'percent', 8.00)
on conflict (id) do nothing;

insert into price_snapshots
  (product_id, partner_id, price_cents, unit_amount, unit)
select
 '33333333-3333-3333-3333-333333333333',
 '44444444-4444-4444-4444-444444444444',
 2100, 50000, 'IE'
where not exists (
  select 1 from price_snapshots
  where product_id = '33333333-3333-3333-3333-333333333333'
);

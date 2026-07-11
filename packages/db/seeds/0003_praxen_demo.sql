-- Demo-Praxen für die lokale Entwicklung (Schritt 2.8). Idempotent.
-- Bewusst so gewählt, dass die nächste Praxis KEINE Partnerpraxis ist
-- (Sortierung muss rein distanzbasiert bleiben).
set local search_path to praxen, public;

insert into geocode_cache (zip, lat, lon) values
('80331', 48.1371, 11.5754)
on conflict (zip) do nothing;

insert into practices (id, name, street, zip, city, location, services, partner, website, opening_hours) values
('66666666-6666-6666-6666-666666666661',
 'Hausarztpraxis Altstadt', 'Marienplatz 1', '80331', 'München',
 st_setsrid(st_makepoint(11.5760, 48.1372), 4326)::geography,
 array['vitamin-d-diagnostik','blutbild'], false,
 'https://praxis-altstadt.example', 'Mo–Fr 8–13 Uhr'),
('66666666-6666-6666-6666-666666666662',
 'Partnerpraxis Isartor', 'Isartorplatz 4', '80331', 'München',
 st_setsrid(st_makepoint(11.5830, 48.1350), 4326)::geography,
 array['vitamin-d-diagnostik','omega-3-index','blutbild'], true,
 'https://praxis-isartor.example', 'Mo–Do 8–17 Uhr, Fr 8–12 Uhr'),
('66666666-6666-6666-6666-666666666663',
 'Labormedizin Augsburg', 'Bahnhofstraße 10', '86150', 'Augsburg',
 st_setsrid(st_makepoint(10.8858, 48.3654), 4326)::geography,
 array['vitamin-d-diagnostik','omega-3-index'], false,
 'https://labor-augsburg.example', 'Mo–Fr 7–15 Uhr')
on conflict (id) do nothing;

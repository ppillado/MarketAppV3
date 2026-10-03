-- Demo data: the same 8 offers the app used as mock data (Gran Concepción).
-- Note: extensions.st_makepoint takes (longitude, latitude).

insert into public.offers (product, price, store_name, location, confirmations, reports, created_at)
values
  ('Pan amasado 1 kg',       1990, 'Almacén Don Pedro',         extensions.st_setsrid(extensions.st_makepoint(-73.0441, -36.8235), 4326)::extensions.geography, 12, 0, now() - interval '10 minutes'),
  ('Leche entera 1 L',       1090, 'Minimarket La Esquina',     extensions.st_setsrid(extensions.st_makepoint(-73.0598, -36.8312), 4326)::extensions.geography,  5, 1, now() - interval '25 minutes'),
  ('Huevos blancos 12 un.',  3490, 'Unimarc Paicaví',           extensions.st_setsrid(extensions.st_makepoint(-73.0469, -36.8148), 4326)::extensions.geography,  8, 0, now() - interval '48 minutes'),
  ('Aceite maravilla 1 L',   2790, 'Almacén Doña Rosa',         extensions.st_setsrid(extensions.st_makepoint(-73.0632, -36.8576), 4326)::extensions.geography,  3, 2, now() - interval '95 minutes'),
  ('Arroz grado 2, 1 kg',    1490, 'Líder San Pedro de la Paz', extensions.st_setsrid(extensions.st_makepoint(-73.0911, -36.8394), 4326)::extensions.geography, 15, 1, now() - interval '180 minutes'),
  ('Tomates 1 kg',           1590, 'Feria Chiguayante',         extensions.st_setsrid(extensions.st_makepoint(-73.0283, -36.9201), 4326)::extensions.geography,  2, 0, now() - interval '320 minutes'),
  ('Azúcar 1 kg',            1290, 'Santa Isabel Hualpén',      extensions.st_setsrid(extensions.st_makepoint(-73.0905, -36.7942), 4326)::extensions.geography,  1, 4, now() - interval '600 minutes'),
  ('Fideos spaghetti 400 g',  890, 'Almacén El Puerto',         extensions.st_setsrid(extensions.st_makepoint(-73.1166, -36.7244), 4326)::extensions.geography,  0, 0, now() - interval '1500 minutes');

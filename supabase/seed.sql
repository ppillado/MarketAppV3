-- Datos de demostración: las mismas 8 ofertas que la app usaba como datos de prueba (Gran Concepción), un local cada una.
-- Nota: extensions.st_makepoint recibe (longitud, latitud).

with demo (product, price, store_name, lng, lat, confirmations, reports, age, category) as (
  values
    ('Pan amasado 1 kg',       1990, 'Almacén Don Pedro',         -73.0441, -36.8235, 12, 0, interval '10 minutes',   'panaderia'),
    ('Leche entera 1 L',       1090, 'Minimarket La Esquina',     -73.0598, -36.8312,  5, 1, interval '25 minutes',   'lacteos'),
    ('Huevos blancos 12 un.',  3490, 'Unimarc Paicaví',           -73.0469, -36.8148,  8, 0, interval '48 minutes',   'abarrotes'),
    ('Aceite maravilla 1 L',   2790, 'Almacén Doña Rosa',         -73.0632, -36.8576,  3, 2, interval '95 minutes',   'abarrotes'),
    ('Arroz grado 2, 1 kg',    1490, 'Líder San Pedro de la Paz', -73.0911, -36.8394, 15, 1, interval '180 minutes',  'abarrotes'),
    ('Tomates 1 kg',           1590, 'Feria Chiguayante',         -73.0283, -36.9201,  2, 0, interval '320 minutes',  'frutas_verduras'),
    ('Azúcar 1 kg',            1290, 'Santa Isabel Hualpén',      -73.0905, -36.7942,  1, 4, interval '600 minutes',  'abarrotes'),
    ('Fideos spaghetti 400 g',  890, 'Almacén El Puerto',         -73.1166, -36.7244,  0, 0, interval '1500 minutes', 'abarrotes')
),
new_stores as (
  insert into public.stores (name, location)
  select d.store_name,
         extensions.st_setsrid(extensions.st_makepoint(d.lng, d.lat), 4326)::extensions.geography
  from demo d
  returning id, name, location
)
insert into public.offers (product, price, store_name, location, store_id, confirmations, reports, created_at, category)
select d.product, d.price, s.name, s.location, s.id, d.confirmations, d.reports, now() - d.age, d.category
from demo d
join new_stores s on s.name = d.store_name;

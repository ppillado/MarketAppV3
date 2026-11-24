-- MarketApp: moderación anti-troll.
-- * Ocultamiento automático por la comunidad: una oferta con suficientes reportes de
--   "Agotado/Error" deja de aparecer en todas las funciones de lectura, y vuelve a aparecer si los
--   votos cambian y la regla ya no se cumple.
-- * Se sigue bloqueando que un usuario vote su propia oferta (ahora con hint 'cannot_vote_own_offer').
-- * submit_offer agrega validaciones más estrictas de precio y nombre de producto, detección de
--   duplicados y un límite de publicaciones por tiempo. Sus 9 parámetros (incluido p_category)
--   no cambian.
-- No rompe la app: cada función de lectura mantiene sus parámetros y las columnas que devuelve.
--
-- Resumen del archivo:
--   1. Columnas nuevas en offers (hidden_at, hidden_reason).
--   2. Regla de ocultamiento (offer_should_hide).
--   3. Votar (set_offer_vote) y recalcular si la oferta se oculta.
--   4. Funciones de lectura que ya no muestran ofertas ocultas (nearby_offers, nearby_stores...).
--   5. Publicar (submit_offer) con validaciones anti-troll.
--   6. Recargar el esquema de la API.

-- 1. Columnas, restricciones e índice ----------------------------------------------------------
-- hidden_at = cuándo se ocultó la oferta (null = visible); hidden_reason = por qué se ocultó.
-- La restricción de consistencia obliga a que ambas estén llenas o ambas vacías.

alter table public.offers
  add column hidden_at timestamptz,
  add column hidden_reason text
    constraint offers_hidden_reason_check
    check (hidden_reason is null or hidden_reason in ('community_reports')),
  add constraint offers_hidden_consistency_check
    check ((hidden_at is null) = (hidden_reason is null));

comment on column public.offers.hidden_at is
  'When the offer was hidden from feeds and the map (null = visible).';
comment on column public.offers.hidden_reason is
  'Why the offer is hidden: community_reports (auto, see offer_should_hide).';

-- Índice para buscar rápido las ofertas visibles de un local en un rango de fechas
-- (lo usan nearby_stores y get_store_offers). Solo incluye ofertas no ocultas.
create index offers_visible_store_created_at_idx
  on public.offers (store_id, created_at desc)
  where hidden_at is null;

-- 2. Regla de ocultamiento ---------------------------------------------------------------------

-- Única fuente de verdad del ocultamiento automático: se oculta si tiene al menos 3 reportes
-- Y los reportes superan a las confirmaciones por 2 o más. Así, una oferta bien confirmada
-- resiste a unos pocos trolls. (La app replica esta regla en src/features/offers/offerTrust.ts
-- para ocultar la oferta al instante, sin esperar al servidor.)
-- Ejemplos: 3 reportes y 0 confirmaciones → se oculta; 3 reportes y 2 confirmaciones → sigue visible.
create or replace function public.offer_should_hide(p_confirmations integer, p_reports integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_reports, 0) >= 3
     and coalesce(p_reports, 0) - coalesce(p_confirmations, 0) >= 2;
$$;

-- Función interna: la app no puede llamarla directamente; solo la usan otras funciones
-- SECURITY DEFINER (que se ejecutan con permisos del dueño de la base de datos).
revoke execute on function public.offer_should_hide(integer, integer) from public, anon, authenticated;

-- Relleno inicial: oculta las ofertas que ya existían y que ya cumplen la regla.
update public.offers o
set hidden_at = now(), hidden_reason = 'community_reports'
where o.hidden_at is null
  and public.offer_should_hide(o.confirmations, o.reports);

-- 3. Votos: recalcular visibilidad y bloquear el voto propio -------------------------------------
-- Mismos parámetros y tipo de retorno, así `create or replace` conserva los permisos existentes
-- (igual se vuelven a aplicar más abajo).

-- Registra ('confirm' = confirmar | 'report' = reportar) o borra (null) el voto del usuario en
-- una oferta, y devuelve los contadores actualizados. Los contadores cambian sumando o restando
-- la diferencia, así se respetan los valores de ejemplo cargados al inicio.
-- Después de actualizar los contadores, se recalcula hidden_at / hidden_reason con la misma fila
-- bloqueada. Se aceptan votos en ofertas ocultas, así retirar un reporte puede hacerla reaparecer.
-- Pasos: validar usuario y voto → bloquear la oferta → impedir voto propio → guardar el voto
--        → actualizar contadores → recalcular si se oculta → devolver contadores.
create or replace function public.set_offer_vote(p_offer_id uuid, p_vote text)
returns table (confirmations integer, reports integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  offer_owner uuid;
  previous text;
begin
  if uid is null then
    raise exception 'Debes iniciar sesión para votar.' using hint = 'not_authenticated';
  end if;

  if p_vote is not null and p_vote not in ('confirm', 'report') then
    raise exception 'Voto no válido.' using hint = 'invalid_input';
  end if;

  -- Bloquea la fila de la oferta para que votos simultáneos se apliquen uno después del otro
  -- (evita que dos votos al mismo tiempo dejen mal los contadores).
  select o.created_by into offer_owner
  from public.offers o
  where o.id = p_offer_id
  for update;

  if not found then
    raise exception 'Esta oferta ya no existe.' using hint = 'not_found';
  end if;

  -- El autor no puede confirmar ni reportar su propia oferta.
  if offer_owner = uid then
    raise exception 'No puedes votar tu propia oferta.' using hint = 'cannot_vote_own_offer';
  end if;

  -- Voto anterior del usuario (si tenía), para descontarlo de los contadores.
  select v.vote into previous
  from public.offer_votes v
  where v.offer_id = p_offer_id and v.user_id = uid;

  -- Guardar el voto: si es null se borra; si no, se crea o se reemplaza (un voto por usuario).
  if p_vote is null then
    delete from public.offer_votes v where v.offer_id = p_offer_id and v.user_id = uid;
  else
    insert into public.offer_votes (offer_id, user_id, vote)
    values (p_offer_id, uid, p_vote)
    on conflict (offer_id, user_id) do update
      set vote = excluded.vote, updated_at = now();
  end if;

  -- Actualizar contadores: se resta el voto anterior y se suma el nuevo (nunca bajan de 0).
  update public.offers o
  set
    confirmations = greatest(0, o.confirmations
      - (case when previous = 'confirm' then 1 else 0 end)
      + (case when p_vote = 'confirm' then 1 else 0 end)),
    reports = greatest(0, o.reports
      - (case when previous = 'report' then 1 else 0 end)
      + (case when p_vote = 'report' then 1 else 0 end))
  where o.id = p_offer_id;

  -- Recalcular la visibilidad con los contadores nuevos. Mientras siga oculta, conserva la fecha
  -- original de hidden_at, y solo vuelve a mostrar ofertas ocultadas por reportes de la comunidad
  -- (nunca una ocultada a mano en el futuro por un moderador).
  update public.offers o
  set
    hidden_at = case
      when public.offer_should_hide(o.confirmations, o.reports) then coalesce(o.hidden_at, now())
      when o.hidden_reason = 'community_reports' then null
      else o.hidden_at
    end,
    hidden_reason = case
      when public.offer_should_hide(o.confirmations, o.reports) then 'community_reports'
      when o.hidden_reason = 'community_reports' then null
      else o.hidden_reason
    end
  where o.id = p_offer_id;

  -- Devuelve los contadores actualizados para que la app los muestre al instante.
  return query
  select o.confirmations, o.reports from public.offers o where o.id = p_offer_id;
end;
$$;

-- Permisos: solo usuarios con sesión (incluidos los anónimos) pueden votar.
revoke execute on function public.set_offer_vote(uuid, text) from public, anon;
grant execute on function public.set_offer_vote(uuid, text) to authenticated;

-- 4. Las funciones de lectura excluyen las ofertas ocultas ---------------------------------------
-- Mismos parámetros y columnas que en 20261006000000_offer_categories.sql, más el filtro
-- `o.hidden_at is null`. Así, los conteos y categorías de cada local siempre coinciden con las
-- ofertas que se muestran.

-- Ofertas a menos de `radius_m` metros de (lat, lng), más nuevas primero, sin las antiguas
-- (más de 7 días) ni las ocultas. Alimenta la pestaña "Ofertas".
-- st_dwithin (PostGIS) calcula si un punto está dentro de un radio en metros sobre el mapa.
create or replace function public.nearby_offers(
  lat double precision,
  lng double precision,
  radius_m double precision default 30000,
  max_age_days integer default 7,
  max_results integer default 500
)
returns table (
  id uuid,
  product text,
  price integer,
  store_name text,
  latitude double precision,
  longitude double precision,
  photo_url text,
  confirmations integer,
  reports integer,
  created_at timestamptz,
  category text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    o.id,
    o.product,
    o.price,
    o.store_name,
    extensions.st_y(o.location::extensions.geometry) as latitude,
    extensions.st_x(o.location::extensions.geometry) as longitude,
    o.photo_url,
    o.confirmations,
    o.reports,
    o.created_at,
    o.category
  from public.offers o
  where extensions.st_dwithin(
      o.location,
      extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
      radius_m
    )
    and o.created_at > now() - make_interval(days => max_age_days)
    and o.hidden_at is null
  order by o.created_at desc
  limit least(max_results, 1000);
$$;

grant execute on function public.nearby_offers(double precision, double precision, double precision, integer, integer)
  to anon, authenticated;

-- Locales dentro del radio que tienen al menos una oferta vigente y visible, más cercanos primero.
-- Alimenta los pines del mapa (un pin por local).
-- `categories` = categorías distintas de las ofertas vigentes del local (para el filtro del mapa).
create or replace function public.nearby_stores(
  user_lat double precision,
  user_lng double precision,
  radius_meters integer default 40000
)
returns table (
  id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  distance_meters double precision,
  active_offers_count integer,
  categories text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography
      as point
  )
  select
    s.id,
    s.name,
    s.address,
    extensions.st_y(s.location::extensions.geometry) as lat,
    extensions.st_x(s.location::extensions.geometry) as lng,
    extensions.st_distance(s.location, origin.point) as distance_meters,
    active.offers_count as active_offers_count,
    active.categories
  from public.stores s
  cross join origin
  join lateral (
    select
      count(*)::integer as offers_count,
      array_agg(distinct o.category order by o.category) as categories
    from public.offers o
    where o.store_id = s.id
      and o.created_at > now() - interval '7 days'
      and o.hidden_at is null
  ) active on active.offers_count > 0
  where extensions.st_dwithin(
    s.location,
    origin.point,
    least(greatest(coalesce(radius_meters, 40000), 0), 50000)
  )
  order by distance_meters
  limit 1000;
$$;

-- Ofertas vigentes y visibles de un local, más nuevas primero, junto con el voto del usuario
-- (null si no votó o no tiene sesión). Alimenta la "Ficha de local".
create or replace function public.get_store_offers(p_store_id uuid)
returns table (
  id uuid,
  product text,
  price integer,
  photo_url text,
  confirmations integer,
  reports integer,
  created_at timestamptz,
  my_vote text,
  category text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.product,
    o.price,
    o.photo_url,
    o.confirmations,
    o.reports,
    o.created_at,
    v.vote as my_vote,
    o.category
  from public.offers o
  left join public.offer_votes v
    on v.offer_id = o.id
   and v.user_id = auth.uid()
  where o.store_id = p_store_id
    and o.created_at > now() - interval '7 days'
    and o.hidden_at is null
  order by o.created_at desc
  limit 500;
$$;

-- TODOS los locales en un radio corto (tengan o no ofertas vigentes), más cercanos primero.
-- Se usa al publicar, para sugerir locales cercanos y no crear duplicados.
-- active_offers_count cuenta solo ofertas visibles, igual que nearby_stores.
create or replace function public.find_nearby_stores(
  user_lat double precision,
  user_lng double precision,
  radius_meters integer default 200
)
returns table (
  id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  distance_meters double precision,
  active_offers_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography
      as point
  )
  select
    s.id,
    s.name,
    s.address,
    extensions.st_y(s.location::extensions.geometry) as lat,
    extensions.st_x(s.location::extensions.geometry) as lng,
    extensions.st_distance(s.location, origin.point) as distance_meters,
    active.offers_count as active_offers_count
  from public.stores s
  cross join origin
  cross join lateral (
    select count(*)::integer as offers_count
    from public.offers o
    where o.store_id = s.id
      and o.created_at > now() - interval '7 days'
      and o.hidden_at is null
  ) active
  where extensions.st_dwithin(
    s.location,
    origin.point,
    least(greatest(coalesce(radius_meters, 200), 0), 2000)
  )
  order by distance_meters
  limit 50;
$$;

-- Permisos: las funciones de lectura las puede usar cualquiera, con o sin sesión.
revoke execute on function public.nearby_stores(double precision, double precision, integer) from public;
revoke execute on function public.get_store_offers(uuid) from public;
revoke execute on function public.find_nearby_stores(double precision, double precision, integer) from public;
grant execute on function public.nearby_stores(double precision, double precision, integer) to anon, authenticated;
grant execute on function public.get_store_offers(uuid) to anon, authenticated;
grant execute on function public.find_nearby_stores(double precision, double precision, integer) to anon, authenticated;

-- 5. submit_offer con validaciones anti-troll -----------------------------------------------------
-- Mismos parámetros y tipo de retorno que antes, así `create or replace` la reemplaza en su lugar.
-- Nota: la versión final y vigente de submit_offer está en 20261009000000_submit_offer_store_reuse.sql.

-- Valida y guarda una oferta. Es la ÚNICA forma de crear ofertas: la app no tiene permiso para
-- insertar directamente en la tabla offers, así que todo reporte pasa por estas validaciones.
-- * Con p_store_id: la oferta se asocia a ese local y toma su nombre y ubicación
--   (se ignoran p_store_name / p_lat / p_lng / p_store_address).
-- * Con p_store_id null: se crea un local nuevo con p_store_name / p_lat / p_lng / p_store_address,
--   solo después de pasar todas las validaciones y en la misma transacción que la oferta.
-- * p_category: una de las categorías permitidas por offers_category_check; vacía = 'otros'.
-- Los errores llevan un código `hint` que la app traduce a mensajes en pantalla:
--   not_authenticated, invalid_product_name, invalid_price, invalid_category, invalid_input,
--   store_not_found, out_of_area, invalid_photo, rate_limited, duplicate_offer, price_outlier.
-- Orden de las validaciones: sesión → nombre → precio → categoría → local → zona → foto
--   → límite de publicaciones → duplicados → precio fuera de rango → guardar.
create or replace function public.submit_offer(
  p_product text,
  p_price integer,
  p_store_name text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_photo_url text default null,
  p_store_id uuid default null,
  p_store_address text default null,
  p_category text default 'otros'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean_product text := btrim(regexp_replace(coalesce(p_product, ''), '\s+', ' ', 'g'));
  clean_store text := btrim(regexp_replace(coalesce(p_store_name, ''), '\s+', ' ', 'g'));
  clean_address text := nullif(btrim(regexp_replace(coalesce(p_store_address, ''), '\s+', ' ', 'g')), '');
  clean_category text := coalesce(nullif(lower(btrim(p_category)), ''), 'otros');
  point extensions.geography;
  -- Centro del Gran Concepción (el mismo que la región inicial del mapa en la app).
  region_center extensions.geography :=
    extensions.st_setsrid(extensions.st_makepoint(-73.0444, -36.8201), 4326)::extensions.geography;
  target_store_id uuid := p_store_id;
  recent_count integer;
  sample_count integer;
  median_price double precision;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Debes iniciar sesión para publicar.' using hint = 'not_authenticated';
  end if;

  -- Nombre del producto: de 2 a 80 caracteres, con al menos 2 letras (rechaza "12345" o "!!!")
  -- y sin 4 o más letras iguales seguidas ("aaaa"). Las letras con tilde se listan a mano para que
  -- funcionen sin importar la configuración de idioma de la base de datos. Los números no se
  -- revisan, así "Pack 10000" sigue siendo válido.
  if char_length(clean_product) not between 2 and 80
     or char_length(regexp_replace(clean_product, '[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]', '', 'g')) < 2
     or clean_product ~* '([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ])\1{3,}' then
    raise exception 'Escribe un nombre de producto real (entre 2 y 80 caracteres, con letras).'
      using hint = 'invalid_product_name';
  end if;

  -- Precios realistas de supermercado o almacén de barrio, en pesos chilenos (CLP).
  if p_price is null or p_price < 50 or p_price > 500000 then
    raise exception 'El precio debe estar entre $50 y $500.000.' using hint = 'invalid_price';
  end if;

  -- Debe coincidir con la restricción offers_category_check de la tabla.
  if clean_category not in (
    'abarrotes', 'lacteos', 'panaderia', 'bebidas', 'frutas_verduras', 'carnes', 'aseo', 'otros'
  ) then
    raise exception 'La categoría no es válida.' using hint = 'invalid_category';
  end if;

  -- Local: si viene un id, se toma el local existente; si no, se validan los datos del local nuevo.
  if target_store_id is not null then
    select s.name, s.location into clean_store, point
    from public.stores s
    where s.id = target_store_id;

    if not found then
      raise exception 'Ese local ya no existe. Elige otro o créalo de nuevo.'
        using hint = 'store_not_found';
    end if;
  else
    if char_length(clean_store) = 0 then
      raise exception 'Completa el producto y el local.' using hint = 'invalid_input';
    end if;

    if char_length(clean_store) > 80 then
      raise exception 'El nombre del local es demasiado largo.' using hint = 'invalid_input';
    end if;

    if clean_address is not null and char_length(clean_address) > 160 then
      raise exception 'La dirección es demasiado larga.' using hint = 'invalid_input';
    end if;

    if p_lat is null or p_lng is null then
      raise exception 'Por ahora MarketApp solo funciona en el Gran Concepción.'
        using hint = 'out_of_area';
    end if;

    point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  end if;

  -- Zona: la oferta debe estar a menos de 40 km del centro del Gran Concepción.
  if not extensions.st_dwithin(point, region_center, 40000) then
    raise exception 'Por ahora MarketApp solo funciona en el Gran Concepción.'
      using hint = 'out_of_area';
  end if;

  -- Las fotos deben estar en la carpeta propia del usuario dentro del bucket offer-photos
  -- (impide usar fotos de otras personas o enlaces externos).
  if p_photo_url is not null
     and p_photo_url not like '%/storage/v1/object/public/offer-photos/' || uid::text || '/%' then
    raise exception 'La foto no es válida.' using hint = 'invalid_photo';
  end if;

  -- Límite de ráfaga: máximo 5 ofertas cada 10 minutos (usa el índice offers_created_by_idx).
  select count(*) into recent_count
  from public.offers o
  where o.created_by = uid
    and o.created_at > now() - interval '10 minutes';

  if recent_count >= 5 then
    raise exception 'Estás publicando muy rápido. Espera unos minutos antes de publicar otra oferta.'
      using hint = 'rate_limited';
  end if;

  -- Límite por hora: máximo 10 ofertas por hora.
  select count(*) into recent_count
  from public.offers o
  where o.created_by = uid
    and o.created_at > now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception 'Llegaste al límite de 10 ofertas por hora. Intenta más tarde.'
      using hint = 'rate_limited';
  end if;

  -- Duplicados: el mismo producto y precio ya publicado en este local en los últimos 15 minutos,
  -- por cualquier usuario. Solo aplica a locales existentes (uno nuevo todavía no tiene ofertas).
  if target_store_id is not null and exists (
    select 1
    from public.offers o
    where o.store_id = target_store_id
      and o.hidden_at is null
      and o.created_at > now() - interval '15 minutes'
      and o.price = p_price
      and lower(o.product) = lower(clean_product)
  ) then
    raise exception 'Esta oferta ya fue publicada hace poco en este local. Confírmala en vez de repetirla.'
      using hint = 'duplicate_offer';
  end if;

  -- Precio fuera de rango: se compara con productos parecidos (similarity > 0.5) reportados a
  -- menos de 30 km en los últimos 30 días. Si el precio es más del triple o menos de un tercio
  -- de la mediana, se rechaza. Solo aplica cuando hay al menos 3 reportes para comparar.
  select count(*), percentile_cont(0.5) within group (order by o.price)
    into sample_count, median_price
  from public.offers o
  where extensions.similarity(lower(o.product), lower(clean_product)) > 0.5
    and o.created_at > now() - interval '30 days'
    and o.hidden_at is null
    and extensions.st_dwithin(o.location, point, 30000);

  if sample_count >= 3 and (p_price > median_price * 3 or p_price < median_price / 3) then
    raise exception 'Ese precio se aleja mucho de lo que reportan tus vecinos (cerca de $%). Revisa que esté bien escrito.',
      round(median_price)
      using hint = 'price_outlier';
  end if;

  -- Todo pasó: se crea el local (si es nuevo) y luego la oferta. Se devuelve el id de la oferta.
  if target_store_id is null then
    insert into public.stores (name, address, location, created_by)
    values (clean_store, clean_address, point, uid)
    returning id into target_store_id;
  end if;

  insert into public.offers (product, price, store_name, location, photo_url, created_by, store_id, category)
  values (clean_product, p_price, clean_store, point, p_photo_url, uid, target_store_id, clean_category)
  returning id into new_id;

  return new_id;
end;
$$;

-- Permisos: solo usuarios con sesión (incluidos los anónimos) pueden publicar.
revoke execute on function public.submit_offer(text, integer, text, double precision, double precision, text, uuid, text, text)
  from public, anon;
grant execute on function public.submit_offer(text, integer, text, double precision, double precision, text, uuid, text, text)
  to authenticated;

-- 6. Recarga el esquema de PostgREST (la API automática de Supabase) para que los cambios se vean
--    de inmediato desde la app.
notify pgrst, 'reload schema';

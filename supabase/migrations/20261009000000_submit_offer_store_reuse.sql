-- MarketApp: corrige ofertas duplicadas que se colaban en submit_offer.
--
-- Error: duplicate_offer solo se revisaba cuando se enviaba p_store_id. Cuando la app envía p_store_id = null
-- ("+ Crear nuevo local", o la búsqueda de locales cercanos falló / no tenía ubicación), submit_offer
-- siempre creaba un local NUEVO, así el mismo producto + precio + nombre de local se podía publicar
-- una y otra vez, cada vez en un local duplicado nuevo.
--
-- Solución:
-- * Con p_store_id null, primero se reutiliza un local existente con el mismo nombre (sin importar
--   mayúsculas ni espacios) a menos de 150 m — la misma idea de radio que el relleno inicial de locales.
--   Solo si no existe ninguno se crea un local nuevo.
-- * duplicate_offer se revisa DESPUÉS de resolver el local, así también cubre ese caso.
-- * Un bloqueo de transacción por usuario pone en fila sus propias publicaciones, así un doble toque no
--   puede colar dos ofertas idénticas por las validaciones de duplicado y de límite de publicaciones.
--
-- Mismos parámetros, tipo de retorno y permisos que antes (`create or replace` en su lugar). Se puede
-- ejecutar sola en el editor SQL de Supabase.

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

  -- Una publicación a la vez por usuario (se libera al terminar la transacción).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('submit_offer:' || uid::text));

  -- Nombre del producto: de 2 a 80 caracteres, con al menos 2 letras (rechaza "12345" o "!!!") y sin 4 o
  -- más letras iguales seguidas ("aaaa"). Las letras con tilde se listan a mano para que funcionen con cualquier
  -- configuración de idioma de la base de datos; los números no se revisan, así "Pack 10000" sigue siendo válido.
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

  -- Mantener sincronizado con offers_category_check.
  if clean_category not in (
    'abarrotes', 'lacteos', 'panaderia', 'bebidas', 'frutas_verduras', 'carnes', 'aseo', 'otros'
  ) then
    raise exception 'La categoría no es válida.' using hint = 'invalid_category';
  end if;

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

    -- Reutiliza un local existente con el mismo nombre cerca, en vez de crear un duplicado
    -- (stores.name ya viene recortado; se compara sin espacios repetidos y sin importar mayúsculas).
    -- La oferta se asocia a ese local y toma su nombre y ubicación, igual que con p_store_id.
    select s.id, s.name, s.location into target_store_id, clean_store, point
    from public.stores s
    where lower(regexp_replace(s.name, '\s+', ' ', 'g')) = lower(clean_store)
      and extensions.st_dwithin(s.location, point, 150)
    order by extensions.st_distance(s.location, point)
    limit 1;

    if not found then
      -- `select into` sin filas deja las variables en null; se restauran para crear un local nuevo.
      target_store_id := null;
      clean_store := btrim(regexp_replace(coalesce(p_store_name, ''), '\s+', ' ', 'g'));
      point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
    end if;
  end if;

  if not extensions.st_dwithin(point, region_center, 40000) then
    raise exception 'Por ahora MarketApp solo funciona en el Gran Concepción.'
      using hint = 'out_of_area';
  end if;

  -- Las fotos deben estar en la carpeta propia del usuario dentro del bucket offer-photos.
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
  -- por cualquier usuario. Se revisa después de resolver el local (enviado, o reutilizado por nombre + cercanía),
  -- así aplica tanto si la app envió p_store_id como si no. Un local realmente nuevo todavía no tiene ofertas.
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

  -- Precio fuera de rango: se compara con productos visibles parecidos reportados cerca en los últimos 30 días.
  -- Solo aplica cuando hay al menos 3 reportes para comparar.
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

revoke execute on function public.submit_offer(text, integer, text, double precision, double precision, text, uuid, text, text)
  from public, anon;
grant execute on function public.submit_offer(text, integer, text, double precision, double precision, text, uuid, text, text)
  to authenticated;

notify pgrst, 'reload schema';

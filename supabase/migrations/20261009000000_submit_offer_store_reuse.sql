-- MarketApp: fix duplicate offers slipping through submit_offer.
--
-- Bug: duplicate_offer only ran when p_store_id was sent. When the app sends p_store_id = null
-- ("+ Crear nuevo local", or the nearby-store search failed / had no location), submit_offer
-- always created a NEW store, so the same product + price + store name could be published
-- again and again, each time in a brand-new duplicate store.
--
-- Fix:
-- * With p_store_id null, first reuse an existing store with the same (case-insensitive,
--   whitespace-normalized) name within 150 m — the same radius idea as the stores backfill.
--   Only when none exists is a new store created.
-- * duplicate_offer runs AFTER the store is resolved, so it also covers that path.
-- * A per-user transaction lock serializes a user's own submissions, so a double tap can't
--   slip two identical offers past the duplicate / rate-limit checks.
--
-- Same signature, return type and grants as before (`create or replace` in place). Safe to run
-- on its own in the Supabase SQL editor.

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
  -- Gran Concepción center (same as the app's default map region).
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

  -- One submission at a time per user (released at the end of the transaction).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('submit_offer:' || uid::text));

  -- Product name: 2–80 chars, at least 2 letters (no "12345" / "!!!"), and no run of 4+ of the
  -- same letter ("aaaa"). Explicit letter class so accents work regardless of the DB locale;
  -- digits are not checked for runs, so "Pack 10000" stays valid.
  if char_length(clean_product) not between 2 and 80
     or char_length(regexp_replace(clean_product, '[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]', '', 'g')) < 2
     or clean_product ~* '([a-zA-ZáéíóúüñÁÉÍÓÚÜÑ])\1{3,}' then
    raise exception 'Escribe un nombre de producto real (entre 2 y 80 caracteres, con letras).'
      using hint = 'invalid_product_name';
  end if;

  -- Realistic supermarket / neighborhood-store prices, in CLP.
  if p_price is null or p_price < 50 or p_price > 500000 then
    raise exception 'El precio debe estar entre $50 y $500.000.' using hint = 'invalid_price';
  end if;

  -- Keep in sync with offers_category_check.
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

    -- Reuse an existing store with the same name nearby instead of creating a duplicate
    -- (stores.name is already trimmed; compare whitespace-collapsed and case-insensitive).
    -- The offer then joins it and inherits its name and location, like with p_store_id.
    select s.id, s.name, s.location into target_store_id, clean_store, point
    from public.stores s
    where lower(regexp_replace(s.name, '\s+', ' ', 'g')) = lower(clean_store)
      and extensions.st_dwithin(s.location, point, 150)
    order by extensions.st_distance(s.location, point)
    limit 1;

    if not found then
      -- `select into` with no row resets the targets to null; restore them for a new store.
      target_store_id := null;
      clean_store := btrim(regexp_replace(coalesce(p_store_name, ''), '\s+', ' ', 'g'));
      point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
    end if;
  end if;

  if not extensions.st_dwithin(point, region_center, 40000) then
    raise exception 'Por ahora MarketApp solo funciona en el Gran Concepción.'
      using hint = 'out_of_area';
  end if;

  -- Photos must live in this user's own folder of the offer-photos bucket.
  if p_photo_url is not null
     and p_photo_url not like '%/storage/v1/object/public/offer-photos/' || uid::text || '/%' then
    raise exception 'La foto no es válida.' using hint = 'invalid_photo';
  end if;

  -- Burst limit: 5 offers per 10 minutes (uses offers_created_by_idx).
  select count(*) into recent_count
  from public.offers o
  where o.created_by = uid
    and o.created_at > now() - interval '10 minutes';

  if recent_count >= 5 then
    raise exception 'Estás publicando muy rápido. Espera unos minutos antes de publicar otra oferta.'
      using hint = 'rate_limited';
  end if;

  -- Hourly limit: 10 offers per hour.
  select count(*) into recent_count
  from public.offers o
  where o.created_by = uid
    and o.created_at > now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception 'Llegaste al límite de 10 ofertas por hora. Intenta más tarde.'
      using hint = 'rate_limited';
  end if;

  -- Duplicates: same product and price already published in this store in the last 15 minutes,
  -- by anyone. Runs after the store is resolved (sent, or reused by name + proximity), so it
  -- applies whether or not the app sent p_store_id. A genuinely new store has no offers yet.
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

  -- Outlier check: compare with similar visible products reported nearby in the last 30 days.
  -- Only applies once there are at least 3 reports to compare against.
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

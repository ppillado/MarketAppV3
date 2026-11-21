-- MarketApp: offer categories. Every offer gets one normalized category slug, so the map and the
-- store lists can filter by category. Additive only: older app versions ignore the new columns
-- and submit_offer's new p_category parameter defaults to 'otros'.

-- 1. Column, index, backfill -----------------------------------------------------------------

-- Keep this slug list in sync with the check inside submit_offer below.
alter table public.offers
  add column category text not null default 'otros'
  constraint offers_category_check check (category in (
    'abarrotes', 'lacteos', 'panaderia', 'bebidas', 'frutas_verduras', 'carnes', 'aseo', 'otros'
  ));

-- Current offers of a category (category + created_at window).
create index offers_category_created_at_idx on public.offers (category, created_at desc);

-- Backfill existing offers from basic product-name keywords. Order matters on overlaps
-- (e.g. "café con leche" → bebidas, "jabón de leche" → aseo). Anything unmatched stays 'otros'.
update public.offers o
set category = case
    when o.product ~* '\m(detergente|cloro|jab[oó]n|shampoo|champ[uú]|papel higi[eé]nico|lavalozas?|suavizante|desodorante|pasta dental|crema dental|limpiador)'
      then 'aseo'
    when o.product ~* '\m(carnes?|pollo|cerdo|vacuno|posta|lomo|chuletas?|longanizas?|salchichas?|vienesas?|jam[oó]n|pescado|molida)\M'
      then 'carnes'
    when o.product ~* '\m(bebidas?|coca|pepsi|sprite|fanta|jugos?|agua|cervezas?|vino|caf[eé]|t[eé]|n[eé]ctar)\M'
      then 'bebidas'
    when o.product ~* '\m(leche|yogh?urt?|quesos?|mantequilla|crema|manjar|l[aá]cteos?)\M'
      then 'lacteos'
    when o.product ~* '\m(pan|hallullas?|marraquetas?|amasado|dobladitas?|queques?|kuchen)\M'
      then 'panaderia'
    when o.product ~* '\m(tomates?|papas?|cebollas?|lechugas?|paltas?|manzanas?|pl[aá]tanos?|naranjas?|limon(es)?|lim[oó]n|zanahorias?|frutas?|verduras?)\M'
      then 'frutas_verduras'
    when o.product ~* '\m(arroz|fideos?|spaghetti|tallarines|aceite|az[uú]car|harina|sal|huevos?|at[uú]n|porotos?|lentejas?|avena|galletas?|legumbres)\M'
      then 'abarrotes'
    else 'otros'
  end
where o.category = 'otros';

-- 2. Read RPCs -------------------------------------------------------------------------------
-- The returned columns change, which `create or replace` cannot do, so each one is dropped and
-- recreated (same body as before, plus the category column) and its grants are re-applied.

drop function public.nearby_offers(double precision, double precision, double precision, integer, integer);

-- Offers within `radius_m` meters of (lat, lng), newest first, ignoring stale reports.
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
  order by o.created_at desc
  limit least(max_results, 1000);
$$;

grant execute on function public.nearby_offers(double precision, double precision, double precision, integer, integer)
  to anon, authenticated;

drop function public.nearby_stores(double precision, double precision, integer);

-- Stores within the radius that have at least one current offer, nearest first (map pins).
-- `categories` = distinct categories of the store's current offers, so the map can filter pins
-- locally (and from the offline cache) without another request.
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
  ) active on active.offers_count > 0
  where extensions.st_dwithin(
    s.location,
    origin.point,
    least(greatest(coalesce(radius_meters, 40000), 0), 50000)
  )
  order by distance_meters
  limit 1000;
$$;

drop function public.get_store_offers(uuid);

-- Current offers of one store, newest first, with the caller's vote (null if none / no session).
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
  order by o.created_at desc
  limit 500;
$$;

revoke execute on function public.nearby_stores(double precision, double precision, integer) from public;
revoke execute on function public.get_store_offers(uuid) from public;
grant execute on function public.nearby_stores(double precision, double precision, integer) to anon, authenticated;
grant execute on function public.get_store_offers(uuid) to anon, authenticated;

-- 3. submit_offer with category --------------------------------------------------------------
-- Replaced (not overloaded) so PostgREST never has two candidates for the same named call.
drop function public.submit_offer(text, integer, text, double precision, double precision, text, uuid, text);

-- Validates and inserts an offer.
-- * p_store_id given: the offer joins that store and inherits its name and location
--   (p_store_name / p_lat / p_lng / p_store_address are ignored).
-- * p_store_id null: a new store is created from p_store_name / p_lat / p_lng / p_store_address,
--   only after every check passes, in the same transaction as the offer.
-- * p_category: one of the offers_category_check slugs; null / empty means 'otros'.
-- Errors carry a `hint` code the app maps to UI.
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

  if char_length(clean_product) = 0 then
    raise exception 'Completa el producto y el local.' using hint = 'invalid_input';
  end if;

  if p_price is null or p_price <= 0 or p_price >= 10000000 then
    raise exception 'El precio no es válido.' using hint = 'invalid_input';
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

  select count(*) into recent_count
  from public.offers o
  where o.created_by = uid
    and o.created_at > now() - interval '1 hour';

  if recent_count >= 10 then
    raise exception 'Llegaste al límite de 10 ofertas por hora. Intenta más tarde.'
      using hint = 'rate_limited';
  end if;

  -- Outlier check: compare with similar products reported nearby in the last 30 days.
  -- Only applies once there are at least 3 reports to compare against.
  select count(*), percentile_cont(0.5) within group (order by o.price)
    into sample_count, median_price
  from public.offers o
  where extensions.similarity(lower(o.product), lower(clean_product)) > 0.5
    and o.created_at > now() - interval '30 days'
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

-- 4. Refresh PostgREST's schema cache so the new signatures are callable right away.
notify pgrst, 'reload schema';

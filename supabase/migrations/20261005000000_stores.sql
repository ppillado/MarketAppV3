-- MarketApp: stores ("locales") that group offers. The map shows one pin per store; each
-- store lists its current offers. offers.store_name / offers.location stay as a copy of the
-- store's, so nearby_offers and older app versions keep working.

-- 1. Stores ----------------------------------------------------------------------------------

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  address text check (address is null or (address = btrim(address) and char_length(address) between 1 and 160)),
  location extensions.geography(point, 4326) not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.stores is 'Stores that group offers. Writes only via submit_offer (no client insert policy).';

create index stores_location_idx on public.stores using gist (location);

-- Anyone can read; nobody can write directly from the app (stores are created by submit_offer).
alter table public.stores enable row level security;

create policy "Stores are readable by everyone"
  on public.stores for select
  to anon, authenticated
  using (true);

-- 2. Link offers to stores -------------------------------------------------------------------

alter table public.offers
  add column store_id uuid references public.stores (id) on delete cascade;

-- Also serves "current offers of a store" (store_id + created_at window).
create index offers_store_id_idx on public.offers (store_id, created_at desc);

-- Backfill: one store per group of existing offers with the same (normalized) store name
-- reported within ~150 m of each other, so different branches of a chain stay separate.
do $$
declare
  grp record;
  new_store_id uuid;
begin
  for grp in
    with normalized as (
      select
        o.id,
        o.store_name,
        o.location,
        o.created_by,
        o.created_at,
        lower(btrim(regexp_replace(o.store_name, '\s+', ' ', 'g'))) as norm_name
      from public.offers o
      where o.store_id is null
    ),
    clustered as (
      select
        n.*,
        -- eps in degrees: 0.0015° ≈ 165 m latitude / 135 m longitude in Gran Concepción.
        extensions.st_clusterdbscan(n.location::extensions.geometry, 0.0015, 1)
          over (partition by n.norm_name) as cluster_id
      from normalized n
    )
    select
      coalesce(
        nullif(btrim(regexp_replace(mode() within group (order by c.store_name), '\s+', ' ', 'g')), ''),
        'Local'
      ) as name,
      extensions.st_centroid(extensions.st_collect(c.location::extensions.geometry))::extensions.geography
        as location,
      (array_agg(c.created_by order by c.created_at))[1] as created_by,
      min(c.created_at) as created_at,
      array_agg(c.id) as offer_ids
    from clustered c
    group by c.norm_name, c.cluster_id
  loop
    insert into public.stores (name, location, created_by, created_at)
    values (left(grp.name, 80), grp.location, grp.created_by, grp.created_at)
    returning id into new_store_id;

    update public.offers o
    set store_id = new_store_id
    where o.id = any (grp.offer_ids);
  end loop;
end;
$$;

-- Every offer belongs to a store from now on (submit_offer always sets it).
alter table public.offers alter column store_id set not null;

-- 3. Read RPCs -------------------------------------------------------------------------------
-- "Current" offer = reported in the last 7 days, same rule as nearby_offers' default.

-- Stores within the radius that have at least one current offer, nearest first (map pins).
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
  join lateral (
    select count(*)::integer as offers_count
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
  my_vote text
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
    v.vote as my_vote
  from public.offers o
  left join public.offer_votes v
    on v.offer_id = o.id
   and v.user_id = auth.uid()
  where o.store_id = p_store_id
    and o.created_at > now() - interval '7 days'
  order by o.created_at desc
  limit 500;
$$;

-- ALL stores within a short radius (with or without current offers), nearest first.
-- Used when publishing, so the user can pick an existing store instead of creating a duplicate.
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
  ) active
  where extensions.st_dwithin(
    s.location,
    origin.point,
    least(greatest(coalesce(radius_meters, 200), 0), 2000)
  )
  order by distance_meters
  limit 50;
$$;

revoke execute on function public.nearby_stores(double precision, double precision, integer) from public;
revoke execute on function public.get_store_offers(uuid) from public;
revoke execute on function public.find_nearby_stores(double precision, double precision, integer) from public;
grant execute on function public.nearby_stores(double precision, double precision, integer) to anon, authenticated;
grant execute on function public.get_store_offers(uuid) to anon, authenticated;
grant execute on function public.find_nearby_stores(double precision, double precision, integer) to anon, authenticated;

-- 4. submit_offer with stores ----------------------------------------------------------------
-- Replaced (not overloaded) so PostgREST never has two candidates for the same named call.
drop function public.submit_offer(text, integer, text, double precision, double precision, text);

-- Validates and inserts an offer.
-- * p_store_id given: the offer joins that store and inherits its name and location
--   (p_store_name / p_lat / p_lng / p_store_address are ignored).
-- * p_store_id null: a new store is created from p_store_name / p_lat / p_lng / p_store_address,
--   only after every check passes, in the same transaction as the offer.
-- Errors carry a `hint` code the app maps to UI.
create or replace function public.submit_offer(
  p_product text,
  p_price integer,
  p_store_name text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_photo_url text default null,
  p_store_id uuid default null,
  p_store_address text default null
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

  insert into public.offers (product, price, store_name, location, photo_url, created_by, store_id)
  values (clean_product, p_price, clean_store, point, p_photo_url, uid, target_store_id)
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.submit_offer(text, integer, text, double precision, double precision, text, uuid, text)
  from public, anon;
grant execute on function public.submit_offer(text, integer, text, double precision, double precision, text, uuid, text)
  to authenticated;

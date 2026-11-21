-- MarketApp: anti-troll moderation.
-- * Community auto-hide: an offer with enough "Agotado/Error" reports is hidden from every read
--   RPC, and comes back if votes change and the rule no longer holds.
-- * Self-votes stay blocked (now with hint 'cannot_vote_own_offer').
-- * submit_offer gets stricter price / product-name checks, duplicate detection and a short
--   rate limit. Its signature (9 parameters, including p_category) is unchanged.
-- Additive for the app: every read RPC keeps its signature and returned columns.

-- 1. Columns, constraints, index ---------------------------------------------------------------

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

-- Visible offers of a store within a time window (nearby_stores / get_store_offers).
create index offers_visible_store_created_at_idx
  on public.offers (store_id, created_at desc)
  where hidden_at is null;

-- 2. Hide rule ---------------------------------------------------------------------------------

-- Single source of truth for community auto-hide: at least 3 reports and reports outnumber
-- confirmations by 2 or more (so a well-confirmed offer survives a few trolls).
create or replace function public.offer_should_hide(p_confirmations integer, p_reports integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_reports, 0) >= 3
     and coalesce(p_reports, 0) - coalesce(p_confirmations, 0) >= 2;
$$;

-- Internal helper: only called from SECURITY DEFINER functions (which run as the owner).
revoke execute on function public.offer_should_hide(integer, integer) from public, anon, authenticated;

-- Backfill: hide existing offers that already meet the rule.
update public.offers o
set hidden_at = now(), hidden_reason = 'community_reports'
where o.hidden_at is null
  and public.offer_should_hide(o.confirmations, o.reports);

-- 3. Votes: recompute visibility, block self-votes -----------------------------------------------
-- Same signature and return type, so `create or replace` keeps existing grants (re-applied below).

-- Sets ('confirm' | 'report') or clears (null) the caller's vote on an offer and returns the
-- offer's updated counters. Counters change by delta, so seeded counts are preserved.
-- After the counters change, hidden_at / hidden_reason are recomputed under the same row lock.
-- Votes on hidden offers are still accepted, so retracting a report can bring an offer back.
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

  -- Lock the offer row so concurrent votes on it apply one after another.
  select o.created_by into offer_owner
  from public.offers o
  where o.id = p_offer_id
  for update;

  if not found then
    raise exception 'Esta oferta ya no existe.' using hint = 'not_found';
  end if;

  -- The author can neither confirm nor report their own offer.
  if offer_owner = uid then
    raise exception 'No puedes votar tu propia oferta.' using hint = 'cannot_vote_own_offer';
  end if;

  select v.vote into previous
  from public.offer_votes v
  where v.offer_id = p_offer_id and v.user_id = uid;

  if p_vote is null then
    delete from public.offer_votes v where v.offer_id = p_offer_id and v.user_id = uid;
  else
    insert into public.offer_votes (offer_id, user_id, vote)
    values (p_offer_id, uid, p_vote)
    on conflict (offer_id, user_id) do update
      set vote = excluded.vote, updated_at = now();
  end if;

  update public.offers o
  set
    confirmations = greatest(0, o.confirmations
      - (case when previous = 'confirm' then 1 else 0 end)
      + (case when p_vote = 'confirm' then 1 else 0 end)),
    reports = greatest(0, o.reports
      - (case when previous = 'report' then 1 else 0 end)
      + (case when p_vote = 'report' then 1 else 0 end))
  where o.id = p_offer_id;

  -- Recompute visibility from the new counters. Keeps the original hidden_at while still hidden,
  -- and only un-hides offers hidden by community reports (never a future manual hide).
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

  return query
  select o.confirmations, o.reports from public.offers o where o.id = p_offer_id;
end;
$$;

revoke execute on function public.set_offer_vote(uuid, text) from public, anon;
grant execute on function public.set_offer_vote(uuid, text) to authenticated;

-- 4. Read RPCs exclude hidden offers -------------------------------------------------------------
-- Same signatures and returned columns as 20261006000000_offer_categories.sql, plus
-- `o.hidden_at is null`. Store counts and categories therefore always match the listed offers.

-- Offers within `radius_m` meters of (lat, lng), newest first, ignoring stale and hidden reports.
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

-- Stores within the radius that have at least one current visible offer, nearest first (map pins).
-- `categories` = distinct categories of the store's current visible offers.
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

-- Current visible offers of one store, newest first, with the caller's vote (null if none / no session).
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

-- ALL stores within a short radius (with or without current offers), nearest first.
-- Used when publishing; active_offers_count counts visible offers only, like nearby_stores.
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

revoke execute on function public.nearby_stores(double precision, double precision, integer) from public;
revoke execute on function public.get_store_offers(uuid) from public;
revoke execute on function public.find_nearby_stores(double precision, double precision, integer) from public;
grant execute on function public.nearby_stores(double precision, double precision, integer) to anon, authenticated;
grant execute on function public.get_store_offers(uuid) to anon, authenticated;
grant execute on function public.find_nearby_stores(double precision, double precision, integer) to anon, authenticated;

-- 5. submit_offer with anti-troll checks ----------------------------------------------------------
-- Same signature and return type as before, so `create or replace` replaces it in place.

-- Validates and inserts an offer.
-- * p_store_id given: the offer joins that store and inherits its name and location
--   (p_store_name / p_lat / p_lng / p_store_address are ignored).
-- * p_store_id null: a new store is created from p_store_name / p_lat / p_lng / p_store_address,
--   only after every check passes, in the same transaction as the offer.
-- * p_category: one of the offers_category_check slugs; null / empty means 'otros'.
-- Errors carry a `hint` code the app maps to UI:
--   not_authenticated, invalid_product_name, invalid_price, invalid_category, invalid_input,
--   store_not_found, out_of_area, invalid_photo, rate_limited, duplicate_offer, price_outlier.
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
  -- by anyone. Only possible for an existing store (a new one has no offers yet).
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

-- 6. Refresh PostgREST's schema cache so the changes are visible right away.
notify pgrst, 'reload schema';

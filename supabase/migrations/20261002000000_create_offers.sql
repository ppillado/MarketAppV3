-- MarketApp: community price reports ("offers"), geolocated with PostGIS.

create extension if not exists postgis with schema extensions;

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  product text not null check (char_length(product) between 1 and 80),
  -- Integer CLP.
  price integer not null check (price > 0 and price < 10000000),
  store_name text not null check (char_length(store_name) between 1 and 80),
  location extensions.geography(point, 4326) not null,
  photo_url text,
  confirmations integer not null default 0 check (confirmations >= 0),
  reports integer not null default 0 check (reports >= 0),
  created_at timestamptz not null default now()
);

comment on table public.offers is 'Community price reports. Writes only via server-side validation (no client insert policy).';

create index offers_location_idx on public.offers using gist (location);
create index offers_created_at_idx on public.offers (created_at desc);

-- Row Level Security: anyone can read; nobody can write directly from the app.
-- Inserts and votes will go through server-side functions that validate outliers first.
alter table public.offers enable row level security;

create policy "Offers are readable by everyone"
  on public.offers for select
  to anon, authenticated
  using (true);

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
  created_at timestamptz
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
    o.created_at
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

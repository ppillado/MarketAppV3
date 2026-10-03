-- MarketApp: publishing offers through server-side validation, and offer photos in Storage.
-- Requires Authentication → Sign In / Providers → "Allow anonymous sign-ins" enabled:
-- every device gets an anonymous user, used for rate limiting (and later, one vote per user).

create extension if not exists pg_trgm with schema extensions;

alter table public.offers
  add column created_by uuid references auth.users (id) on delete set null;

create index offers_created_by_idx on public.offers (created_by, created_at desc);

-- Validates and inserts an offer. The app has no direct insert access (see RLS on offers),
-- so every report goes through these checks. Errors carry a `hint` code the app maps to UI.
create or replace function public.submit_offer(
  p_product text,
  p_price integer,
  p_store_name text,
  p_lat double precision,
  p_lng double precision,
  p_photo_url text default null
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
  point extensions.geography :=
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
  -- Gran Concepción center (same as the app's default map region).
  region_center extensions.geography :=
    extensions.st_setsrid(extensions.st_makepoint(-73.0444, -36.8201), 4326)::extensions.geography;
  recent_count integer;
  sample_count integer;
  median_price double precision;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Debes iniciar sesión para publicar.' using hint = 'not_authenticated';
  end if;

  if char_length(clean_product) = 0 or char_length(clean_store) = 0 then
    raise exception 'Completa el producto y el local.' using hint = 'invalid_input';
  end if;

  if p_price is null or p_price <= 0 or p_price >= 10000000 then
    raise exception 'El precio no es válido.' using hint = 'invalid_input';
  end if;

  if p_lat is null or p_lng is null
     or not extensions.st_dwithin(point, region_center, 40000) then
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

  insert into public.offers (product, price, store_name, location, photo_url, created_by)
  values (clean_product, p_price, clean_store, point, p_photo_url, uid)
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.submit_offer(text, integer, text, double precision, double precision, text)
  from public, anon;
grant execute on function public.submit_offer(text, integer, text, double precision, double precision, text)
  to authenticated;

-- Offer photos: public read (shown on cards), uploads only into the user's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-photos', 'offer-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users upload offer photos to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'offer-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

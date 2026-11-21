-- MarketApp: user preferences for the "Para ti" recommendations. Only the favorite categories
-- are stored here; the ranking itself is computed in the app from the cached nearby_offers.
-- One row per (anonymous or linked) user, created lazily by set_favorite_categories.

-- 1. Table and RLS ---------------------------------------------------------------------------

-- Keep this slug list in sync with offers_category_check and set_favorite_categories below.
create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  favorite_categories text[] not null default '{}'
    constraint user_preferences_favorite_categories_check
    check (favorite_categories <@ array[
      'abarrotes', 'lacteos', 'panaderia', 'bebidas', 'frutas_verduras', 'carnes', 'aseo', 'otros'
    ]::text[]),
  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is
  'Per-user preferences (favorite offer categories). Written via set_favorite_categories.';

-- Each user can read and modify only their own row.
alter table public.user_preferences enable row level security;

create policy "Users read their own preferences"
  on public.user_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert their own preferences"
  on public.user_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update their own preferences"
  on public.user_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 2. RPCs ------------------------------------------------------------------------------------

-- The caller's favorite categories, or '{}' if they have not saved any yet.
create or replace function public.get_my_preferences()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.favorite_categories
     from public.user_preferences p
     where p.user_id = auth.uid()),
    '{}'::text[]
  );
$$;

-- Replaces the caller's favorite categories and returns what was saved.
-- Values are lowercased and trimmed; null / empty entries are dropped; duplicates are removed
-- keeping the order of first appearance. null or '{}' clears the favorites.
create or replace function public.set_favorite_categories(p_categories text[])
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean text[];
  saved text[];
begin
  if uid is null then
    raise exception 'Debes iniciar sesión para guardar tus preferencias.'
      using hint = 'not_authenticated';
  end if;

  select coalesce(array_agg(s.slug order by s.first_ord), '{}'::text[])
    into clean
  from (
    select lower(btrim(c.value)) as slug, min(c.ord) as first_ord
    from unnest(coalesce(p_categories, '{}'::text[])) with ordinality as c (value, ord)
    where nullif(btrim(c.value), '') is not null
    group by lower(btrim(c.value))
  ) s;

  -- Keep in sync with user_preferences_favorite_categories_check.
  if not (clean <@ array[
    'abarrotes', 'lacteos', 'panaderia', 'bebidas', 'frutas_verduras', 'carnes', 'aseo', 'otros'
  ]::text[]) then
    raise exception 'Alguna categoría no es válida.' using hint = 'invalid_category';
  end if;

  insert into public.user_preferences as p (user_id, favorite_categories)
  values (uid, clean)
  on conflict (user_id) do update
    set favorite_categories = excluded.favorite_categories, updated_at = now()
  returning p.favorite_categories into saved;

  return saved;
end;
$$;

revoke execute on function public.get_my_preferences() from public, anon;
revoke execute on function public.set_favorite_categories(text[]) from public, anon;
grant execute on function public.get_my_preferences() to authenticated;
grant execute on function public.set_favorite_categories(text[]) to authenticated;

-- 3. Refresh PostgREST's schema cache so the new functions are callable right away.
notify pgrst, 'reload schema';

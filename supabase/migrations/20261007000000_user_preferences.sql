-- MarketApp: preferencias del usuario para las recomendaciones "Para ti". Aquí solo se guardan las categorías
-- favoritas; el ranking en sí se calcula en la app a partir de la caché de nearby_offers.
-- Una fila por usuario (anónimo o vinculado), que set_favorite_categories crea cuando se necesita.

-- 1. Tabla y RLS -----------------------------------------------------------------------------

-- Mantener esta lista de slugs sincronizada con offers_category_check y set_favorite_categories, más abajo.
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

-- Cada usuario puede leer y modificar solo su propia fila.
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

-- Las categorías favoritas del usuario que llama, o '{}' si todavía no guarda ninguna.
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

-- Reemplaza las categorías favoritas del usuario que llama y devuelve lo que se guardó.
-- Los valores se pasan a minúsculas y se recortan; se descartan los null o vacíos; se quitan los duplicados
-- manteniendo el orden de primera aparición. null o '{}' borra las favoritas.
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

  -- Mantener sincronizado con user_preferences_favorite_categories_check.
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

-- 3. Recarga la caché de esquema de PostgREST para que las nuevas funciones se puedan llamar de inmediato.
notify pgrst, 'reload schema';

-- MarketApp: community validation votes ("👍 Confirmar" / "👎 Agotado/Error").
-- One vote per (anonymous) user per offer. offers.confirmations / offers.reports are kept
-- as running counters, so feeds never need to aggregate the votes table.

create table public.offer_votes (
  offer_id uuid not null references public.offers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote text not null check (vote in ('confirm', 'report')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (offer_id, user_id)
);

create index offer_votes_user_idx on public.offer_votes (user_id);

-- Users can read only their own votes (to show which button they pressed).
-- No direct writes: votes go through set_offer_vote, which also updates the counters.
alter table public.offer_votes enable row level security;

create policy "Users read their own votes"
  on public.offer_votes for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Sets ('confirm' | 'report') or clears (null) the caller's vote on an offer and returns the
-- offer's updated counters. Counters change by delta, so seeded counts are preserved.
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

  if offer_owner = uid then
    raise exception 'No puedes votar tu propia oferta.' using hint = 'own_offer';
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

  return query
  select o.confirmations, o.reports from public.offers o where o.id = p_offer_id;
end;
$$;

revoke execute on function public.set_offer_vote(uuid, text) from public, anon;
grant execute on function public.set_offer_vote(uuid, text) to authenticated;

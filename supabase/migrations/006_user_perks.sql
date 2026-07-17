-- ============================================================
-- Migration 006: Per-user perk sync + global egg names
-- Run in Supabase SQL Editor after 005_fix_rpcs_and_purchases.sql
--
-- user_perks is the single source of truth for purchased perks.
-- For now the signed-in client writes its own row (client-trusted,
-- same as the localStorage stopgap). Once the Paddle webhook Edge
-- Function is live, point the webhook at this table and drop the
-- client-write policies below in favour of service_role writes.
-- ============================================================

-- 1. Per-user perk state
create table if not exists public.user_perks (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  extra_clicks    int not null default 0 check (extra_clicks >= 0),
  unlimited_until timestamptz,
  golden_cursor   boolean not null default false,
  diamond_skin    boolean not null default false,
  crack_badge     boolean not null default false,
  egg_name        text check (char_length(egg_name) <= 40),
  updated_at      timestamptz not null default now()
);

alter table public.user_perks enable row level security;

create policy "read own perks" on public.user_perks
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "insert own perks" on public.user_perks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "update own perks" on public.user_perks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Keep updated_at fresh on every update
create or replace function public.touch_user_perks()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_perks_touch on public.user_perks;
create trigger user_perks_touch
  before update on public.user_perks
  for each row execute function public.touch_user_perks();

-- 2. Names that scroll across the egg — readable by everyone (incl. anon)
create table if not exists public.egg_names (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.egg_names enable row level security;

create policy "egg names are public" on public.egg_names
  for select to anon, authenticated
  using (true);

create policy "insert own egg name" on public.egg_names
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "update own egg name" on public.egg_names
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

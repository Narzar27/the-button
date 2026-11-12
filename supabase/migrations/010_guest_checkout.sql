-- ============================================================
-- Migration 010: Let people buy perks without a site account
--
-- Paddle checkout only ever needed an email — our own sign-in gate
-- was the extra friction. Rather than loosen user_perks (an auth.uid()
-- could be guessed off the public leaderboard, so mixing real users
-- and guests into one table would let a stranger drain a real buyer's
-- balance), guests get their own parallel tables keyed by anon_id
-- (a random UUID that's never shown anywhere publicly). Same shape as
-- user_perks / egg_names, credited only by the webhook.
-- ============================================================

create table if not exists public.guest_perks (
  anon_id         uuid primary key,
  extra_clicks    int not null default 0 check (extra_clicks >= 0),
  unlimited_until timestamptz,
  golden_cursor   boolean not null default false,
  diamond_skin    boolean not null default false,
  crack_badge     boolean not null default false,
  updated_at      timestamptz not null default now()
);

alter table public.guest_perks enable row level security;

create policy "read guest perks" on public.guest_perks
  for select to anon, authenticated
  using (true);

create or replace function public.touch_guest_perks()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists guest_perks_touch on public.guest_perks;
create trigger guest_perks_touch
  before update on public.guest_perks
  for each row execute function public.touch_guest_perks();

create table if not exists public.guest_egg_names (
  anon_id    uuid primary key,
  name       text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.guest_egg_names enable row level security;

create policy "guest egg names are public" on public.guest_egg_names
  for select to anon, authenticated
  using (true);

-- Webhook-only credit path for guest purchases (mirrors credit_purchase)
create or replace function public.credit_guest_purchase(
  gid uuid,
  add_clicks int default 0,
  unlimited_hours int default 0,
  set_golden boolean default false,
  set_diamond boolean default false,
  set_badge boolean default false,
  new_egg_name text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.guest_perks
    (anon_id, extra_clicks, unlimited_until, golden_cursor, diamond_skin, crack_badge)
  values (
    gid,
    greatest(add_clicks, 0),
    case when unlimited_hours > 0 then now() + make_interval(hours => unlimited_hours) end,
    set_golden, set_diamond, set_badge
  )
  on conflict (anon_id) do update set
    extra_clicks = guest_perks.extra_clicks + greatest(excluded.extra_clicks, 0),
    unlimited_until = case
      when unlimited_hours > 0
        then greatest(coalesce(guest_perks.unlimited_until, now()), now())
             + make_interval(hours => unlimited_hours)
      else guest_perks.unlimited_until
    end,
    golden_cursor = guest_perks.golden_cursor or excluded.golden_cursor,
    diamond_skin  = guest_perks.diamond_skin  or excluded.diamond_skin,
    crack_badge   = guest_perks.crack_badge   or excluded.crack_badge;

  if new_egg_name is not null then
    insert into public.guest_egg_names (anon_id, name)
    values (gid, left(new_egg_name, 40))
    on conflict (anon_id) do update set name = excluded.name;
  end if;
end;
$$;

revoke execute on function public.credit_guest_purchase(uuid, int, int, boolean, boolean, boolean, text)
  from public, anon, authenticated;
grant execute on function public.credit_guest_purchase(uuid, int, int, boolean, boolean, boolean, text)
  to service_role;

-- Guests spending their own purchased clicks. anon_id is never shown
-- publicly (unlike auth user ids, which the leaderboard exposes), so
-- this carries the same accepted risk level as daily_clicks already does.
create or replace function public.spend_guest_extra_clicks(gid uuid, amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  update public.guest_perks
  set extra_clicks = greatest(0, extra_clicks - greatest(amount, 0))
  where anon_id = gid
  returning extra_clicks into remaining;
  return coalesce(remaining, 0);
end;
$$;

grant execute on function public.spend_guest_extra_clicks(uuid, int) to anon, authenticated;

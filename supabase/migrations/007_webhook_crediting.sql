-- ============================================================
-- Migration 007: Webhook-authoritative purchase crediting
-- Run in Supabase SQL Editor after 006_user_perks.sql
--
-- The paddle-webhook Edge Function (service role) is now the only
-- thing that CREDITS perks. The client only SPENDS, via the atomic
-- spend_extra_clicks() RPC, so credits and spends can never clobber
-- each other with absolute writes.
-- ============================================================

-- 1. Atomic credit, called by the paddle-webhook Edge Function only
create or replace function public.credit_purchase(
  uid uuid,
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
  insert into public.user_perks
    (user_id, extra_clicks, unlimited_until, golden_cursor, diamond_skin, crack_badge, egg_name)
  values (
    uid,
    greatest(add_clicks, 0),
    case when unlimited_hours > 0 then now() + make_interval(hours => unlimited_hours) end,
    set_golden, set_diamond, set_badge,
    left(new_egg_name, 40)
  )
  on conflict (user_id) do update set
    extra_clicks = user_perks.extra_clicks + greatest(excluded.extra_clicks, 0),
    unlimited_until = case
      when unlimited_hours > 0
        then greatest(coalesce(user_perks.unlimited_until, now()), now())
             + make_interval(hours => unlimited_hours)
      else user_perks.unlimited_until
    end,
    golden_cursor = user_perks.golden_cursor or excluded.golden_cursor,
    diamond_skin  = user_perks.diamond_skin  or excluded.diamond_skin,
    crack_badge   = user_perks.crack_badge   or excluded.crack_badge,
    egg_name      = coalesce(excluded.egg_name, user_perks.egg_name);

  if new_egg_name is not null then
    insert into public.egg_names (user_id, name)
    values (uid, left(new_egg_name, 40))
    on conflict (user_id) do update set name = excluded.name;
  end if;
end;
$$;

-- Webhook-only: never callable from the browser
revoke execute on function public.credit_purchase(uuid, int, int, boolean, boolean, boolean, text)
  from public, anon, authenticated;
grant execute on function public.credit_purchase(uuid, int, int, boolean, boolean, boolean, text)
  to service_role;

-- 2. Atomic spend — the signed-in client decrements its own balance.
--    SECURITY INVOKER, so RLS still scopes it to the caller's row.
create or replace function public.spend_extra_clicks(amount int)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  remaining int;
begin
  update public.user_perks
  set extra_clicks = greatest(0, extra_clicks - greatest(amount, 0))
  where user_id = (select auth.uid())
  returning extra_clicks into remaining;
  return coalesce(remaining, 0);
end;
$$;

revoke execute on function public.spend_extra_clicks(int) from public, anon;
grant execute on function public.spend_extra_clicks(int) to authenticated;

-- 3. Retire the old crediting path: add_extra_clicks was SECURITY DEFINER
--    with default PUBLIC execute, meaning ANYONE could grant ANY user free
--    clicks. It wrote users.extra_clicks, which nothing reads anymore.
drop function if exists public.add_extra_clicks(uuid, int);
alter table public.users drop column if exists extra_clicks;

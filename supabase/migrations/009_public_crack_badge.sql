-- ============================================================
-- Migration 009: Make the "Founding Clicker" badge publicly visible
--
-- user_perks is private (locked down in 008) — right for extra_clicks
-- etc, wrong for a badge that's supposed to show on the leaderboard.
-- users is already public-read, so mirror crack_badge there instead of
-- reopening user_perks RLS. credit_purchase sets both from now on.
-- ============================================================

alter table public.users add column if not exists crack_badge boolean not null default false;

-- Backfill existing badge owners
update public.users u
set crack_badge = true
from public.user_perks p
where p.user_id = u.id and p.crack_badge = true;

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

  if set_badge then
    update public.users set crack_badge = true where id = uid;
  end if;
end;
$$;

revoke execute on function public.credit_purchase(uuid, int, int, boolean, boolean, boolean, text)
  from public, anon, authenticated;
grant execute on function public.credit_purchase(uuid, int, int, boolean, boolean, boolean, text)
  to service_role;

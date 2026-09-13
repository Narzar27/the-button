-- ============================================================
-- Migration 008: Close the client-write exploit on paid perks
-- Run in Supabase SQL Editor after 007_webhook_crediting.sql
--
-- 006_user_perks.sql left "client-trusted" INSERT/UPDATE policies on
-- user_perks and egg_names as a stopgap until the Paddle webhook went
-- live, with a note to drop them afterwards. That cleanup never
-- happened — which means right now any signed-in user can open
-- devtools and directly upsert user_perks (extra_clicks, golden_cursor,
-- diamond_skin, crack_badge, unlimited_until) or egg_names, granting
-- themselves every paid perk for free with no purchase at all. Same
-- issue on users.total_clicks — no WITH CHECK on "users_update" means
-- a client can set their own leaderboard total to anything.
--
-- After this migration, the ONLY ways to write these columns are:
--   - credit_purchase()   — service_role only, called by the verified
--                           Paddle webhook
--   - spend_extra_clicks()— now SECURITY DEFINER, but still hard-scoped
--                           to auth.uid()'s own row and can only ever
--                           decrease extra_clicks
--   - increment_user_clicks() / increment_user_breaks() — already
--                           SECURITY DEFINER RPCs, unaffected by this
-- ============================================================

-- 1. user_perks — remove client write access, keep read-only
drop policy if exists "insert own perks" on public.user_perks;
drop policy if exists "update own perks" on public.user_perks;

-- spend_extra_clicks must still work for signed-in clients after the
-- UPDATE policy above is gone — make it SECURITY DEFINER (it already
-- scopes strictly to auth.uid(), so it can never touch another user's
-- row or grant clicks, only spend the caller's own).
create or replace function public.spend_extra_clicks(amount int)
returns int
language plpgsql
security definer
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

-- 2. egg_names — "Name on the Egg" is a paid perk; only credit_purchase
--    (inside its own SECURITY DEFINER body) may write it now.
drop policy if exists "insert own egg name" on public.egg_names;
drop policy if exists "update own egg name" on public.egg_names;

-- 3. users — total_clicks must only move via increment_user_clicks();
--    display_name has no client edit UI, so no client UPDATE is needed.
drop policy if exists "users_update" on public.users;

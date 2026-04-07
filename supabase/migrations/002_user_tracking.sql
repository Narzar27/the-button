-- ============================================================
-- Migration 002: User auto-creation trigger + click tracking
-- Run in Supabase SQL Editor after 001_egg_schema.sql
-- ============================================================

-- 1. Auto-create a users row when someone signs in for the first time.
--    Uses the name from Google, or email prefix for magic-link users.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, display_name, total_clicks)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. RPC: increment_user_clicks — safely increment total_clicks for a user
CREATE OR REPLACE FUNCTION increment_user_clicks(uid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET total_clicks = total_clicks + 1
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute on both RPCs to authenticated and anon roles
GRANT EXECUTE ON FUNCTION increment_egg(INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_user_clicks(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user() TO supabase_auth_admin;

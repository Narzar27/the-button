-- Fix increment_user_clicks: upsert so it works even if users row doesn't exist yet
CREATE OR REPLACE FUNCTION increment_user_clicks(uid UUID)
RETURNS void AS $$
DECLARE
  uname TEXT;
BEGIN
  SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    split_part(email, '@', 1),
    'Cracker'
  ) INTO uname FROM auth.users WHERE id = uid;

  INSERT INTO public.users (id, display_name, total_clicks)
  VALUES (uid, COALESCE(uname, 'Cracker'), 1)
  ON CONFLICT (id) DO UPDATE
    SET total_clicks = users.total_clicks + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix increment_user_breaks: same upsert treatment
CREATE OR REPLACE FUNCTION increment_user_breaks(uid UUID)
RETURNS void AS $$
DECLARE
  uname TEXT;
BEGIN
  SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    split_part(email, '@', 1),
    'Cracker'
  ) INTO uname FROM auth.users WHERE id = uid;

  INSERT INTO public.users (id, display_name, eggs_cracked)
  VALUES (uid, COALESCE(uname, 'Cracker'), 1)
  ON CONFLICT (id) DO UPDATE
    SET eggs_cracked = users.eggs_cracked + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_user_clicks(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_user_breaks(UUID) TO authenticated;

-- Fix purchases table: add columns the webhook needs (migration 004's CREATE was skipped
-- because the table already existed from migration 001 with a different schema)
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS transaction_id     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS price_id           TEXT,
  ADD COLUMN IF NOT EXISTS status             TEXT DEFAULT 'completed';

-- Service role needs INSERT on purchases for the webhook
DO $$ BEGIN
  CREATE POLICY "service_role_insert_purchases"
    ON purchases FOR INSERT TO service_role WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

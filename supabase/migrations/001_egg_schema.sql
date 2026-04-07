-- ============================================================
-- The Egg — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create eggs table
CREATE TABLE IF NOT EXISTS eggs (
  id            SERIAL PRIMARY KEY,
  number        INT NOT NULL DEFAULT 1,
  target_clicks BIGINT NOT NULL DEFAULT 4000000000,
  current_clicks BIGINT NOT NULL DEFAULT 0,
  cracked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create users table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name  TEXT NOT NULL,
  total_clicks  BIGINT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create daily_clicks table for anonymous click tracking
CREATE TABLE IF NOT EXISTS daily_clicks (
  id          SERIAL PRIMARY KEY,
  anon_id     TEXT NOT NULL,
  date        DATE DEFAULT CURRENT_DATE,
  click_count INT DEFAULT 0,
  UNIQUE(anon_id, date)
);

-- 4. Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id           SERIAL PRIMARY KEY,
  anon_id      TEXT,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  product_type TEXT NOT NULL,
  quantity     INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Seed the first egg
INSERT INTO eggs (number, target_clicks, current_clicks)
VALUES (1, 4000000000, 0)
ON CONFLICT DO NOTHING;

-- 6. RPC: increment_egg (atomic, safe)
CREATE OR REPLACE FUNCTION increment_egg(amount INT DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE eggs
  SET current_clicks = current_clicks + amount
  WHERE id = (SELECT id FROM eggs ORDER BY number DESC LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Enable RLS on all tables
ALTER TABLE eggs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies

-- eggs: anyone can read
CREATE POLICY "eggs_read" ON eggs FOR SELECT TO anon, authenticated USING (true);

-- users: anyone can read (leaderboard), only owner can insert/update
CREATE POLICY "users_read" ON users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- daily_clicks: anon can upsert their own row (scoped by anon_id passed from client)
-- Note: anon_id is a client-generated UUID — not cryptographically enforced at the DB level.
-- For stronger enforcement, move to an Edge Function.
CREATE POLICY "daily_clicks_upsert" ON daily_clicks FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- purchases: only service role can write (via Edge Function webhook)
CREATE POLICY "purchases_read" ON purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE for purchases = service role only (default deny for anon/authenticated)

-- 9. Enable Realtime on eggs table
-- Go to: Supabase Dashboard → Database → Publications → supabase_realtime
-- Add the `eggs` table to the publication.
-- (Cannot be done via SQL migration — must be done in the dashboard UI)

-- ============================================================
-- OPTIONAL: Rename old button_presses table (if migrating)
-- Uncomment if you want to keep the old data:
--
-- ALTER TABLE button_presses RENAME TO egg_clicks_legacy;
-- DROP FUNCTION IF EXISTS increment_button(INT);
-- ============================================================

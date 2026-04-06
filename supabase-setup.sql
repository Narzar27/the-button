-- ─────────────────────────────────────────────────────────────────────────────
-- The Button — Supabase Database Setup
-- Run this entire file in your Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the counter table
CREATE TABLE IF NOT EXISTS button_presses (
  id           INTEGER PRIMARY KEY DEFAULT 1,
  total_count  BIGINT  NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 2. Seed the initial row
INSERT INTO button_presses (id, total_count)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- 3. Atomic increment function (prevents race conditions)
CREATE OR REPLACE FUNCTION increment_button(amount INTEGER DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE button_presses
  SET total_count = total_count + amount,
      updated_at  = now()
  WHERE id = 1;
END;
$$;

-- 4. Enable Row Level Security
ALTER TABLE button_presses ENABLE ROW LEVEL SECURITY;

-- 5. Allow anyone to read the count
CREATE POLICY "Anyone can read"
  ON button_presses FOR SELECT
  USING (true);

-- 6. Allow anyone to call increment (the function handles the update)
CREATE POLICY "Anyone can update via function"
  ON button_presses FOR UPDATE
  USING (true);

-- 7. Enable Realtime for this table
-- Go to: Supabase Dashboard → Database → Replication
-- Toggle ON the "button_presses" table under "Source"
-- (Cannot be done via SQL, must be done in the dashboard)

-- ─────────────────────────────────────────────────────────────────────────────
-- That's it! Now update your environment.ts with your project URL and anon key.
-- ─────────────────────────────────────────────────────────────────────────────

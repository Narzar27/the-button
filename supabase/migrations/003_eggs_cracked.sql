-- ============================================================
-- Migration 003: Add eggs_cracked column + RPC
-- Run in Supabase SQL Editor after 002_user_tracking.sql
-- ============================================================

-- 1. Add eggs_cracked column to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS eggs_cracked INT DEFAULT 0;

-- 2. RPC: increment_user_breaks — increment eggs_cracked for a signed-in user
CREATE OR REPLACE FUNCTION increment_user_breaks(uid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET eggs_cracked = eggs_cracked + 1
  WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION increment_user_breaks(UUID) TO authenticated;

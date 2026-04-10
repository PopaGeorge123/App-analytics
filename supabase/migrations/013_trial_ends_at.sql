-- ============================================================
-- FOLD — Add trial_ends_at column to users table
-- Run in Supabase Dashboard → SQL Editor
-- Idempotent: uses IF NOT EXISTS guard
-- ============================================================

alter table public.users
  add column if not exists trial_ends_at timestamptz;

comment on column public.users.trial_ends_at is
  'UTC timestamp when the user''s free trial expires. '
  'Set once on first sign-up (auth/callback route). '
  'NULL means the user never started a trial or is already on a paid plan.';

-- Backfill existing users: set trial_ends_at based on their created_at
-- so users who signed up before this column existed get an accurate countdown
-- (3 days from sign-up, not 3 days from now).
-- Touches all non-premium users regardless of current trial_ends_at value
-- so any wrong "now() + 3 days" values are corrected too.
update public.users
set trial_ends_at = created_at + interval '3 days'
where is_premium = false;

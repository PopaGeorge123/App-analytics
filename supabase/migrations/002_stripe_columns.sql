-- ============================================================
-- FOLD — Stripe subscription columns
-- Run in Supabase → SQL Editor AFTER 001_initial_schema.sql
-- ============================================================

alter table public.users
  add column if not exists is_premium          boolean not null default false,
  add column if not exists stripe_customer_id  text unique,
  add column if not exists stripe_subscription_id text unique;

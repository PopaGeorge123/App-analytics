-- ============================================================
-- FOLD — Missing columns & tables
-- Run in Supabase Dashboard → SQL Editor
-- Idempotent: all statements use IF NOT EXISTS / IF EXISTS guards
-- ============================================================

-- ── 1. users — columns used by Stripe billing logic ──────────────────────────

-- trial_used: prevents users from getting a second free trial
alter table public.users
  add column if not exists trial_used boolean not null default false;

comment on column public.users.trial_used is
  'Set to true the first time a user activates a trial so they cannot get a second one.';

-- ── 2. integrations — currency column ────────────────────────────────────────
-- Stored on connect; used by the dashboard to format Meta Ads spend correctly.

alter table public.integrations
  add column if not exists currency text;

comment on column public.integrations.currency is
  'Account currency reported by the platform (e.g. "USD", "EUR"). '
  'Set during OAuth callback; used to format monetary values in the UI.';

-- ── 3. share_tokens — public report sharing ──────────────────────────────────
-- Created by /api/report/share, read by /api/report/[token] (no auth required).

create table if not exists public.share_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null default '',
  date_from   text not null,        -- YYYY-MM-DD
  date_to     text not null,        -- YYYY-MM-DD
  platforms   text[] not null default '{}',
  payload     jsonb not null default '{}',
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  view_count  integer not null default 0
);

create index if not exists share_tokens_token_idx
  on public.share_tokens (token);

create index if not exists share_tokens_user_idx
  on public.share_tokens (user_id, created_at desc);

-- No RLS policy needed for SELECT (public endpoint validates token in code).
-- Only the service role writes/reads this table.
alter table public.share_tokens enable row level security;

-- Allow authenticated users to read their own tokens (e.g. to list shared reports)
create policy "share_tokens: select own"
  on public.share_tokens for select
  using (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE are service-role only (no client-side policy needed).

-- ── Done ──────────────────────────────────────────────────────────────────────
-- Verify with:
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'users'
--   order by ordinal_position;

-- ============================================================
-- FOLD — Website profiles table
-- Run in Supabase → SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. website_profiles table
-- ──────────────────────────────────────────────────────────
create table if not exists public.website_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  url         text not null,
  -- Future AI analysis fields
  title       text,
  description text,
  score       integer,            -- overall UX score 0-100
  report      jsonb,              -- full AI analysis report
  last_scanned_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint website_profiles_user_id_unique unique (user_id)  -- one website per user
);

-- ──────────────────────────────────────────────────────────
-- 2. Row Level Security
-- ──────────────────────────────────────────────────────────
alter table public.website_profiles enable row level security;

create policy "website_profiles: select own"
  on public.website_profiles for select
  using (auth.uid() = user_id);

create policy "website_profiles: insert own"
  on public.website_profiles for insert
  with check (auth.uid() = user_id);

create policy "website_profiles: update own"
  on public.website_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "website_profiles: delete own"
  on public.website_profiles for delete
  using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- 3. Auto-update updated_at trigger
-- ──────────────────────────────────────────────────────────
drop trigger if exists website_profiles_updated_at on public.website_profiles;
create trigger website_profiles_updated_at
  before update on public.website_profiles
  for each row execute procedure public.handle_updated_at();

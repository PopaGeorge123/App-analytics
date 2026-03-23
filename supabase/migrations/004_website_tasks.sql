-- ============================================================
-- FOLD — Website tasks + score column
-- Run AFTER 003_website_profiles.sql
-- Supabase → SQL Editor
-- ============================================================

-- ── 1. Add score + analysis_status to website_profiles ──────
alter table public.website_profiles
  add column if not exists score            integer not null default 0,
  add column if not exists analysis_status  text    not null default 'idle',
  add column if not exists analysis_error   text;

-- ── 2. website_tasks table ────────────────────────────────────
create table if not exists public.website_tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  description   text not null,
  category      text not null,   -- 'ux' | 'performance' | 'seo' | 'copy' | 'conversion' | 'accessibility'
  impact_score  integer not null default 5,  -- points this task adds to score when completed (1-20)
  completed     boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ── 3. RLS ────────────────────────────────────────────────────
alter table public.website_tasks enable row level security;

create policy "website_tasks: select own"
  on public.website_tasks for select
  using (auth.uid() = user_id);

create policy "website_tasks: insert own"
  on public.website_tasks for insert
  with check (auth.uid() = user_id);

create policy "website_tasks: update own"
  on public.website_tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "website_tasks: delete own"
  on public.website_tasks for delete
  using (auth.uid() = user_id);

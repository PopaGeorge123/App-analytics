-- ============================================================
-- FOLD — Initial schema
-- Run in Supabase → SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. users table — stored in public, linked to auth.users
-- ──────────────────────────────────────────────────────────
create table if not exists public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  full_name    text,
  avatar_url   text,
  company_name text,
  plan         text not null default 'free',    -- 'free' | 'pro' | 'enterprise'
  onboarded    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────
-- 2. Row Level Security — each user can only access
--    their own row
-- ──────────────────────────────────────────────────────────
alter table public.users enable row level security;

create policy "users: select own row"
  on public.users for select
  using (auth.uid() = id);

create policy "users: update own row"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT is only allowed via service_role (from callback)
-- So we don't add an insert policy for anon/authenticated.

-- ──────────────────────────────────────────────────────────
-- 3. Trigger: auto-update updated_at
-- ──────────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
  before update on public.users
  for each row execute procedure public.handle_updated_at();

-- ──────────────────────────────────────────────────────────
-- 4. Waitlist entries
-- ──────────────────────────────────────────────────────────
create table if not exists public.waitlist_entries (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique not null,
  status             text not null default 'pending', -- 'pending' | 'confirmed'
  confirmation_token text unique not null,
  created_at         timestamptz not null default now(),
  confirmed_at       timestamptz
);

alter table public.waitlist_entries enable row level security;

-- Only service_role can access (server-side API routes)
create policy "waitlist: service role only"
  on public.waitlist_entries for all
  using (false);

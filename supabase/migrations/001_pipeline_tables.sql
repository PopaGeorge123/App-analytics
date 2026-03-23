-- ============================================================
-- Fold — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── integrations ─────────────────────────────────────────────
create table if not exists public.integrations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  platform      text not null,           -- 'stripe' | 'ga4' | 'meta'
  access_token  text not null,
  refresh_token text,
  account_id    text,
  property_id   text,
  scope         text,
  expires_at    timestamptz,
  connected_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id, platform)
);

alter table public.integrations enable row level security;

create policy "Users can read own integrations"
  on public.integrations for select
  using (auth.uid() = user_id);

-- Service role can do everything (bypasses RLS)

-- ── daily_snapshots ──────────────────────────────────────────
create table if not exists public.daily_snapshots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  provider   text not null,             -- 'stripe' | 'ga4' | 'meta'
  date       text not null,             -- YYYY-MM-DD
  data       jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, provider, date)
);

create index if not exists daily_snapshots_user_date_idx
  on public.daily_snapshots (user_id, date);

alter table public.daily_snapshots enable row level security;

create policy "Users can read own snapshots"
  on public.daily_snapshots for select
  using (auth.uid() = user_id);

-- ── digests ──────────────────────────────────────────────────
create table if not exists public.digests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          text not null,           -- YYYY-MM-DD
  summary       text not null default '',
  highlights    jsonb not null default '[]',
  anomalies     jsonb not null default '[]',
  cross_insight text not null default '',
  action        jsonb not null default '{}',
  raw_context   jsonb not null default '{}',
  created_at    timestamptz not null default now(),

  unique (user_id, date)
);

alter table public.digests enable row level security;

create policy "Users can read own digests"
  on public.digests for select
  using (auth.uid() = user_id);

-- ── updated_at trigger (applies to integrations + daily_snapshots) ──
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger integrations_updated_at
  before update on public.integrations
  for each row execute function public.set_updated_at();

create trigger daily_snapshots_updated_at
  before update on public.daily_snapshots
  for each row execute function public.set_updated_at();

-- ============================================================
-- FOLD — In-app notifications table
-- Run in Supabase Dashboard → SQL Editor
-- Idempotent: all statements use IF NOT EXISTS guards
-- ============================================================
-- Purpose: persist alert notifications from the sync daemon so
-- they appear in the bell icon regardless of whether the user
-- was logged in when the alert fired.
-- ============================================================

create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  message     text        not null,
  detail      text,                     -- optional secondary line (from alert detail)
  color       text        not null default '#f59e0b',  -- hex colour for the dot
  icon        text,                     -- emoji, e.g. '🚨'
  read        boolean     not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications written by the sync daemon when alert thresholds are '
  'crossed. Displayed in the dashboard notification bell.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists notifications_user_id_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read = false;

-- ── Row-Level Security ────────────────────────────────────────────────────────

alter table public.notifications enable row level security;

-- Users can read their own notifications
create policy "notifications: select own"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
create policy "notifications: update own"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Users can delete their own notifications
create policy "notifications: delete own"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- INSERT is service-role only (sync daemon uses service key)
-- No client-side INSERT policy → falls through to service role bypass.

-- ── Done ─────────────────────────────────────────────────────────────────────

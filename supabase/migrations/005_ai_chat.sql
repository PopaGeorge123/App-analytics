-- ── AI Insights ──────────────────────────────────────────────────────────
-- One insight per user per day (regenerated on demand)
create table if not exists public.ai_insights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now(),
  date        date not null default current_date
);

create index if not exists ai_insights_user_date on public.ai_insights(user_id, date desc);

alter table public.ai_insights enable row level security;

create policy "Users manage own insights"
  on public.ai_insights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── AI Chat Messages ─────────────────────────────────────────────────────
-- Full conversation history per user
create table if not exists public.ai_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists ai_messages_user_created on public.ai_messages(user_id, created_at asc);

alter table public.ai_messages enable row level security;

create policy "Users manage own messages"
  on public.ai_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

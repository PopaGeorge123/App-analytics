-- AI-generated playbooks cache (one row per user, upserted on each generation)
create table if not exists ai_playbooks_cache (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  payload      jsonb       not null,
  generated_at timestamptz not null default now()
);

alter table ai_playbooks_cache enable row level security;

-- Users can only read their own cached playbooks; writes are service-role only
create policy "Users can read own playbooks cache"
  on ai_playbooks_cache for select
  using (auth.uid() = user_id);

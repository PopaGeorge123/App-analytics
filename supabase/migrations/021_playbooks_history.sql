-- Historical playbook generations (one row per generation run, kept indefinitely)
create table if not exists ai_playbooks_history (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  payload      jsonb       not null,
  generated_at timestamptz not null,
  archived_at  timestamptz not null default now()
);

create index if not exists ai_playbooks_history_user_idx
  on ai_playbooks_history(user_id, generated_at desc);

alter table ai_playbooks_history enable row level security;

create policy "Users can read own playbook history"
  on ai_playbooks_history for select
  using (auth.uid() = user_id);

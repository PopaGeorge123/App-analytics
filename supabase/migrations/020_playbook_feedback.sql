-- Tracks per-user feedback on AI playbooks so the AI can learn over time.
-- rating: 1 = helpful, -1 = not helpful / inaccurate
-- completed_steps: array of 0-based step indices the user has ticked off

create table if not exists playbook_feedback (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references users(id) on delete cascade,
  playbook_id      text        not null,          -- slug, e.g. "meta-cpc-fix"
  playbook_title   text        not null default '',
  rating           smallint    check (rating in (-1, 1)),
  completed_steps  integer[]   not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, playbook_id)
);

-- Only the owning user can read/write their own feedback
alter table playbook_feedback enable row level security;

create policy "Users can manage own playbook feedback"
  on playbook_feedback
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh automatically
create or replace function update_playbook_feedback_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_playbook_feedback_updated_at
  before update on playbook_feedback
  for each row execute procedure update_playbook_feedback_updated_at();

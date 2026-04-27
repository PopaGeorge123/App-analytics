-- Integration waitlist: captures user interest for "coming soon" integrations
create table if not exists integration_waitlist (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  email           text not null,
  integration_id  text not null,
  created_at      timestamptz not null default now(),
  unique (email, integration_id)
);

-- Index for counting demand per integration
create index if not exists integration_waitlist_integration_id_idx
  on integration_waitlist (integration_id);

-- RLS: users can insert their own rows; service role reads all
alter table integration_waitlist enable row level security;

create policy "Users can register their own interest"
  on integration_waitlist for insert
  to authenticated
  with check (auth.uid() = user_id);

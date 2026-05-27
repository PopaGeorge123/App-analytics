-- Add 'announced' column to integration_waitlist
-- Used to track which users have been notified when their requested integration goes live

alter table integration_waitlist 
  add column if not exists announced boolean not null default false;

-- Index for querying unannounced waitlist entries
create index if not exists integration_waitlist_announced_idx
  on integration_waitlist (integration_id, announced)
  where announced = false;

comment on column integration_waitlist.announced is 
  'Set to true after sending launch announcement email to this user';

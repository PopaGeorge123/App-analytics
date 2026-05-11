-- Add digest_frequency column to users table
-- Supported values: 'daily' | 'weekly' | 'monthly'
-- digest_day is reused: for weekly = day-of-week (0-6), for monthly = day-of-month (1-31)

alter table public.users
  add column if not exists digest_frequency text not null default 'weekly'
    constraint chk_digest_frequency check (digest_frequency in ('daily', 'weekly', 'monthly'));

comment on column public.users.digest_frequency is
  'How often to send the digest email. daily=every day, weekly=on digest_day (0-6), monthly=on day of month stored in digest_day (1-31).';

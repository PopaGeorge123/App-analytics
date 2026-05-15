-- FOLD — Add trial email dedup flags to users table
-- trial_midpoint_emailed: set to true once the halfway-through-trial email is sent
-- trial_expiry_emailed:   set to true once the last-hours email is sent
-- Both prevent duplicate sends on every daemon tick.

alter table public.users
  add column if not exists trial_midpoint_emailed boolean not null default false,
  add column if not exists trial_expiry_emailed   boolean not null default false;

comment on column public.users.trial_midpoint_emailed is
  'True once the mid-trial FOMO email has been sent. Prevents duplicate sends.';

comment on column public.users.trial_expiry_emailed is
  'True once the last-hours FOMO email has been sent. Prevents duplicate sends.';

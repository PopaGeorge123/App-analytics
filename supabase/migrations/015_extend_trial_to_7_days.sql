-- ============================================================
-- FOLD — Extend free trial from 3 days to 7 days
-- Updates the trigger so all new sign-ups get a 7-day trial.
-- Backfills existing non-premium users who are still in their
-- trial window (trial_ends_at > now) by adding 4 extra days.
-- ============================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url, trial_ends_at)
  values (
    new.id,
    new.email,
    (new.raw_user_meta_data ->> 'full_name'),
    (new.raw_user_meta_data ->> 'avatar_url'),
    now() + interval '7 days'   -- 7-day free trial starts on sign-up
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Backfill: extend active trials (trial_ends_at still in the future) by 4 days
-- so existing users benefit from the extension too.
update public.users
set trial_ends_at = trial_ends_at + interval '4 days'
where is_premium = false
  and trial_ends_at is not null
  and trial_ends_at > now();

-- Backfill: users who signed up but trial_ends_at is NULL — give them 7 days from created_at
update public.users
set trial_ends_at = created_at + interval '7 days'
where is_premium = false
  and trial_ends_at is null;

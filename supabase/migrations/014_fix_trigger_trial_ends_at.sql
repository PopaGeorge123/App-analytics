-- ============================================================
-- FOLD — Fix handle_new_auth_user trigger to set trial_ends_at
-- The original trigger created the users row without trial_ends_at,
-- which meant the auth/callback upsert (ignoreDuplicates: true) could
-- never fill it in, leaving trial_ends_at NULL for all Google OAuth users.
-- ============================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer           -- runs as the table owner, bypasses RLS
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url, trial_ends_at)
  values (
    new.id,
    new.email,
    (new.raw_user_meta_data ->> 'full_name'),
    (new.raw_user_meta_data ->> 'avatar_url'),
    now() + interval '3 days'   -- 3-day free trial starts on sign-up
  )
  on conflict (id) do nothing;   -- safe to call multiple times

  return new;
end;
$$;

-- Trigger already exists from migration 007; just replacing the function is enough.
-- Re-create it anyway to be safe.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Backfill: any existing non-premium users whose trial_ends_at is still NULL
-- get a trial starting from their created_at (same as migration 013 logic).
update public.users
set trial_ends_at = created_at + interval '3 days'
where is_premium = false
  and trial_ends_at is null;

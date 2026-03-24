-- ============================================================
-- FOLD — Auto-create public.users row on new auth signup
-- This trigger fires on INSERT into auth.users, which happens
-- the instant a user signs up (before email confirmation).
-- The callback route upsert remains as a safety net.
-- ============================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer           -- runs as the table owner, bypasses RLS
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    (new.raw_user_meta_data ->> 'full_name'),
    (new.raw_user_meta_data ->> 'avatar_url')
  )
  on conflict (id) do nothing;   -- safe to call multiple times

  return new;
end;
$$;

-- Drop old trigger if it exists so re-running is idempotent
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

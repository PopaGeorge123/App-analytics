-- 023_sync_email_on_update.sql
-- Keep public.users.email in sync when a user confirms an email change
-- in Supabase Auth. The auth.users row is updated after the user clicks
-- the confirmation link in their new inbox.

create or replace function public.handle_auth_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only act when the email actually changed
  if new.email is distinct from old.email then
    update public.users
    set email = new.email
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;

create trigger on_auth_user_email_updated
  after update on auth.users
  for each row execute procedure public.handle_auth_user_email_update();

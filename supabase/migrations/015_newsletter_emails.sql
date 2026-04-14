-- ─────────────────────────────────────────────────────────────────────────────
-- 015_newsletter_emails.sql
-- Adds a `newsletter_emails` boolean column to public.users.
--
-- newsletter_emails = true  → user consents to receive product/tip emails
-- newsletter_emails = false → user has opted out (still gets transactional emails
--                              like digest + alert notifications, but NOT newsletters)
--
-- Default is TRUE so existing users continue receiving emails unless they opt out.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists newsletter_emails boolean not null default true;

comment on column public.users.newsletter_emails is
  'When true the user receives newsletter / product-update emails from Fold. '
  'False = opted out. Transactional emails (digest, alerts) are unaffected.';

-- Partial index — fast lookup when sending newsletters
create index if not exists idx_users_newsletter_emails
  on public.users (id)
  where newsletter_emails = true;

-- ============================================================
-- FOLD — Pre-launch database cleanup
-- ⚠️  Run ONCE in Supabase Dashboard → SQL Editor
-- ⚠️  This permanently deletes ALL test data.
--     There is no undo. Make a backup first if needed.
-- ============================================================

-- ── 1. AI data ───────────────────────────────────────────────
truncate table public.ai_messages      restart identity cascade;
truncate table public.ai_conversations restart identity cascade;
truncate table public.ai_insights      restart identity cascade;

-- ── 2. Website analyser data ─────────────────────────────────
truncate table public.website_tasks    restart identity cascade;
truncate table public.website_profiles restart identity cascade;

-- ── 3. Analytics / integration data ─────────────────────────
truncate table public.daily_snapshots  restart identity cascade;
truncate table public.digests          restart identity cascade;
truncate table public.integrations     restart identity cascade;

-- ── 4. Waitlist entries ───────────────────────────────────────
truncate table public.waitlist_entries restart identity cascade;

-- ── 5. Users (public profile rows) ───────────────────────────
-- This removes rows from public.users only.
-- Auth users (auth.users) are NOT deleted here — do that
-- manually in Supabase Dashboard → Authentication → Users
-- if you also want to wipe login credentials.
truncate table public.users restart identity cascade;

-- ── Done ──────────────────────────────────────────────────────
-- After running this script:
--   1. Go to Authentication → Users and delete all test accounts.
--   2. Verify all tables are empty:
--        select 'users'           as tbl, count(*) from public.users
--        union all
--        select 'integrations',          count(*) from public.integrations
--        union all
--        select 'daily_snapshots',       count(*) from public.daily_snapshots
--        union all
--        select 'digests',               count(*) from public.digests
--        union all
--        select 'website_profiles',      count(*) from public.website_profiles
--        union all
--        select 'website_tasks',         count(*) from public.website_tasks
--        union all
--        select 'ai_conversations',      count(*) from public.ai_conversations
--        union all
--        select 'ai_messages',           count(*) from public.ai_messages
--        union all
--        select 'ai_insights',           count(*) from public.ai_insights
--        union all
--        select 'waitlist_entries',      count(*) from public.waitlist_entries;

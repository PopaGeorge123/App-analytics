-- ============================================================
-- FOLD — Goals & KPIs + Alert Rules + Digest columns
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================
--
-- Adds three columns to public.users:
--
--   alert_rules  jsonb  — thresholds for real-time alert emails
--   goals        jsonb  — monthly KPI targets set by the user
--   goals_notified_month jsonb — internal tracking: which goals have
--                                already triggered a notification email
--                                in the current calendar month (YYYY-MM).
--                                Kept separate from `goals` so the user's
--                                saved targets are never silently mutated.
--
-- ── alert_rules shape ────────────────────────────────────────────────────────
--   {
--     "revenueDropPct":       number,   -- 0 = disabled; alert if 7d revenue drops by X%
--     "bounceSpikeThreshold": number,   -- 0 = disabled; alert if 7d avg bounce rate > X%
--     "spendSpikeThreshold":  number    -- 0 = disabled; alert if a single day's ad spend > $X
--   }
--
-- ── goals shape ──────────────────────────────────────────────────────────────
--   {
--     "revenueTarget":      number,   -- cents; 0 = disabled; monthly Stripe revenue goal
--     "sessionsTarget":     number,   -- integer; 0 = disabled; monthly GA4 sessions goal
--     "subscribersTarget":  number,   -- integer; 0 = disabled; monthly new-subscribers goal
--     "adSpendBudget":      number    -- cents; 0 = disabled; monthly Meta Ads budget cap
--   }
--
-- ── goals_notified_month shape ───────────────────────────────────────────────
--   {
--     "revenueTarget":     "YYYY-MM" | null,
--     "sessionsTarget":    "YYYY-MM" | null,
--     "subscribersTarget": "YYYY-MM" | null,
--     "adSpendBudget":     "YYYY-MM" | null
--   }
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add columns ────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists alert_rules           jsonb default null,
  add column if not exists goals                 jsonb default null,
  add column if not exists goals_notified_month  jsonb default null;

-- ── 2. CHECK constraints — ensure the shape is always valid when set ──────────

-- alert_rules: all three keys must be non-negative numbers when the column is set
alter table public.users
  drop constraint if exists chk_alert_rules_shape;

alter table public.users
  add constraint chk_alert_rules_shape check (
    alert_rules is null
    or (
      jsonb_typeof(alert_rules) = 'object'
      and (alert_rules->>'revenueDropPct')::numeric      >= 0
      and (alert_rules->>'bounceSpikeThreshold')::numeric >= 0
      and (alert_rules->>'spendSpikeThreshold')::numeric  >= 0
    )
  );

-- goals: all four keys must be non-negative numbers when the column is set
alter table public.users
  drop constraint if exists chk_goals_shape;

alter table public.users
  add constraint chk_goals_shape check (
    goals is null
    or (
      jsonb_typeof(goals) = 'object'
      and (goals->>'revenueTarget')::numeric      >= 0
      and (goals->>'sessionsTarget')::numeric      >= 0
      and (goals->>'subscribersTarget')::numeric   >= 0
      and (goals->>'adSpendBudget')::numeric       >= 0
    )
  );

-- ── 3. Indexes — the sync script filters on these columns every day ───────────

-- Partial index: only index rows that actually have alert_rules configured
-- (avoids full-table scans when most users haven't set any rules)
create index if not exists idx_users_alert_rules
  on public.users (id)
  where alert_rules is not null;

-- Partial index: only rows with goals configured
create index if not exists idx_users_goals
  on public.users (id)
  where goals is not null;

-- ── 4. Column comments ────────────────────────────────────────────────────────

comment on column public.users.alert_rules is
  'JSONB — { revenueDropPct, bounceSpikeThreshold, spendSpikeThreshold }. '
  'Checked by sync-all.mjs after every daily sync. 0 = disabled.';

comment on column public.users.goals is
  'JSONB — { revenueTarget (cents), sessionsTarget, subscribersTarget, adSpendBudget (cents) }. '
  'Monthly KPI targets set by the user in Settings → Goals & KPIs. 0 = disabled.';

comment on column public.users.goals_notified_month is
  'JSONB — { revenueTarget, sessionsTarget, subscribersTarget, adSpendBudget } each storing '
  'the last "YYYY-MM" string for which a goal-hit email was sent. '
  'Prevents duplicate notifications within the same calendar month. '
  'Written exclusively by sync-all.mjs — never exposed to the client.';

-- ── 5. Digest preferences ─────────────────────────────────────────────────────
--
-- digest_subscribed  boolean  — user opts into automated weekly digest emails
-- digest_day         smallint — day of week to send (0=Sun … 6=Sat, default Monday=1)
--
-- The cron daemon checks these each day.
-- When digest_subscribed=true AND today is digest_day, a digest is generated
-- via the Anthropic API and emailed via Resend.

alter table public.users
  add column if not exists digest_subscribed  boolean     not null default false,
  add column if not exists digest_day         smallint    not null default 1
    constraint chk_digest_day check (digest_day between 0 and 6);

-- Partial index: only users who have opted into digests
create index if not exists idx_users_digest_subscribed
  on public.users (id, digest_day)
  where digest_subscribed = true;

comment on column public.users.digest_subscribed is
  'true = user opted into automated weekly digest emails. '
  'Checked daily by sync-all.mjs — sends on digest_day.';

comment on column public.users.digest_day is
  'Day of week to send the digest (0=Sun, 1=Mon, …, 6=Sat). Default: 1 (Monday).';

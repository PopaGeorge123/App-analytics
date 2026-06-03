-- ─────────────────────────────────────────────────────────────────────────────
-- 038 · E-commerce KPI Goals
-- Replaces SaaS-centric goal columns with e-commerce equivalents.
-- Adds to public.users table.
-- ─────────────────────────────────────────────────────────────────────────────

-- E-commerce goal columns
alter table public.users
  add column if not exists gmv_target            bigint    default null,   -- cents / month
  add column if not exists aov_target            bigint    default null,   -- cents
  add column if not exists roas_target           numeric(6,2) default null, -- e.g. 3.50
  add column if not exists cac_budget            bigint    default null,   -- cents per new customer
  add column if not exists repeat_purchase_target numeric(5,2) default null, -- % e.g. 25.00
  add column if not exists refund_rate_threshold numeric(5,2) default null, -- % alert threshold e.g. 5.00
  add column if not exists inventory_alert_days  integer   default 7,       -- alert when < N days of stock
  add column if not exists ad_spend_budget       bigint    default null;    -- cents / month total across all platforms

-- E-commerce goal dedup tracker (same pattern as goals_notified_month for SaaS)
-- { gmv_target: "2026-06", aov_target: "2026-06", ... }
alter table public.users
  add column if not exists ecommerce_goals_notified_month jsonb default '{}';

-- Store primary store platform for onboarding flow
alter table public.users
  add column if not exists primary_store_platform text default null; -- 'shopify' | 'woocommerce' | 'bigcommerce' | 'amazon' | 'etsy'

-- Track if user has completed e-commerce onboarding
alter table public.users
  add column if not exists ecommerce_onboarding_completed boolean default false;

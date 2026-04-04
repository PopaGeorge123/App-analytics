-- ============================================================
-- FOLD — Customer records table
-- Run in Supabase Dashboard → SQL Editor
-- Idempotent: all statements use IF NOT EXISTS guards
-- ============================================================
-- Purpose: store individual customer identities synced from
-- revenue platforms (Stripe, Paddle, LemonSqueezy, Gumroad,
-- WooCommerce, Shopify, etc.).
-- One row per (user_id, provider, provider_id).  Total LTV and
-- order count are updated on every sync so they stay current.
-- ============================================================

create table if not exists public.customers (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  provider      text        not null,   -- 'stripe' | 'paddle' | 'lemon-squeezy' | 'gumroad' | 'woocommerce' | 'shopify' …
  provider_id   text        not null,   -- platform's own customer id, e.g. 'cus_abc123'
  email         text,
  name          text,
  total_spent   bigint      not null default 0,  -- lifetime value in **cents** (integer currency)
  order_count   int         not null default 0,
  first_seen    date,
  last_seen     date,
  subscribed    boolean     not null default false,
  churned       boolean     not null default false,
  raw_data      jsonb,      -- optional: store whatever the platform returns for debugging
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- One row per customer per provider per owner account
  unique (user_id, provider, provider_id)
);

comment on table public.customers is
  'Individual customer records synced from connected revenue platforms. '
  'Updated incrementally on every sync run.';

comment on column public.customers.total_spent is
  'Lifetime value in cents (integer). Divide by 100 for display.';

comment on column public.customers.provider_id is
  'The customer ID assigned by the platform, e.g. "cus_abc123" from Stripe.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists customers_user_id_idx
  on public.customers (user_id);

create index if not exists customers_user_provider_idx
  on public.customers (user_id, provider);

create index if not exists customers_user_last_seen_idx
  on public.customers (user_id, last_seen desc);

create index if not exists customers_user_total_spent_idx
  on public.customers (user_id, total_spent desc);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

create or replace function public.set_customers_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_customers_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────────

alter table public.customers enable row level security;

-- Users can only read their own customers
create policy "customers: select own"
  on public.customers for select
  using (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE are service-role only (sync daemon uses service key)
-- No client-side INSERT/UPDATE/DELETE policy → falls through to service role bypass.

-- ── Done ──────────────────────────────────────────────────────────────────────

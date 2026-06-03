-- ============================================================
-- FOLD — Customer enrichment columns
-- Adds rich profile fields to the customers table so the
-- dashboard can display full customer detail views.
-- Idempotent: all statements use IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- ── New columns on customers ──────────────────────────────────────────────────

alter table public.customers
  add column if not exists city              text,
  add column if not exists country           text,
  add column if not exists country_code      text,          -- ISO-2 e.g. 'RO', 'US'
  add column if not exists phone             text,
  add column if not exists currency          text default 'USD',
  add column if not exists accepts_marketing boolean not null default false,
  add column if not exists tags              jsonb   not null default '[]',
  add column if not exists avg_order_value   bigint  not null default 0,  -- cents
  add column if not exists last_order_id     text,
  add column if not exists recent_orders     jsonb   not null default '[]';
  -- recent_orders shape (array, last 20 orders):
  -- [{ order_id, date, total_cents, currency, status,
  --    line_items: [{name, qty, price_cents, sku}],
  --    shipping_city, shipping_country }]

comment on column public.customers.city             is 'City from billing or shipping address';
comment on column public.customers.country          is 'Country name from billing address';
comment on column public.customers.country_code     is 'ISO-2 country code, e.g. RO, US';
comment on column public.customers.phone            is 'Phone number from platform profile';
comment on column public.customers.currency         is 'ISO-3 currency code for this customer';
comment on column public.customers.accepts_marketing is 'Whether the customer opted in to marketing emails';
comment on column public.customers.tags             is 'Array of tag strings, e.g. ["vip","wholesale"]';
comment on column public.customers.avg_order_value  is 'Average order value in cents';
comment on column public.customers.last_order_id    is 'Most recent platform order/charge ID';
comment on column public.customers.recent_orders    is 'JSON array of last 20 orders with line items';

-- ── Index on country_code for geo analytics ───────────────────────────────────

create index if not exists customers_user_country_idx
  on public.customers (user_id, country_code);

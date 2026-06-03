-- ─────────────────────────────────────────────────────────────────────────────
-- 035 · E-commerce Orders Table
-- Individual order records synced from all store platforms.
-- Used for order timeline, channel breakdown, fulfillment analytics.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.orders (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references public.users(id) on delete cascade,
  provider            text        not null,   -- 'shopify' | 'woocommerce' | 'amazon' | 'etsy' | 'bigcommerce'
  provider_order_id   text        not null,
  date                date        not null,
  status              text,       -- 'fulfilled' | 'pending' | 'refunded' | 'cancelled' | 'partial'
  channel             text,       -- 'online_store' | 'pos' | 'draft' | 'amazon' | 'ebay'
  gross_amount_cents  bigint      default 0,
  discount_cents      bigint      default 0,
  shipping_cents      bigint      default 0,
  tax_cents           bigint      default 0,
  net_amount_cents    bigint      default 0,
  refunded            boolean     default false,
  refund_amount_cents bigint      default 0,
  items_count         integer     default 1,
  customer_id         text,       -- provider customer id
  customer_email      text,
  is_new_customer     boolean     default true,
  country_code        text,
  currency            text        default 'USD',
  fulfilled_at        timestamptz,
  fulfillment_hours   numeric,    -- hours from order → fulfillment
  synced_at           timestamptz default now(),
  created_at          timestamptz default now(),
  unique (user_id, provider, provider_order_id)
);

alter table public.orders enable row level security;
create policy "Users see own orders" on public.orders
  for all using (auth.uid() = user_id);

create index if not exists orders_user_date
  on public.orders(user_id, date desc);

create index if not exists orders_user_provider_date
  on public.orders(user_id, provider, date desc);

create index if not exists orders_user_channel
  on public.orders(user_id, channel);

create index if not exists orders_customer
  on public.orders(user_id, customer_id);

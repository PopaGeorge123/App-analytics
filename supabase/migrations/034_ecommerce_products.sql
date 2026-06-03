-- ─────────────────────────────────────────────────────────────────────────────
-- 034 · E-commerce Products Table
-- Stores per-product performance data synced from Shopify, WooCommerce,
-- BigCommerce, Amazon Seller, Etsy, etc.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.products (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references public.users(id) on delete cascade,
  provider            text        not null,   -- 'shopify' | 'woocommerce' | 'bigcommerce' | 'amazon' | 'etsy'
  provider_product_id text        not null,
  name                text,
  sku                 text,
  category            text,
  price_cents         bigint      default 0,
  total_revenue_cents bigint      default 0,
  units_sold          integer     default 0,
  order_count         integer     default 0,
  refund_count        integer     default 0,
  refund_amount_cents bigint      default 0,
  in_stock            boolean     default true,
  stock_count         integer,
  image_url           text,
  product_url         text,
  tags                text[],
  currency            text        default 'USD',
  synced_at           timestamptz default now(),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (user_id, provider, provider_product_id)
);

alter table public.products enable row level security;
create policy "Users see own products" on public.products
  for all using (auth.uid() = user_id);

-- Index for fast dashboard queries
create index if not exists products_user_provider_revenue
  on public.products(user_id, provider, total_revenue_cents desc);

create index if not exists products_user_stock
  on public.products(user_id, in_stock, stock_count);

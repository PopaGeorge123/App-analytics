-- ─────────────────────────────────────────────────────────────────────────────
-- 037 · Inventory Snapshots Table
-- Daily stock-level snapshots per SKU. Powers inventory alerts and
-- "days of stock remaining" calculations.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.inventory_snapshots (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references public.users(id) on delete cascade,
  provider                text        not null,
  provider_product_id     text        not null,
  product_name            text,
  sku                     text,
  date                    date        not null,
  stock_quantity          integer     default 0,
  committed_quantity      integer     default 0,   -- in open orders
  available_quantity      integer     default 0,   -- stock - committed
  daily_sell_through_rate numeric(8,4) default 0,  -- units sold / opening stock
  days_of_stock_remaining integer,                  -- available / avg daily units sold
  reorder_point           integer,
  below_reorder_point     boolean     default false,
  out_of_stock            boolean     default false,
  synced_at               timestamptz default now(),
  created_at              timestamptz default now(),
  unique (user_id, provider, provider_product_id, date)
);

alter table public.inventory_snapshots enable row level security;
create policy "Users see own inventory" on public.inventory_snapshots
  for all using (auth.uid() = user_id);

create index if not exists inventory_user_date
  on public.inventory_snapshots(user_id, date desc);

create index if not exists inventory_low_stock
  on public.inventory_snapshots(user_id, below_reorder_point, days_of_stock_remaining);

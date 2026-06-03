-- ─────────────────────────────────────────────────────────────────────────────
-- 036 · Ad Campaigns Table
-- Per-campaign daily performance data from Meta, Google Ads, TikTok, Pinterest,
-- Snapchat. Enables blended ROAS and campaign-level drill-down.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ad_campaigns (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null references public.users(id) on delete cascade,
  provider              text        not null,   -- 'meta' | 'google-ads' | 'tiktok-ads' | 'pinterest-ads' | 'snapchat-ads'
  campaign_id           text        not null,
  campaign_name         text,
  date                  date        not null,
  status                text,       -- 'active' | 'paused' | 'archived'
  objective             text,       -- 'conversions' | 'traffic' | 'awareness' | 'shopping'
  spend_cents           bigint      default 0,
  impressions           bigint      default 0,
  clicks                bigint      default 0,
  conversions           integer     default 0,
  conversion_value_cents bigint     default 0,
  roas                  numeric(8,4) default 0,  -- conversion_value / spend
  cpc_cents             bigint      default 0,   -- cost per click
  cpm_cents             bigint      default 0,   -- cost per 1000 impressions
  ctr                   numeric(6,4) default 0,  -- click-through rate (0–1)
  cpa_cents             bigint      default 0,   -- cost per acquisition
  add_to_cart_count     integer     default 0,
  checkout_initiated    integer     default 0,
  currency              text        default 'USD',
  synced_at             timestamptz default now(),
  created_at            timestamptz default now(),
  unique (user_id, provider, campaign_id, date)
);

alter table public.ad_campaigns enable row level security;
create policy "Users see own campaigns" on public.ad_campaigns
  for all using (auth.uid() = user_id);

create index if not exists ad_campaigns_user_date
  on public.ad_campaigns(user_id, date desc);

create index if not exists ad_campaigns_user_provider_date
  on public.ad_campaigns(user_id, provider, date desc);

create index if not exists ad_campaigns_roas
  on public.ad_campaigns(user_id, roas desc);

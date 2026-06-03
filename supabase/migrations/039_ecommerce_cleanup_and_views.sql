-- ─────────────────────────────────────────────────────────────────────────────
-- 039 · Remove SaaS-only integration entries from integration waitlist
-- and mark non-e-commerce platforms as deprecated in any waitlist tables.
-- Also adds e-commerce specific columns to daily_snapshots for richer data.
-- ─────────────────────────────────────────────────────────────────────────────

-- Mark non-e-commerce platforms in the integration_waitlist as deprecated
-- (soft delete — keep historical data, just mark them)
alter table public.integration_waitlist
  add column if not exists deprecated boolean default false;

update public.integration_waitlist
  set deprecated = true
  where integration_id in (
    'salesforce', 'hubspot', 'pipedrive',   -- B2B CRM
    'intercom', 'zendesk', 'freshdesk',     -- SaaS support
    'amplitude', 'mixpanel', 'heap',        -- SaaS product analytics
    'fullstory', 'hotjar', 'segment',       -- SaaS session tools
    'beehiiv', 'convertkit',               -- Newsletter/creator
    'notion',                               -- Irrelevant
    'linkedin-ads',                         -- B2B ads
    'twitter-organic', 'youtube',           -- Low e-commerce signal
    'lemon-squeezy', 'gumroad', 'paddle'   -- Digital goods / SaaS billing
  );

-- Add blended metrics view for easy dashboard queries
-- This view aggregates daily_snapshots across all ad platforms for a user
create or replace view public.blended_ad_metrics as
select
  user_id,
  date,
  sum((data->>'spend')::numeric)           as total_spend,
  sum((data->>'clicks')::bigint)           as total_clicks,
  sum((data->>'impressions')::bigint)      as total_impressions,
  sum((data->>'conversions')::bigint)      as total_conversions,
  sum((data->>'purchaseValue')::numeric)   as total_purchase_value,
  case
    when sum((data->>'spend')::numeric) > 0
    then sum((data->>'purchaseValue')::numeric) / sum((data->>'spend')::numeric)
    else 0
  end as blended_roas
from public.daily_snapshots
where provider in ('meta', 'google-ads', 'tiktok-ads', 'pinterest-ads', 'snapchat-ads')
group by user_id, date;

-- Blended store revenue view (aggregates across all store platforms)
create or replace view public.blended_store_metrics as
select
  user_id,
  date,
  sum((data->>'grossRevenue')::bigint)     as total_gross_revenue,
  sum((data->>'netRevenue')::bigint)       as total_net_revenue,
  sum((data->>'orders')::integer)          as total_orders,
  sum((data->>'newCustomers')::integer)    as total_new_customers,
  sum((data->>'refunds')::bigint)          as total_refunds,
  case
    when sum((data->>'orders')::integer) > 0
    then sum((data->>'grossRevenue')::bigint) / sum((data->>'orders')::integer)
    else 0
  end as blended_aov
from public.daily_snapshots
where provider in ('shopify', 'woocommerce', 'bigcommerce', 'amazon', 'etsy', 'stripe', 'paypal')
group by user_id, date;

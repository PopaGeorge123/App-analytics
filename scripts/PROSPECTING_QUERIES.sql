-- Outbound Prospecting - Useful SQL Queries
-- Copy and paste these into Supabase SQL Editor to monitor your campaigns

-- ============================================================================
-- OVERVIEW & STATS
-- ============================================================================

-- Campaign performance summary
select 
  count(*) as total_prospects,
  count(case when email_sent_at is not null then 1 end) as emails_sent,
  count(case when email_opened_at is not null then 1 end) as emails_opened,
  count(case when email_clicked_at is not null then 1 end) as emails_clicked,
  count(case when status = 'converted' then 1 end) as converted,
  round(
    count(case when email_opened_at is not null then 1 end)::numeric / 
    nullif(count(case when email_sent_at is not null then 1 end), 0) * 100, 
    2
  ) as open_rate_pct,
  round(
    count(case when email_clicked_at is not null then 1 end)::numeric / 
    nullif(count(case when email_sent_at is not null then 1 end), 0) * 100, 
    2
  ) as click_rate_pct,
  round(
    count(case when status = 'converted' then 1 end)::numeric / 
    nullif(count(case when email_sent_at is not null then 1 end), 0) * 100, 
    2
  ) as conversion_rate_pct
from outbound_prospects;

-- ============================================================================
-- BY CATEGORY
-- ============================================================================

-- Performance by business category
select 
  category,
  count(*) as total_prospects,
  count(case when email_sent_at is not null then 1 end) as sent,
  count(case when email_opened_at is not null then 1 end) as opened,
  count(case when email_clicked_at is not null then 1 end) as clicked,
  round(
    count(case when email_opened_at is not null then 1 end)::numeric / 
    nullif(count(case when email_sent_at is not null then 1 end), 0) * 100, 
    2
  ) as open_rate
from outbound_prospects
group by category
order by sent desc;

-- ============================================================================
-- RECENT ACTIVITY
-- ============================================================================

-- Recent prospects (last 50)
select 
  business_name,
  domain,
  category,
  contact_email,
  status,
  email_sent_at,
  email_opened_at,
  email_open_count,
  created_at
from outbound_prospects
order by created_at desc
limit 50;

-- Recent email events (last 100)
select 
  p.business_name,
  p.domain,
  e.event_type,
  e.created_at,
  e.user_agent,
  e.ip_address
from outbound_email_events e
join outbound_prospects p on p.id = e.prospect_id
order by e.created_at desc
limit 100;

-- ============================================================================
-- HIGH-VALUE PROSPECTS
-- ============================================================================

-- Most engaged prospects (opened multiple times)
select 
  business_name,
  domain,
  category,
  contact_email,
  email_open_count,
  email_opened_at as first_opened,
  email_last_opened_at as last_opened,
  email_clicked_at,
  status
from outbound_prospects
where email_open_count > 1
order by email_open_count desc, email_last_opened_at desc
limit 50;

-- Clicked but not converted (warm leads)
select 
  business_name,
  domain,
  category,
  contact_email,
  detected_integrations,
  email_clicked_at,
  status
from outbound_prospects
where status = 'clicked'
order by email_clicked_at desc
limit 30;

-- ============================================================================
-- FOLLOW-UP LISTS
-- ============================================================================

-- Opened but didn't click (needs follow-up)
select 
  business_name,
  domain,
  category,
  contact_email,
  email_opened_at,
  email_open_count,
  detected_integrations
from outbound_prospects
where status = 'opened'
  and email_clicked_at is null
  and email_opened_at > now() - interval '7 days'
order by email_open_count desc, email_opened_at desc;

-- Sent but never opened (potential re-send with new subject)
select 
  business_name,
  domain,
  category,
  contact_email,
  email_sent_at,
  email_subject
from outbound_prospects
where email_sent_at is not null
  and email_opened_at is null
  and status != 'bounced'
  and status != 'unsubscribed'
  and email_sent_at < now() - interval '3 days'
order by email_sent_at desc
limit 50;

-- ============================================================================
-- QUALITY CHECKS
-- ============================================================================

-- Prospects with detected integrations (high-fit leads)
select 
  business_name,
  domain,
  category,
  contact_email,
  detected_integrations,
  status
from outbound_prospects
where jsonb_array_length(detected_integrations) > 0
  and status in ('scraped', 'email_sent', 'opened', 'clicked')
order by jsonb_array_length(detected_integrations) desc, created_at desc
limit 50;

-- Bounced or unsubscribed (clean your list)
select 
  business_name,
  domain,
  contact_email,
  status,
  email_sent_at
from outbound_prospects
where status in ('bounced', 'unsubscribed')
order by created_at desc;

-- ============================================================================
-- CONVERSIONS
-- ============================================================================

-- All conversions (successful outreach)
select 
  business_name,
  domain,
  category,
  contact_email,
  detected_integrations,
  email_sent_at,
  email_opened_at,
  email_clicked_at,
  notes
from outbound_prospects
where status = 'converted'
order by created_at desc;

-- ============================================================================
-- EXPORT LISTS
-- ============================================================================

-- Export all prospects with emails (for CRM import)
select 
  business_name,
  domain,
  category,
  contact_email,
  page_title,
  page_description,
  detected_integrations::text as integrations,
  status,
  created_at
from outbound_prospects
where contact_email is not null
order by created_at desc;

-- ============================================================================
-- CLEANUP & MAINTENANCE
-- ============================================================================

-- Delete test prospects (dry runs)
-- CAUTION: This deletes data permanently!
-- delete from outbound_prospects where domain like '%example.com%';

-- Reset prospect status (re-send email)
-- update outbound_prospects 
-- set status = 'scraped', email_sent_at = null 
-- where id = 'prospect-id-here';

-- Mark prospect as converted manually
-- update outbound_prospects 
-- set status = 'converted', notes = 'Signed up via outbound' 
-- where domain = 'example.com';

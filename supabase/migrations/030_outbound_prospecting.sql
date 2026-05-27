-- Outbound Prospecting System
-- Tracks scraped prospects and email engagement

-- Prospects table
create table if not exists public.outbound_prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  
  -- Business info
  category text not null, -- SaaS, E-commerce, etc.
  domain text not null unique,
  website_url text not null,
  business_name text,
  
  -- Contact info
  contact_email text,
  contact_name text,
  
  -- Scraping metadata
  scraped_at timestamptz not null default now(),
  detected_integrations jsonb default '[]'::jsonb,
  tech_stack jsonb default '[]'::jsonb,
  page_title text,
  page_description text,
  
  -- Email tracking
  email_sent_at timestamptz,
  email_subject text,
  email_preview text,
  email_opened_at timestamptz,
  email_open_count int default 0,
  email_last_opened_at timestamptz,
  email_clicked_at timestamptz,
  
  -- Status
  status text not null default 'scraped', -- scraped, email_sent, opened, clicked, replied, converted
  notes text,
  
  constraint valid_category check (category in ('SaaS', 'E-commerce', 'Agency', 'Media & Content', 'Marketplace', 'Consumer App', 'Fintech', 'Healthcare', 'Education', 'Other')),
  constraint valid_status check (status in ('scraped', 'email_sent', 'opened', 'clicked', 'replied', 'converted', 'bounced', 'unsubscribed'))
);

-- Indexes for efficient queries
create index if not exists outbound_prospects_category_idx on public.outbound_prospects (category);
create index if not exists outbound_prospects_status_idx on public.outbound_prospects (status);
create index if not exists outbound_prospects_domain_idx on public.outbound_prospects (domain);
create index if not exists outbound_prospects_email_sent_idx on public.outbound_prospects (email_sent_at) where email_sent_at is not null;
create index if not exists outbound_prospects_email_opened_idx on public.outbound_prospects (email_opened_at) where email_opened_at is not null;

-- RLS policies
alter table public.outbound_prospects enable row level security;

-- Only service role can access (admin-only table)
create policy "Service role full access" on public.outbound_prospects
  for all using (auth.role() = 'service_role');

-- Email open tracking events (for detailed analytics)
create table if not exists public.outbound_email_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  
  prospect_id uuid not null references public.outbound_prospects(id) on delete cascade,
  event_type text not null, -- open, click, bounce, unsubscribe
  user_agent text,
  ip_address text,
  metadata jsonb default '{}'::jsonb,
  
  constraint valid_event_type check (event_type in ('open', 'click', 'bounce', 'unsubscribe'))
);

create index if not exists outbound_email_events_prospect_idx on public.outbound_email_events (prospect_id);
create index if not exists outbound_email_events_type_idx on public.outbound_email_events (event_type);

alter table public.outbound_email_events enable row level security;

create policy "Service role full access" on public.outbound_email_events
  for all using (auth.role() = 'service_role');

-- Function to update prospect status on email events
create or replace function handle_email_event()
returns trigger as $$
begin
  if NEW.event_type = 'open' then
    update public.outbound_prospects
    set 
      email_opened_at = coalesce(email_opened_at, NEW.created_at),
      email_last_opened_at = NEW.created_at,
      email_open_count = email_open_count + 1,
      status = case when status = 'email_sent' then 'opened' else status end
    where id = NEW.prospect_id;
  elsif NEW.event_type = 'click' then
    update public.outbound_prospects
    set 
      email_clicked_at = coalesce(email_clicked_at, NEW.created_at),
      status = case when status in ('email_sent', 'opened') then 'clicked' else status end
    where id = NEW.prospect_id;
  elsif NEW.event_type = 'bounce' then
    update public.outbound_prospects
    set status = 'bounced'
    where id = NEW.prospect_id;
  elsif NEW.event_type = 'unsubscribe' then
    update public.outbound_prospects
    set status = 'unsubscribed'
    where id = NEW.prospect_id;
  end if;
  
  return NEW;
end;
$$ language plpgsql security definer;

-- Trigger to auto-update prospect status
create trigger on_email_event
  after insert on public.outbound_email_events
  for each row execute function handle_email_event();

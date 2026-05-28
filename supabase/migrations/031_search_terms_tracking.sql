-- AI-Generated Search Terms Tracking
-- Stores search terms, their performance, and learns which terms are most effective

-- Search terms table with performance metrics
create table if not exists public.outbound_search_terms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  
  -- Search term details
  category text not null,
  search_term text not null,
  generation_batch int not null, -- Which batch of AI generation (1, 2, 3, etc.)
  
  -- Performance metrics
  times_searched int default 0,
  total_results int default 0,
  unique_prospects_found int default 0, -- New prospects added from this term
  duplicate_count int default 0, -- How many duplicates encountered
  
  -- Efficiency score (0-100)
  -- Formula: (unique_prospects_found / total_results) * 100
  -- Updated after each search
  efficiency_score decimal(5,2) default 0.00,
  
  -- Email conversion metrics
  emails_found int default 0, -- Prospects with email
  emails_sent int default 0,
  emails_opened int default 0,
  emails_clicked int default 0,
  
  -- Email efficiency score (0-100)
  email_efficiency_score decimal(5,2) default 0.00,
  
  -- Last used
  last_searched_at timestamptz,
  
  -- AI generation context (for learning)
  ai_prompt text,
  ai_reasoning text, -- Why AI generated this term
  
  constraint valid_category check (category in ('SaaS', 'E-commerce', 'Agency', 'Media & Content', 'Marketplace', 'Consumer App', 'Fintech', 'Healthcare', 'Education', 'Other'))
);

-- Unique constraint: same search term can't be used twice in same category
create unique index outbound_search_terms_unique on public.outbound_search_terms (category, search_term);

-- Indexes for efficient queries
create index outbound_search_terms_category_idx on public.outbound_search_terms (category);
create index outbound_search_terms_efficiency_idx on public.outbound_search_terms (efficiency_score desc);
create index outbound_search_terms_email_efficiency_idx on public.outbound_search_terms (email_efficiency_score desc);
create index outbound_search_terms_batch_idx on public.outbound_search_terms (generation_batch);

-- Link prospects to search terms (many-to-many)
create table if not exists public.outbound_prospect_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  
  prospect_id uuid not null references public.outbound_prospects(id) on delete cascade,
  search_term_id uuid not null references public.outbound_search_terms(id) on delete cascade,
  
  -- Was this prospect new when found by this search term?
  was_new_prospect boolean default true,
  
  constraint unique_prospect_source unique (prospect_id, search_term_id)
);

create index outbound_prospect_sources_prospect_idx on public.outbound_prospect_sources (prospect_id);
create index outbound_prospect_sources_term_idx on public.outbound_prospect_sources (search_term_id);

-- RLS policies
alter table public.outbound_search_terms enable row level security;
alter table public.outbound_prospect_sources enable row level security;

create policy "Service role full access" on public.outbound_search_terms
  for all using (auth.role() = 'service_role');

create policy "Service role full access" on public.outbound_prospect_sources
  for all using (auth.role() = 'service_role');

-- Function to update search term efficiency after each search
create or replace function update_search_term_efficiency()
returns trigger as $$
begin
  -- Recalculate efficiency scores
  update public.outbound_search_terms
  set 
    efficiency_score = case 
      when total_results > 0 then (unique_prospects_found::decimal / total_results::decimal) * 100
      else 0
    end,
    email_efficiency_score = case
      when unique_prospects_found > 0 then (emails_found::decimal / unique_prospects_found::decimal) * 100
      else 0
    end
  where id = NEW.search_term_id;
  
  return NEW;
end;
$$ language plpgsql;

-- Trigger to update efficiency when new prospect is linked to search term
create trigger update_efficiency_on_prospect_link
  after insert on public.outbound_prospect_sources
  for each row
  execute function update_search_term_efficiency();

-- View for search term performance analysis
create or replace view public.outbound_search_performance as
select 
  st.category,
  st.search_term,
  st.generation_batch,
  st.times_searched,
  st.total_results,
  st.unique_prospects_found,
  st.duplicate_count,
  st.efficiency_score,
  st.emails_found,
  st.email_efficiency_score,
  st.last_searched_at,
  st.created_at,
  -- Composite score (combines prospect finding + email discovery)
  (st.efficiency_score * 0.6 + st.email_efficiency_score * 0.4) as composite_score
from public.outbound_search_terms st
order by composite_score desc;

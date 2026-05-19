-- ============================================================
-- Preview Scans — stores AI-generated dashboard previews
-- Keyed by normalized domain so the same site always returns
-- the cached result. IP tracking limits 1 new analysis per IP.
-- ============================================================

create table if not exists public.preview_scans (
  id                    uuid primary key default gen_random_uuid(),
  domain                text not null unique,          -- normalized: no www, lowercase
  site_url              text not null,
  site_title            text not null default '',
  site_description      text not null default '',
  site_favicon          text not null default '',
  detected_integrations jsonb not null default '[]',
  predictions           jsonb not null default '{}',
  created_at            timestamptz not null default now()
);

-- Index so domain lookups are fast
create index if not exists preview_scans_domain_idx on public.preview_scans (domain);

-- Track which IPs have already consumed their one free analysis
create table if not exists public.preview_ip_log (
  ip_hash     text primary key,
  scan_domain text not null,
  created_at  timestamptz not null default now()
);

-- No RLS needed — accessed only via service role from API routes

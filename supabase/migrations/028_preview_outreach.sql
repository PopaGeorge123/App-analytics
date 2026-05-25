-- ============================================================
-- Preview Outreach — enables 4-hour delayed cold email
-- after a visitor uses the free website analysis.
-- ============================================================

alter table public.preview_scans
  add column if not exists outreach_email        text,          -- best email found on the site
  add column if not exists outreach_scheduled_at timestamptz,   -- when to send (created_at + 4h)
  add column if not exists outreach_sent_at      timestamptz;   -- set once email is dispatched

-- Fast lookup for the daemon's outreach sweep
create index if not exists preview_scans_outreach_idx
  on public.preview_scans (outreach_scheduled_at)
  where outreach_sent_at is null and outreach_email is not null;

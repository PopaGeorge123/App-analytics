-- ============================================================
-- Preview Scans — stores AI-generated dashboard previews
-- Keyed by normalized domain so the same site always returns
-- the cached result. IP tracking limits 1 new analysis per IP.
-- ============================================================

create table if not exists public.reactflow_nodes (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  position_x              numeric default 0,
  position_y              numeric default 0,
  node_type               text not null,  -- 'integration' | 'metric' | 'insight' | 'fold'
  data                    jsonb not null default '{}',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique (user_id, id)
);

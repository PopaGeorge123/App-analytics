-- ============================================================
-- Preview Scans — stores AI-generated dashboard previews
-- Keyed by normalized domain so the same site always returns
-- the cached result. IP tracking limits 1 new analysis per IP.
-- ============================================================

create table if not exists public.reactflow_edges (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  source_node_id        uuid not null references public.reactflow_nodes(id) on delete cascade,
  target_node_id        uuid not null references public.reactflow_nodes(id) on delete cascade,
  edge_type             text not null,  -- 'default' | 'dashed' |
  data                  jsonb not null default '{}',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  unique (user_id, id)
);

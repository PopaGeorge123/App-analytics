-- ── AI Conversations ─────────────────────────────────────────────────────
-- Each conversation is a named chat thread per user
create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'New Chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ai_conversations_user on public.ai_conversations(user_id, updated_at desc);

alter table public.ai_conversations enable row level security;

create policy "Users manage own conversations"
  on public.ai_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Add conversation_id to ai_messages ───────────────────────────────────
alter table public.ai_messages
  add column if not exists conversation_id uuid references public.ai_conversations(id) on delete cascade;

create index if not exists ai_messages_conversation on public.ai_messages(conversation_id, created_at asc);

-- ── Function: auto-update conversation updated_at on new message ──────────
create or replace function public.touch_conversation()
returns trigger language plpgsql as $$
begin
  if new.conversation_id is not null then
    update public.ai_conversations
    set updated_at = now()
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ai_messages_touch_conversation on public.ai_messages;
create trigger ai_messages_touch_conversation
  after insert on public.ai_messages
  for each row execute function public.touch_conversation();

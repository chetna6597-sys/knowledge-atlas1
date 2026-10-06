-- KNOWLEDGE ATLAS BACKEND
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  category text not null default 'Unsorted',
  status text not null default 'curious'
    check (status in ('curious','exploring','familiar','strong','deep')),
  confidence integer not null default 1
    check (confidence between 1 and 5),
  parent_id uuid references knowledge_nodes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references knowledge_nodes(id) on delete cascade,
  target_id uuid not null references knowledge_nodes(id) on delete cascade,
  relationship text not null default 'related',
  strength integer not null default 1 check (strength between 1 and 5),
  created_at timestamptz not null default now(),
  unique(user_id, source_id, target_id, relationship)
);

create table if not exists knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references knowledge_nodes(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists knowledge_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references knowledge_nodes(id) on delete cascade,
  title text not null,
  url text,
  resource_type text default 'other',
  created_at timestamptz not null default now()
);

create table if not exists knowledge_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid references knowledge_nodes(id) on delete cascade,
  question text not null,
  status text default 'open'
    check (status in ('open','explored','resolved')),
  created_at timestamptz not null default now()
);

create table if not exists learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid references knowledge_nodes(id) on delete set null,
  minutes integer not null default 0,
  reflection text default '',
  happened_at timestamptz not null default now()
);

create table if not exists exploration_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_node_id uuid references knowledge_nodes(id) on delete cascade,
  suggested_topic text not null,
  reason text not null,
  status text default 'new'
    check (status in ('new','saved','dismissed','explored')),
  created_at timestamptz not null default now()
);

alter table knowledge_nodes enable row level security;
alter table knowledge_edges enable row level security;
alter table knowledge_notes enable row level security;
alter table knowledge_resources enable row level security;
alter table knowledge_questions enable row level security;
alter table learning_sessions enable row level security;
alter table exploration_suggestions enable row level security;

create policy "own nodes"
on knowledge_nodes for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "own edges"
on knowledge_edges for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "own notes"
on knowledge_notes for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "own resources"
on knowledge_resources for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "own questions"
on knowledge_questions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "own sessions"
on learning_sessions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "own suggestions"
on exploration_suggestions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knowledge_nodes_updated on knowledge_nodes;

create trigger knowledge_nodes_updated
before update on knowledge_nodes
for each row execute procedure touch_updated_at();

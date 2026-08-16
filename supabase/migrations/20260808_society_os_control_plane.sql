create extension if not exists pgcrypto;

create table if not exists public.society_os_audit (
  id uuid primary key default gen_random_uuid(),
  command_id text not null,
  actor_id text not null,
  actor_email text not null,
  actor_role text not null check (actor_role in ('founder','admin','operator','viewer')),
  command_hash text not null,
  command_preview text not null,
  intents text[] not null default '{}',
  risk text not null check (risk in ('low','medium','high','critical')),
  decision text not null,
  verified boolean not null default false,
  execution_summary jsonb,
  created_at timestamptz not null default now()
);

create index if not exists society_os_audit_created_at_idx on public.society_os_audit (created_at desc);
create index if not exists society_os_audit_actor_idx on public.society_os_audit (actor_id, created_at desc);
create index if not exists society_os_audit_command_idx on public.society_os_audit (command_id);

alter table public.society_os_audit enable row level security;
revoke all on table public.society_os_audit from anon, authenticated;

create table if not exists public.society_os_memory (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  memory_key text not null,
  memory_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create unique index if not exists society_os_memory_actor_key_idx on public.society_os_memory (actor_id, memory_key);
create index if not exists society_os_memory_created_at_idx on public.society_os_memory (created_at desc);

alter table public.society_os_memory enable row level security;
revoke all on table public.society_os_memory from anon, authenticated;

comment on table public.society_os_audit is 'Server-written, append-oriented audit evidence for StreamVista Society OS commands.';
comment on table public.society_os_memory is 'Server-written persistent execution memory. Never store credentials or raw secrets.';

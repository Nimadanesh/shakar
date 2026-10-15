-- m26: private human-evaluation platform tables (Phase 2 MVP).
-- Service-role access only (same posture as the other private tables);
-- no RLS policies for anonymous access. Nothing here is referenced by
-- application code yet: the MVP runs on the file-backed store and this
-- schema documents the production path (see src/lib/server/eval/store.ts).

create table if not exists eval_missions (
  id text primary key,
  version integer not null default 1,
  enabled boolean not null default true,
  query text not null,
  task_fa text not null default '',
  max_items integer not null default 12,
  result_set_id text,
  live_allowed boolean not null default false
);

create table if not exists eval_invitations (
  id text primary key, -- sha256 of the opaque code (code never stored)
  cohort text not null default 'default',
  mission_ids jsonb not null default '[]',
  mission_set_version integer not null default 1,
  max_uses integer not null default 50,
  uses integer not null default 0,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists eval_sessions (
  id text primary key,
  participant_id text not null, -- anonymous random id, no PII
  invitation_id text not null references eval_invitations (id),
  cohort text not null default 'default',
  mission_ids jsonb not null default '[]',
  mission_set_version integer not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists eval_runs (
  id text primary key,
  session_id text not null references eval_sessions (id),
  mission_id text not null,
  mission_set_version integer not null default 1,
  engine_build_id text not null default '',
  mode text not null default 'replay',
  result_set_id text,
  listing_order jsonb not null default '[]',
  started_at timestamptz not null default now()
);

create table if not exists eval_responses (
  session_id text not null,
  mission_id text not null,
  mission_set_version integer not null default 1,
  run_id text not null,
  items jsonb not null default '[]',
  outcome jsonb not null default '{}',
  status text not null default 'draft',
  submitted_at timestamptz,
  revisions jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, mission_id)
);

create table if not exists eval_result_sets (
  id text primary key,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  query text not null,
  records jsonb not null default '[]'
);

create index if not exists eval_runs_session_idx on eval_runs (session_id);
create index if not exists eval_responses_status_idx on eval_responses (status);

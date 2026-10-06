-- M10: persistent hunt runs (finding #9, bug-bounty 2026-10-06).
-- hunt_runs / hunt_idem_keys / hunt_run_events replace the in-memory Maps
-- in runs.ts so idempotency and SSE survive Railway restarts/redeploys and
-- work across instances. The app falls back to the in-memory backend (with
-- a loud warning) until this migration is applied.
-- Idempotent: safe to re-run. Run once in Supabase SQL Editor.

create table if not exists hunt_runs (
  id uuid primary key,
  owner_user_id uuid,
  owner_device_id uuid,
  definition jsonb not null,
  -- Quota receipt: kind/mode/userId/deviceId/charged (+ kamin link below).
  quota jsonb not null default '{}'::jsonb,
  kamin_id text,
  -- created → running → done|failed. Claimed/finalized with conditional
  -- UPDATEs (WHERE status = ...) so exactly one instance wins each step.
  status text not null default 'created',
  -- Cursor where the list walk stopped (deepen resumes from here) and the
  -- cursor a deep-history run starts from.
  start_cursor jsonb,
  end_cursor jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Client-generated idempotency keys («شکار کن» tap). PK = the atomic
-- claim: INSERT wins for exactly one request; losers poll for the winner.
create table if not exists hunt_idem_keys (
  key text primary key,
  run_id uuid not null,
  at timestamptz not null default now()
);

-- The replay source for SSE: every emitted HuntEvent, in id order.
create table if not exists hunt_run_events (
  id bigserial primary key,
  run_id uuid not null references hunt_runs(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists hunt_run_events_run_idx on hunt_run_events (run_id, id);

-- M4b quota engine + guest hunts (blueprint §2, §9; docs/output-quality.md)
-- Idempotent: safe to re-run. Run once in Supabase SQL Editor.
-- After this, POST /api/hunts enforces real quotas; before it, the API
-- runs in permissive-dev mode (logged, never silent).

-- Per-cycle hunt quota counters (blueprint §2).
create table if not exists quota_counters (
  -- user_id matches profiles.id (uuid). Live DBs created before 2026-10-06
  -- may have text here; the m6 RPCs expect uuid.
  user_id uuid primary key,
  cycle_start timestamptz not null default now(),
  hunts_used integer not null default 0,
  gifts_used integer not null default 0,
  refunds_today integer not null default 0,
  refund_day date not null default current_date,
  warnings integer not null default 0,
  suspended_until timestamptz,
  notified_85 boolean not null default false
);

-- Guest devices. LIVE SCHEMA (2026-10-06, verified against production):
-- the device id (client UUID) is the PK; fingerprint_hash is reserved for
-- future device-fingerprint abuse detection (NOT NULL, no default — every
-- insert must provide it); free_hunts_granted is the per-device limit
-- (default 3, the product policy); zero_refunds_today/refund_day are the
-- guest-side refund ladder (not yet wired in the app).
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  fingerprint_hash text not null,
  free_hunts_granted integer not null default 3,
  free_hunts_used integer not null default 0,
  zero_refunds_today integer not null default 0,
  refund_day date,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- User notifications (quota 85%, kamin hits, ...). Surfaced in the header bell.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  seen boolean not null default false
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

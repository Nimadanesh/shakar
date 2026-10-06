-- M4b quota engine + guest hunts (blueprint §2, §9; docs/output-quality.md)
-- Idempotent: safe to re-run. Run once in Supabase SQL Editor.
-- After this, POST /api/hunts enforces real quotas; before it, the API
-- runs in permissive-dev mode (logged, never silent).

-- Per-cycle hunt quota counters (blueprint §2).
create table if not exists quota_counters (
  user_id text primary key,
  cycle_start timestamptz not null default now(),
  hunts_used integer not null default 0,
  gifts_used integer not null default 0,
  refunds_today integer not null default 0,
  refund_day date not null default current_date,
  warnings integer not null default 0,
  suspended_until timestamptz,
  notified_85 boolean not null default false
);

-- Guest devices: 3 complimentary hunts per device, ever (blueprint §9).
create table if not exists devices (
  device_id text primary key,
  free_hunts_used integer not null default 0,
  first_seen timestamptz not null default now(),
  last_ip text
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

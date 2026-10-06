-- M5 kamin engine + Web Push (blueprint §1.8, §1.9; docs/output-quality.md flaw #6)
-- Idempotent: safe to re-run. Run once in Supabase SQL Editor.
--
-- After this, the server owns kamins: POST /api/kamins arms one (one slot),
-- POST /api/internal/kamins/tick runs every due kamin on its tier cadence,
-- and genuinely-new matches land in `notifications` + Web Push.
-- Before this runs, the kamin APIs answer 503 (permissive-dev, logged).

-- Server-side kamins (blueprint §1.8). Replaces the local-only kamin store.
create table if not exists kamins (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  definition jsonb not null,
  canonical_key text not null,
  status text not null default 'active' check (status in ('active', 'sleeping')),
  cadence text not null default 'daily',
  seen_ids text[] not null default '{}',
  last_checked_at timestamptz,
  -- since-LAST-SUCCESS window (output-quality.md flaw #6): only moves on a
  -- successful check, so a cooldown gap is caught up, never skipped.
  last_success_at timestamptz,
  new_match_count integer not null default 0,
  armed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, canonical_key)
);
create index if not exists kamins_user_status_idx on kamins (user_id, status);

-- One row per engine check: the dedupe anchor for notifications
-- (blueprint §1.9 — one push per genuinely new match set).
create table if not exists kamin_runs (
  id uuid primary key default gen_random_uuid(),
  kamin_id uuid not null references kamins (id) on delete cascade,
  user_id text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'baseline')),
  window_from timestamptz,
  window_to timestamptz,
  pages_fetched integer not null default 0,
  candidates integer not null default 0,
  new_count integer not null default 0,
  error text
);
create index if not exists kamin_runs_kamin_idx on kamin_runs (kamin_id, started_at desc);

-- Web Push subscriptions (blueprint §1.9). One row per device endpoint.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- Notification links (blueprint §1.9). Additive to the M4b table.
alter table notifications add column if not exists related_kamin_id uuid;
alter table notifications add column if not exists related_hunt_id uuid;
alter table notifications add column if not exists check_run_id uuid;
create index if not exists notifications_kamin_run_idx
  on notifications (related_kamin_id, check_run_id);

-- RLS: auth is our own JWT (not Supabase Auth), so every read/write goes
-- through the service_role server client. Enable RLS with no public
-- policies = fail-closed for any other key.
alter table kamins enable row level security;
alter table kamin_runs enable row level security;
alter table push_subscriptions enable row level security;

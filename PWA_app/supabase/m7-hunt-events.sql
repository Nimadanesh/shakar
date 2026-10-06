-- M7: cross-device profile (2026-10-06).
-- The profile must be identical on every device — localStorage can't do
-- that. Two additions:
--   1. hunt_events: one row per fired hunt → the 14-day chart.
--      Written by POST /api/hunts (best-effort; quota is the truth).
--   2. profiles.display_name: the logged-in user's display name.
--      Guests keep a device-local name (no account to attach it to).
-- Idempotent: safe to re-run. Run once in Supabase SQL Editor.
create table if not exists hunt_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  device_id uuid,
  query text not null default '',
  fired_at timestamptz not null default now()
);
create index if not exists hunt_events_user_day_idx on hunt_events (user_id, fired_at desc);
create index if not exists hunt_events_device_day_idx on hunt_events (device_id, fired_at desc);

alter table profiles add column if not exists display_name text;

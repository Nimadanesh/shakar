-- M22: RLS lockdown for the quota tables (quality audit 2026-10-08).
--
-- Finding: m4b (quota_counters, devices, notifications) and m14
-- (guest_ip_hits) never enabled RLS. The publishable (anon) key ships
-- in the client, so without RLS anyone could hit PostgREST directly and
-- reset their own hunts_used, mint free device hunts, or read other
-- users' notifications — bypassing every atomic RPC guard.
--
-- Convention (same as m20/m21/m5/m9): RLS enabled with NO policies.
-- service_role bypasses RLS, and the app talks to these tables with
-- the service_role key only (src/lib/supabase-server.ts) — so this
-- changes nothing for the API and closes the anon path completely.
--
-- Idempotent: safe to re-run. navid runs this manually in the
-- Supabase SQL Editor (service_role).

alter table quota_counters enable row level security;
alter table devices enable row level security;
alter table notifications enable row level security;
alter table guest_ip_hits enable row level security;

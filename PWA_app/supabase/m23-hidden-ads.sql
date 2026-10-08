-- M23: hidden ads sync (profile sync completion, navid 2026-10-08).
--
-- Hidden listings are user data: hiding on one device must hide on every
-- device. Mirrors the favorites pattern (m21): a per-user set of ad
-- tokens, upserted idempotently, deleted ownership-checked.
--
-- Idempotent: safe to re-run. navid runs this manually in the
-- Supabase SQL Editor (service_role).

create table if not exists hidden_ads (
  id uuid primary key default gen_random_uuid(),
  -- matches profiles.id (uuid), same convention as favorites —
  -- no FK so this migration never blocks on auth table names.
  user_id uuid not null,
  ad_token text not null,
  created_at timestamptz not null default now(),
  unique (user_id, ad_token)
);
create index if not exists hidden_ads_user_idx
  on hidden_ads (user_id, created_at desc);

-- The app talks to this table with the service_role key only
-- (server-only sb.rest), same convention as the other M-tables.
alter table hidden_ads enable row level security;

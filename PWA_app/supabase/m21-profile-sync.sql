-- M21: profile sync tables — favorites + saved hunts (navid 2026-10-08).
--
-- The profile is the PHONE NUMBER (profiles.mobile, ensureProfileId).
-- Everything the user does is recorded against their profile so any device
-- they log into shows the full history. Hunt history needs no new table —
-- hunt_runs.owner_user_id already records it.
--
-- Idempotent: safe to re-run. Run once in Supabase SQL Editor.

create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- Divar ad token (sourceAdId). Unique per user — re-favoriting is a no-op.
  ad_token text not null,
  -- Snapshot at favorite time (the ad may later be deleted from Divar).
  title text not null default '',
  city text,
  created_at timestamptz not null default now(),
  unique (user_id, ad_token)
);

create index if not exists favorites_user_id_created_idx
  on favorites (user_id, created_at desc);

create table if not exists saved_hunts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  -- Human label (defaults to the query).
  name text not null,
  -- The full hunt definition (query, include/exclude, city, category,
  -- price, transaction, condition) as JSON.
  definition jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_hunts_user_id_created_idx
  on saved_hunts (user_id, created_at desc);

-- RLS: the app uses the service_role key server-side; enable RLS with a
-- permissive policy so direct client access (if ever added) is scoped.
alter table favorites enable row level security;
alter table saved_hunts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'favorites' and policyname = 'service_role_all'
  ) then
    create policy service_role_all on favorites for all to service_role using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'saved_hunts' and policyname = 'service_role_all'
  ) then
    create policy service_role_all on saved_hunts for all to service_role using (true) with check (true);
  end if;
end $$;

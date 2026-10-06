-- M9: atomic kamin arming + unbounded seen baseline (findings #7, #8,
-- bug-bounty round 2, 2026-10-06).
--
-- #7: armKamin() was GET-count → POST (racy: two concurrent arms on a
-- 1-slot tier both saw 0 active and both inserted — subscription
-- enforcement bypass). try_arm_kamin() does the slot check + insert in
-- ONE transaction, serialized per user with an advisory lock (there is
-- no single counter row to SELECT ... FOR UPDATE here, unlike the m6
-- quota counters).
--
-- #8: kamins.seen_ids was a text[] capped at 500 ids (capIds) — a
-- long-lived kamin forgot its oldest ads, which then resurfaced as
-- "new" matches (re-confirmed, re-notified: false new listings). The
-- baseline is now the kamin_seen_ads table: unbounded, one row per
-- (kamin, ad). The old column is backfilled into the table, then dropped.
--
-- Idempotent: safe to re-run. Run once in Supabase SQL Editor; the API
-- uses the atomic path automatically (falls back to the legacy path
-- with a loud warning if the functions are missing).
--
-- NOTE on types: kamins.user_id is TEXT (m5), so p_user_id is text —
-- unlike m6's uuid params (quota_counters.user_id is uuid).

-- Unbounded seen baseline: one row per (kamin, ad). The PRIMARY KEY on
-- (kamin_id, source_ad_id) already serves kamin_id lookups — no extra
-- index needed.
create table if not exists kamin_seen_ads (
  kamin_id uuid not null references kamins (id) on delete cascade,
  source_ad_id text not null,
  seen_at timestamptz not null default now(),
  primary key (kamin_id, source_ad_id)
);

-- Backfill from the old capped arrays BEFORE dropping the column.
-- Guarded: on a re-run the column is already gone, and referencing a
-- missing column would abort the whole migration (not idempotent).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kamins'
      and column_name = 'seen_ids'
  ) then
    insert into kamin_seen_ads (kamin_id, source_ad_id)
    select kamins.id, unnest(kamins.seen_ids)
    from kamins
    where cardinality(kamins.seen_ids) > 0
    on conflict do nothing;
  end if;
end
$$;

-- The capped array is gone; the table is the baseline now.
alter table kamins drop column if exists seen_ids;

-- Atomic arm: slot check + insert (or slot-checked wake of a sleeping
-- kamin with the same canonical key) in one transaction.
-- Returns one row (kamin_id, created) — or ZERO ROWS when the tier's
-- slots are full (a denied wake counts as full: waking consumes a slot).
create or replace function try_arm_kamin(
  p_user_id text,
  p_name text,
  p_definition jsonb,
  p_canonical_key text,
  p_status text,
  p_cadence text,
  p_slots integer,
  p_seen_ids text[]
)
returns table (kamin_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
  v_active_count integer;
begin
  -- Serialize arming per user: the slot check and the insert must see
  -- each other, otherwise two concurrent arms both pass the check.
  -- Concurrent arms for DIFFERENT users never block each other.
  perform pg_advisory_xact_lock(hashtext(p_user_id));

  -- Canonical dedupe (also a DB unique constraint): the residual race
  -- where two arms passed the app-level check together lands here.
  select k.id, k.status into v_id, v_status
  from kamins k
  where k.user_id = p_user_id
    and k.canonical_key = p_canonical_key;

  if v_id is not null then
    if v_status = 'active' then
      return query select v_id, false;
      return;
    end if;
    -- Re-arming a sleeping kamin wakes it — but waking consumes a slot,
    -- so the slot check applies here too (finding #7, wake variant).
    select count(*) into v_active_count
    from kamins c
    where c.user_id = p_user_id
      and c.status = 'active';
    if v_active_count >= p_slots then
      return; -- zero rows: slots full, wake denied
    end if;
    update kamins
    set status = 'active',
        name = p_name,
        definition = p_definition
    where kamins.id = v_id;
    return query select v_id, false;
    return;
  end if;

  -- Fresh arm. Sleeping kamins (no subscription — guest funnel) never
  -- consume a slot.
  if p_status = 'active' then
    select count(*) into v_active_count
    from kamins c
    where c.user_id = p_user_id
      and c.status = 'active';
    if v_active_count >= p_slots then
      return; -- zero rows: slots full
    end if;
  end if;

  insert into kamins (user_id, name, definition, canonical_key, status, cadence)
  values (p_user_id, p_name, p_definition, p_canonical_key, p_status, p_cadence)
  on conflict (user_id, canonical_key) do nothing
  returning kamins.id into v_id;

  if v_id is null then
    -- Lost the insert race under the lock: the winner committed first,
    -- so its row is the dedupe answer. (A concurrent DELETE between the
    -- conflict and this select is the only way v_id stays null — then we
    -- deny rather than over-arm.)
    select k.id into v_id
    from kamins k
    where k.user_id = p_user_id
      and k.canonical_key = p_canonical_key;
    if v_id is not null then
      return query select v_id, false;
    end if;
    return;
  end if;

  -- Seed the seen baseline. Unbounded by design — this table IS the fix
  -- for the 500-id cap (finding #8).
  if p_seen_ids is not null and cardinality(p_seen_ids) > 0 then
    insert into kamin_seen_ads (kamin_id, source_ad_id)
    select v_id, unnest(p_seen_ids)
    on conflict do nothing;
  end if;

  return query select v_id, true;
end;
$$;

-- Race-free baseline write: single statement, duplicates ignored.
create or replace function kamin_mark_seen(p_kamin_id uuid, p_source_ad_ids text[])
returns void
language sql
security definer
set search_path = public
as $$
  insert into kamin_seen_ads (kamin_id, source_ad_id)
  select p_kamin_id, unnest(p_source_ad_ids)
  on conflict do nothing;
$$;

-- RLS: same pattern as m5 — our own JWT auth, service_role only.
alter table kamin_seen_ads enable row level security;

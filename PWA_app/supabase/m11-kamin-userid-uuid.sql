-- M11: try_arm_kamin's user_id must be UUID, not text.
--
-- The live test (2026-10-06, real concurrent requests against prod)
-- caught it: prod kamins.user_id is UUID, but m9 declared
-- p_user_id text — every RPC arm 404'd with
-- "operator does not exist: uuid = text". The m9 NOTE claiming
-- "kamins.user_id is TEXT (m5)" was written from the repo file;
-- production was created with uuid. PGlite built the schema from the
-- repo files, so it passed there — exactly the drift the live-test
-- rule exists to catch.
--
-- Fix: drop the text-signature function, recreate with p_user_id uuid.
-- The app always passes session userIds (uuid strings); PostgREST
-- casts them. The advisory lock hashes the text form explicitly.
--
-- Idempotent: safe to re-run.

drop function if exists try_arm_kamin(text, text, jsonb, text, text, text, integer, text[]);

create or replace function try_arm_kamin(
  p_user_id uuid,
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
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

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

-- M6: atomic quota consume/refund (finding #5, bug-bounty 2026-10-06).
-- Replaces read-check-PATCH (racy: two concurrent requests could both pass
-- the check and consume one unit) with single-statement check-and-increment.
-- Idempotent: safe to re-run. Run once in Supabase SQL Editor, then the
-- API uses the atomic path automatically (falls back to the legacy path
-- with a loud warning if the functions are missing).

-- Standard (subscribed) quota: suspension + limit check + increment, atomically.
create or replace function consume_hunt_unit(p_user_id uuid, p_limit int)
returns table (allowed boolean, reason text, hunts_used int, notified_85 boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
  v_notified boolean;
begin
  insert into quota_counters (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select qc.hunts_used, qc.notified_85
    into v_used, v_notified
  from quota_counters qc
  where qc.user_id = p_user_id
  for update;

  if exists (
    select 1 from quota_counters
    where user_id = p_user_id and suspended_until > now()
  ) then
    return query select false, 'suspended'::text, v_used, v_notified;
    return;
  end if;

  if v_used >= p_limit then
    return query select false, 'no-quota'::text, v_used, v_notified;
    return;
  end if;

  update quota_counters
  set hunts_used = quota_counters.hunts_used + 1
  where quota_counters.user_id = p_user_id
  returning quota_counters.hunts_used into v_used;

  return query select true, 'ok'::text, v_used, v_notified;
end;
$$;

-- Guest device quota: limit check + increment, atomically.
-- Live devices schema (2026-10-06): id uuid PK, fingerprint_hash text
-- NOT NULL (no default), free_hunts_granted int DEFAULT 3,
-- free_hunts_used int DEFAULT 0, zero_refunds_today/refund_day (guest
-- refund ladder — not yet wired; the plain decrement below preserves
-- current app behavior), first_seen/last_seen DEFAULT now().
create or replace function consume_guest_hunt(p_device_id uuid, p_limit int)
returns table (allowed boolean, reason text, free_hunts_used int, free_hunts_granted int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
  v_granted int;
begin
  -- fingerprint_hash has no default and the client doesn't (yet) send a
  -- real device fingerprint, so the device id doubles as the fingerprint.
  -- Fingerprint-based abuse detection is future work; quota logic is exact.
  insert into devices (id, fingerprint_hash)
  values (p_device_id, p_device_id::text)
  on conflict do nothing;

  select d.free_hunts_used, d.free_hunts_granted
    into v_used, v_granted
  from devices d
  where d.id = p_device_id
  for update;

  -- The row's grant is the limit (grants are managed externally, e.g.
  -- promos or bans); p_limit is the fallback for the product default.
  if v_used >= coalesce(v_granted, p_limit) then
    return query select false, 'guest-exhausted'::text, v_used, coalesce(v_granted, p_limit);
    return;
  end if;

  update devices
  set free_hunts_used = devices.free_hunts_used + 1,
      last_seen = now()
  where devices.id = p_device_id
  returning devices.free_hunts_used into v_used;

  return query select true, 'ok'::text, v_used, coalesce(v_granted, p_limit);
end;
$$;

-- Atomic refund decrement (never below zero; the abuse-ladder counting
-- stays in application code, the counter move itself is race-free).
create or replace function refund_hunt_unit(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update quota_counters
  set hunts_used = greatest(hunts_used - 1, 0)
  where user_id = p_user_id;
$$;

create or replace function refund_guest_hunt(p_device_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update devices
  set free_hunts_used = greatest(free_hunts_used - 1, 0)
  where id = p_device_id;
$$;

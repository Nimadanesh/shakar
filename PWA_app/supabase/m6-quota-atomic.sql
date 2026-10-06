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
create or replace function consume_guest_hunt(p_device_id text, p_limit int)
returns table (allowed boolean, reason text, free_hunts_used int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  insert into devices (device_id)
  values (p_device_id)
  on conflict (device_id) do nothing;

  select d.free_hunts_used
    into v_used
  from devices d
  where d.device_id = p_device_id
  for update;

  if v_used >= p_limit then
    return query select false, 'guest-exhausted'::text, v_used;
    return;
  end if;

  update devices
  set free_hunts_used = devices.free_hunts_used + 1
  where devices.device_id = p_device_id
  returning devices.free_hunts_used into v_used;

  return query select true, 'ok'::text, v_used;
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

create or replace function refund_guest_hunt(p_device_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update devices
  set free_hunts_used = greatest(free_hunts_used - 1, 0)
  where device_id = p_device_id;
$$;

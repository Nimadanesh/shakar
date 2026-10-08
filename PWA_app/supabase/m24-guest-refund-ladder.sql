-- m24: guest refund ladder (3/day cap) — atomic claim.
--
-- Root problem (navid 2026-10-08 deep review): guest zero-result refunds
-- were an unlimited plain decrement. A guest could fire zero-result hunts
-- forever — each one costs real Divar/API money — because the lock-list
-- policy "zero-result guest hunts free, 3/day cap" was never implemented.
-- The devices table already carried zero_refunds_today/refund_day for this;
-- this RPC wires them up atomically (same advisory-lock pattern as m17).
--
-- Policy: 1–3 zero-result refunds per day → refund; 4+ → no refund
-- (the caller surfaces the coaching message). Guests have no suspension
-- ladder — their 3-ever free hunts bound the exposure.
--
-- Safe to re-run: create or replace.

create or replace function claim_guest_refund_slot(p_device_id uuid, p_today date)
returns table (allowed boolean, outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refunds int;
begin
  -- One claimant per pool at a time: concurrent zero-result refunds can't
  -- both slip under the 3/day cap (same pattern as m17 claim_refund_slot).
  perform pg_advisory_xact_lock(hashtext('guest-refund:' || p_device_id::text));

  select case when refund_day is distinct from p_today then 0 else zero_refunds_today end
    into v_refunds
  from devices
  where id = p_device_id;

  if not found then
    return query select false, 'noop'::text;
    return;
  end if;

  if v_refunds < 3 then
    update devices
    set free_hunts_used = greatest(free_hunts_used - 1, 0),
        zero_refunds_today = v_refunds + 1,
        refund_day = p_today
    where id = p_device_id;
    return query select true, 'refund'::text;
  else
    update devices
    set zero_refunds_today = v_refunds + 1,
        refund_day = p_today
    where id = p_device_id;
    return query select false, 'no-refund'::text;
  end if;
end;
$$;

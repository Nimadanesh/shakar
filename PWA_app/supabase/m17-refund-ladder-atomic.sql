-- M17: atomic refund-ladder claim (bug-bounty final round #5, 2026-10-07).
--
-- refundHunt()'s abuse ladder was read-modify-write: two concurrent
-- refunds both read refunds_today=2, both passed "< 3", both refunded,
-- both wrote 3. The "max 3 refunds/day" policy (and the 3→6 warning /
-- 6+ suspension thresholds) could be bypassed under concurrency.
-- hunts_used's decrement was already atomic (m6 refund_hunt_unit); the
-- LADDER STATE was not.
--
-- claim_refund_slot() does the whole ladder transition atomically:
-- pg_advisory_xact_lock serializes concurrent refunds for the same user
-- (same pattern as m14/m15), then one transaction reads, decides, and
-- writes. The hunts_used decrement is folded in, so the refund path is
-- a single RPC call instead of RPC + PATCH.
--
-- Ladder (blueprint §2, unchanged semantics):
--   0–2 refunds today → refund the unit (allowed=true)
--   3–5               → no refund + warning
--   6+                → no refund + 24h suspension
-- Day rollover resets refunds_today (refund_day is a date).
--
-- Idempotent: safe to re-run (create or replace).

create or replace function claim_refund_slot(p_user_id uuid, p_today date)
returns table (allowed boolean, outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refunds int;
  v_exists boolean;
begin
  -- Serialize concurrent refunds for this user (see header comment).
  perform pg_advisory_xact_lock(hashtext('refund:' || p_user_id::text));

  select exists(select 1 from quota_counters where user_id = p_user_id)
    into v_exists;
  if not v_exists then
    return query select false, 'noop'::text;
    return;
  end if;

  -- Day rollover: yesterday's count doesn't gate today.
  select case
           when refund_day is distinct from p_today then 0
           else refunds_today
         end
    into v_refunds
    from quota_counters
    where user_id = p_user_id;

  if v_refunds < 3 then
    update quota_counters
    set hunts_used = greatest(hunts_used - 1, 0),
        refunds_today = v_refunds + 1,
        refund_day = p_today
    where user_id = p_user_id;
    return query select true, 'refund'::text;
  elsif v_refunds < 6 then
    update quota_counters
    set refunds_today = v_refunds + 1,
        refund_day = p_today,
        warnings = warnings + 1
    where user_id = p_user_id;
    return query select false, 'warning'::text;
  else
    update quota_counters
    set refunds_today = v_refunds + 1,
        refund_day = p_today,
        suspended_until = now() + interval '24 hours'
    where user_id = p_user_id;
    return query select false, 'suspended'::text;
  end if;
end;
$$;

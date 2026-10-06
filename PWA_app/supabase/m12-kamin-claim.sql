-- M12: atomic kamin claim for the scheduler (finding #13, bug-bounty
-- round 3, 2026-10-06).
--
-- tickDueKamins() was GET-all-active + JS due-filter: two overlapping
-- ticks both saw kamin X as due and both executed it → duplicate push
-- notifications + double Divar API cost. The per-checkRunId notification
-- dedupe does NOT cover this (different checkRunIds).
--
-- claim_due_kamins() atomically claims every due kamin in ONE statement
-- (FOR UPDATE SKIP LOCKED) and stamps claimed_at = now(). A concurrent
-- tick's claim sees zero rows for the same kamin — exactly one executor.
--
-- The lease (p_lease_secs): if a tick crashes mid-check, its kamins become
-- claimable again once claimed_at is older than the lease. The scheduler
-- runs every few minutes; 600s is comfortably longer than one check cycle.
-- checkKamin already PATCHes last_checked_at on completion, so a claimed
-- kamin is no longer "due" for the next tick anyway.
--
-- Cadence→interval mapping mirrors the engine's CADENCE_MS
-- ('5min'→5m, '15min'→15m, '30min'→30m, 'hourly'→1h, else 24h).
--
-- Idempotent: safe to re-run.

alter table kamins add column if not exists claimed_at timestamptz;

create or replace function claim_due_kamins(p_lease_secs integer)
returns setof kamins
language sql
security definer
set search_path = public
as $$
  with due as (
    select kamins.id
    from kamins
    where kamins.status = 'active'
      and (
        kamins.last_checked_at is null
        or kamins.last_checked_at < now() - case kamins.cadence
          when '5min' then interval '5 minutes'
          when '15min' then interval '15 minutes'
          when '30min' then interval '30 minutes'
          when 'hourly' then interval '1 hour'
          else interval '24 hours'
        end
      )
      and (
        kamins.claimed_at is null
        or kamins.claimed_at < now() - make_interval(secs => p_lease_secs)
      )
    order by kamins.last_checked_at nulls first
    for update skip locked
  ),
  claimed as (
    update kamins k
    set claimed_at = now()
    from due
    where k.id = due.id
    returning k.*
  )
  select * from claimed;
$$;

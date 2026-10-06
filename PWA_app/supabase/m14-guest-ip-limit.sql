-- M14: guest IP velocity limit (finding #15, bug-bounty round 3).
--
-- The guest free-hunt quota is keyed by `x-device-id`, which is a pure
-- client claim — rotating the header meant unlimited free hunts
-- (3/device became 3/arbitrary-identifier). Two layers now:
--
-- 1. Registered-but-unsubscribed users are keyed by user_id, not
--    device_id (app change in quota.ts) — accounts can't be rotated
--    like headers.
-- 2. True guests get an additional IP velocity cap (this file): even
--    with a fresh device id per request, one IP can't mint unlimited
--    free hunts. Generous on purpose (20/day) — it's abuse friction,
--    not a precision instrument; CGNAT false positives just wait a day.
--
-- Concurrency: pg_advisory_xact_lock serializes concurrent checks for
-- the SAME ip. Without it, simultaneous transactions all snapshot
-- count=0 (a CTE's INSERT is invisible to concurrent snapshots) and
-- all pass — the naive insert+count pattern is racy. The lock is
-- xact-scoped (auto-released at commit) and per-ip (different IPs
-- never block each other).
--
-- Idempotent: safe to re-run.

create table if not exists guest_ip_hits (
  ip text not null,
  hit_at timestamptz not null default now()
);
create index if not exists guest_ip_hits_ip_at_idx on guest_ip_hits (ip, hit_at);

create or replace function check_guest_ip_limit(p_ip text, p_limit int, p_window_secs int)
returns table (allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Serialize concurrent checks for this IP (see header comment).
  perform pg_advisory_xact_lock(hashtext(p_ip));

  -- Piggybacked cleanup: drop hits outside the sliding window.
  delete from guest_ip_hits
  where guest_ip_hits.hit_at < now() - make_interval(secs => p_window_secs);

  insert into guest_ip_hits (ip, hit_at) values (p_ip, now());

  select count(*)::int into v_count
  from guest_ip_hits
  where guest_ip_hits.ip = p_ip
    and guest_ip_hits.hit_at > now() - make_interval(secs => p_window_secs);

  -- v_count includes this request's hit.
  return query select (v_count <= p_limit);
end;
$$;

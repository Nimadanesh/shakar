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
-- Same atomic fixed-window pattern as m8's check_otp_ip_limit: the hit
-- is inserted and counted in ONE statement (same snapshot — the count
-- sees pre-request rows, hence the +1), so concurrent requests can't
-- slip past the limit. Piggybacked cleanup (24h retention covers the
-- 24h cap window).
--
-- Idempotent: safe to re-run.

create table if not exists guest_ip_hits (
  ip text not null,
  hit_at timestamptz not null default now()
);
create index if not exists guest_ip_hits_ip_at_idx on guest_ip_hits (ip, hit_at);

create or replace function check_guest_ip_limit(p_ip text, p_limit int, p_window_secs int)
returns table (allowed boolean)
language sql
security definer
set search_path = public
as $$
  with _cleanup as (
    delete from guest_ip_hits
    where guest_ip_hits.hit_at < now() - interval '2 hours'
  ),
  _hit as (
    insert into guest_ip_hits (ip, hit_at)
    values (p_ip, now())
    returning 1
  ),
  _count as (
    select count(*)::int as n
    from guest_ip_hits
    where guest_ip_hits.ip = p_ip
      and guest_ip_hits.hit_at > now() - make_interval(secs => p_window_secs)
  )
  select (_count.n + 1 <= p_limit) from _count;
$$;

-- M15: fix snapshot races in m8's OTP limit RPCs (bug-bounty round 3
-- follow-up, 2026-10-06).
--
-- Live testing of m14 caught it: 25 concurrent check_guest_ip_limit
-- calls (cap 20) allowed 21. Root cause is in PostgreSQL itself — all
-- statements/CTEs in one query share a single snapshot, so concurrent
-- transactions never see each other's INSERTs and all count 0.
--
-- m8's check_otp_ip_limit has the IDENTICAL pattern (insert+count in
-- one statement) and the identical race; its round-2 live test passed
-- on timing luck. claim_otp_send's INSERT..SELECT..WHERE is racy the
-- same way (two racing sends can both see "2 < 3").
--
-- Fix (same as m14): pg_advisory_xact_lock serializes concurrent calls
-- for the same key (ip / mobile). Xact-scoped, auto-released at commit;
-- different keys never block each other.
--
-- Idempotent: safe to re-run (create or replace).

create or replace function check_otp_ip_limit(p_ip text, p_limit int, p_window_secs int)
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

  delete from otp_ip_hits
  where otp_ip_hits.hit_at < now() - make_interval(secs => p_window_secs);

  insert into otp_ip_hits (ip, hit_at) values (p_ip, now());

  select count(*)::int into v_count
  from otp_ip_hits
  where otp_ip_hits.ip = p_ip
    and otp_ip_hits.hit_at > now() - make_interval(secs => p_window_secs);

  -- v_count includes this request's hit.
  return query select (v_count <= p_limit);
end;
$$;

create or replace function claim_otp_send(
  p_mobile text,
  p_code_hash text,
  p_expires_at timestamptz,
  p_max_attempts int,
  p_limit int,
  p_window_secs int
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  v_id uuid;
begin
  -- Serialize concurrent sends for this mobile (see header comment).
  perform pg_advisory_xact_lock(hashtext('otp_send:' || p_mobile));

  select count(*)::int into v_n
  from otp_verifications
  where otp_verifications.mobile = p_mobile
    and otp_verifications.created_at > now() - make_interval(secs => p_window_secs);

  if v_n >= p_limit then
    return; -- empty set: over limit, the app maps this to null/409
  end if;

  insert into otp_verifications (mobile, code_hash, expires_at, max_attempts, attempts)
  values (p_mobile, p_code_hash, p_expires_at, p_max_attempts, 0)
  returning otp_verifications.id into v_id;

  return query select v_id;
end;
$$;

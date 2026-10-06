-- M8: atomic OTP attempt counting + rate limits (findings #6, #10,
-- bug-bounty 2026-10-06).
--
-- #6: incrementAttempts() was GET attempts → PATCH attempts+1 (lost-update
-- race), and verify-otp checked attempts >= max BEFORE incrementing
-- (TOCTOU). Concurrent wrong-code verifies could exceed MAX_ATTEMPTS.
--
-- #10: the IP send limit lived in an in-memory Map (invisible across
-- instances), and sentSince() + create() was SELECT count → INSERT
-- (non-atomic: concurrent sends could both slip under the limit).
--
-- Each function below is a SINGLE STATEMENT: under READ COMMITTED a
-- single statement runs on one snapshot, so the check-and-act inside it
-- cannot interleave with a concurrent call. That single-statement
-- property — not locks, not retries — is the atomicity argument.
--
-- Conventions (same as m6-quota-atomic.sql): CREATE OR REPLACE,
-- SECURITY DEFINER, search_path = public, every column reference fully
-- qualified (an earlier migration failed in prod with 42702 on ambiguous
-- columns). Idempotent: safe to re-run. Run once in Supabase SQL Editor;
-- the API uses the atomic path automatically (falls back to the legacy
-- path with a loud warning if the functions are missing).

-- IP hit log for the cross-instance send limit. Rows are tiny and the
-- function piggybacks cleanup, so no cron/retention job is needed.
create table if not exists otp_ip_hits (
  ip text not null,
  hit_at timestamptz not null default now()
);
create index if not exists otp_ip_hits_ip_hit_idx on otp_ip_hits (ip, hit_at);

-- #6: atomic attempt increment. Returns the post-increment count (zero
-- rows when the id is unknown). The route denies when attempts EXCEEDS
-- max_attempts — exactly 5 verifies stay allowed, identical to the old
-- check-then-count semantics, minus the race.
create or replace function increment_otp_attempts(p_id uuid)
returns table (attempts int, max_attempts int)
language sql
security definer
set search_path = public
as $$
  update otp_verifications
  set attempts = otp_verifications.attempts + 1
  where otp_verifications.id = p_id
  returning otp_verifications.attempts, otp_verifications.max_attempts;
$$;

-- #10a: cross-instance IP send limit. Inserts the hit, then counts hits
-- inside the window, all in one statement. NOTE: data-modifying CTEs all
-- see the same snapshot, so _count cannot see _hit's insert — but the
-- inserted hit (hit_at = now()) is always inside the window, therefore
-- count + 1 is exact (a naive count would allow limit+1 hits).
-- A denied request still leaves its hit behind (standard fixed-window
-- behavior: hammering keeps you blocked until the window slides).
-- Old-hit cleanup is piggybacked — 2h is comfortably larger than any
-- window the app uses (1h).
create or replace function check_otp_ip_limit(p_ip text, p_limit int, p_window_secs int)
returns table (allowed boolean)
language sql
security definer
set search_path = public
as $$
  with _cleanup as (
    delete from otp_ip_hits
    where otp_ip_hits.hit_at < now() - interval '2 hours'
  ),
  _hit as (
    insert into otp_ip_hits (ip, hit_at)
    values (p_ip, now())
    returning 1
  ),
  _count as (
    select count(*)::int as n
    from otp_ip_hits
    where otp_ip_hits.ip = p_ip
      and otp_ip_hits.hit_at > now() - make_interval(secs => p_window_secs)
  )
  select (_count.n + 1 <= p_limit) from _count;
$$;

-- #10b: atomic send-slot claim. Counts recent sends for the mobile and
-- inserts the new verification row ONLY when under the limit — one
-- statement, so two racing sends cannot both slip through. Returns the
-- new row id, or zero rows when the mobile is over its limit.
-- attempts is set explicitly (not relying on the column default).
create or replace function claim_otp_send(
  p_mobile text,
  p_code_hash text,
  p_expires_at timestamptz,
  p_max_attempts int,
  p_limit int,
  p_window_secs int
)
returns table (id uuid)
language sql
security definer
set search_path = public
as $$
  with recent as (
    select count(*)::int as n
    from otp_verifications
    where otp_verifications.mobile = p_mobile
      and otp_verifications.created_at > now() - make_interval(secs => p_window_secs)
  ),
  ins as (
    insert into otp_verifications (mobile, code_hash, expires_at, max_attempts, attempts)
    select p_mobile, p_code_hash, p_expires_at, p_max_attempts, 0
    from recent
    where recent.n < p_limit
    returning otp_verifications.id
  )
  select ins.id from ins;
$$;

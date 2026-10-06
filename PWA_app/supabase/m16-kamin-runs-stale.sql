-- M16: kamin_runs.stale flag (findings #17/#21, bug-bounty round 4,
-- 2026-10-06).
--
-- checkKamin now distinguishes a check that ran on STALE Divar cache
-- (finding #17: last_success_at must NOT advance) from a truly fresh
-- one. The stale boolean on the run row makes this visible for
-- debugging and for any future UI that explains "why didn't my kamin
-- catch up yet".
--
-- Idempotent: safe to re-run.

alter table kamin_runs add column if not exists stale boolean not null default false;

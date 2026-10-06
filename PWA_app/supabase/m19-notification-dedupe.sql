-- M19: atomic push-notification dedupe (finding #4, final round).
--
-- checkKamin() dedupes notifications with GET-then-INSERT: two concurrent
-- executions can both see "no notification" and both INSERT, and sendPush()
-- fires outside the dedupe check anyway. Web Push has no idempotency, so
-- the user gets duplicate pushes for one match set.
--
-- The unique index makes the INSERT itself the atomic gate: ON CONFLICT
-- DO NOTHING returns zero rows for the loser, and only the winner sends
-- the push.
--
-- Idempotent: safe to re-run.

-- M5 may have been partially applied (production had missing tables);
-- ensure the columns exist before indexing.
alter table notifications add column if not exists related_kamin_id uuid;
alter table notifications add column if not exists check_run_id uuid;

-- The index from m5 is non-unique; replace it with a unique one.
-- NOTE: no WHERE clause — Postgres ON CONFLICT (col1, col2) cannot use a
-- partial index. The code always sets both columns, so NULLs never collide
-- (NULLs are distinct in unique indexes).
drop index if exists notifications_kamin_run_idx;
drop index if exists notifications_kamin_check_uidx;
create unique index if not exists notifications_kamin_check_uidx
  on notifications (related_kamin_id, check_run_id);

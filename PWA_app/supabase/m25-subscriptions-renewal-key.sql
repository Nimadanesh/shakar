-- m25: add the missing idempotency column to subscriptions.
--
-- Found by LIVE verification 2026-10-08: the m20 migration defines
-- last_renewal_key, but production subscriptions lacks it (an earlier
-- m20 revision was executed before the column was added). Without it,
-- renewSubscription's PATCH fails with PGRST204 and renewals break.
-- Idempotent: safe to run even if the column already exists.
alter table subscriptions
  add column if not exists last_renewal_key text;

-- M13: one deepen per hunt (finding #12, bug-bounty round 3, 2026-10-06).
--
-- POST /api/hunts/[id]/deepen rejected deepening a run whose own
-- def.deepHistory was true, but never marked the PARENT as deepened —
-- deepening run A created B, deepening A again created C, ad infinitum.
-- Each deepen costs real Divar API calls and was never charged.
-- Product intent: deepen is a ONE-TIME opt-in second phase per hunt
-- («می‌خوای برم سراغ قدیمی‌ترها؟»).
--
-- hunt_runs.deepened_from records the parent; the partial unique index
-- makes a second (concurrent) insert fail atomically with 23505, which
-- the route maps to 400 already-deepened.
--
-- Idempotent: safe to re-run. Run once in Supabase SQL Editor.

alter table hunt_runs
  add column if not exists deepened_from uuid references hunt_runs(id) on delete set null;

create unique index if not exists hunt_runs_deepened_from_uidx
  on hunt_runs (deepened_from)
  where deepened_from is not null;

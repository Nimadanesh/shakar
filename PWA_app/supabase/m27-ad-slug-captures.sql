-- m27: Step 0.5 breadcrumb corpus (Smart Engine Plan v5).
-- Every verified ad detail's Divar leaf category, captured in the live
-- hunt path (src/lib/server/hunt/slugCapture.ts). This corpus is the raw
-- material for Step 1's knowledge layer (is-a mining from breadcrumbs).
-- Service-role access only (same posture as the other private tables).
--
-- Dedup semantics: PK (ad_id, capture_date) + ignore-duplicates inserts.
-- The same ad seen on a LATER date is a new, independent capture — the
-- knowledge layer's support rule counts independent captures, so dates
-- are never collapsed.
--
-- Retention (policy): rows older than 180 days may be deleted by ops;
-- the delete is a manual/ops action until the Step 1.0 harvester lands:
--   delete from ad_slug_captures
--   where capture_date < current_date - interval '180 days';

create table if not exists ad_slug_captures (
  ad_id text not null,
  category_slug text not null,
  capture_date date not null,
  captured_at timestamptz not null default now(),
  primary key (ad_id, capture_date)
);

create index if not exists ad_slug_captures_slug_idx
  on ad_slug_captures (category_slug);

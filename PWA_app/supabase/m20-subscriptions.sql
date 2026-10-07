-- M6: purchase subscriptions + dollar-indexed tier prices.
-- navid runs this manually in the Supabase SQL Editor (service_role).
-- Blueprint §1.3 + lock-list §1 (dollar peg 270,000 T; monthly re-index;
-- existing annuals stay locked; new annuals re-index if dollar > 350,000).

-- 1) Subscriptions -------------------------------------------------------
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- matches profiles.id (uuid), same convention as quota_counters —
  -- no FK so this migration never blocks on auth table names.
  user_id uuid not null,
  tier text not null check (tier in ('paye','herfei','vizhe','namayandegi','almas')),
  status text not null
    check (status in ('pending','active','expired','canceled'))
    default 'pending',
  billing text not null check (billing in ('monthly','annual')) default 'monthly',
  -- Peg basis (USD) + the Toman price actually charged, snapshotted at
  -- purchase/activation so later re-indexes never rewrite history.
  price_usd numeric(12,4) not null,
  price_toman integer not null,
  -- Existing annuals stay locked at their purchase Toman price.
  annual_locked_toman integer,
  seats_total integer not null default 1,
  seats_used integer not null default 0,
  cycle_started_at timestamptz,
  cycle_ends_at timestamptz,
  -- Idempotency for renew webhooks (blueprint: double webhook ⇒ one extension).
  last_renewal_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live (pending|active) subscription per user — intent is idempotent.
create unique index if not exists subscriptions_user_live_uniq
  on subscriptions (user_id)
  where status in ('pending','active');
create index if not exists subscriptions_user_idx on subscriptions (user_id);
create index if not exists subscriptions_status_idx on subscriptions (status);

-- 2) Tier prices (history — every re-index inserts, never updates) ---------
create table if not exists tier_prices (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('paye','herfei','vizhe','namayandegi','almas')),
  billing text not null check (billing in ('monthly','annual')),
  usd_price numeric(12,4) not null,
  toman_price integer not null,
  dollar_rate integer not null,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists tier_prices_lookup_idx
  on tier_prices (tier, billing, effective_from desc);

-- 3) App settings (manual dollar rate — navid approved manual re-index) ---
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into app_settings (key, value)
  values ('dollar_rate_toman', '270000')
  on conflict (key) do nothing;

-- 4) Seed: lock-list Toman prices at the 270k peg; USD = toman / 270000.
--    Toman re-derives as round(usd * rate / 10000) * 10000 (nearest 10k —
--    keeps prices clean: 199,989 → 200,000).
--    Runs only on an empty table so re-running the migration is safe.
insert into tier_prices (tier, billing, usd_price, toman_price, dollar_rate)
select * from (values
  ('paye','monthly', 0.7407,    200000, 270000),
  ('paye','annual',  7.4074,   2000000, 270000),
  ('herfei','monthly', 4.4444, 1200000, 270000),
  ('herfei','annual', 44.4444,12000000, 270000),
  ('vizhe','monthly', 11.1111, 3000000, 270000),
  ('vizhe','annual', 111.1111,30000000, 270000),
  ('namayandegi','monthly', 29.6296, 8000000, 270000),
  ('namayandegi','annual', 296.2963,80000000, 270000),
  ('almas','monthly', 111.1111, 30000000, 270000),
  ('almas','annual', 1111.1111,300000000, 270000)
) as v(tier, billing, usd_price, toman_price, dollar_rate)
where not exists (select 1 from tier_prices);

-- 5) RLS: the app talks to these tables with the service_role key only
--    (server-only sb.rest), same convention as the other M-tables.
alter table subscriptions enable row level security;
alter table tier_prices enable row level security;
alter table app_settings enable row level security;

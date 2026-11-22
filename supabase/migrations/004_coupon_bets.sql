-- KUponum 004: coupon_bets + odds_snapshots
-- Eski oranlar silinmez; her gözlem ayrı snapshot olarak saklanır.

create table if not exists public.coupon_bets (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  row_number integer not null,
  home_team text not null,
  away_team text not null,
  league text,
  market text not null,
  selection text not null,
  printed_odds numeric(10,2) not null,
  matched_odds numeric(10,2),
  event_id text,
  market_id text,
  selection_id text,
  ocr_confidence numeric(5,4),
  ai_confidence numeric(5,4),
  event_confidence numeric(5,4),
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coupon_id, row_number)
);

drop trigger if exists coupon_bets_set_updated_at on public.coupon_bets;
create trigger coupon_bets_set_updated_at
  before update on public.coupon_bets
  for each row execute function public.set_updated_at();

create table if not exists public.odds_snapshots (
  id uuid primary key default gen_random_uuid(),
  coupon_bet_id uuid not null references public.coupon_bets (id) on delete cascade,
  printed_odds numeric(10,2) not null,
  observed_odds numeric(10,2) not null,
  difference numeric(10,2) not null,
  observed_at timestamptz not null,
  source text not null,
  created_at timestamptz not null default now()
);

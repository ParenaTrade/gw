-- KUponum 007: settlements + member_ledger
-- Finansal hesap coupon tablosuna gömülmez; ayrı settlement + ledger.
-- Bakiye tek değişken değildir; tüm hareketler ledger'dan türetilir.

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete restrict,
  member_id uuid not null references public.members (id) on delete restrict,
  platform_reference text not null unique,
  gross_result numeric(14,2) not null,
  partner_settlement numeric(14,2) not null,
  member_amount numeric(14,2) not null,
  currency text not null default 'TRY',
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  settlement_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists settlements_set_updated_at on public.settlements;
create trigger settlements_set_updated_at
  before update on public.settlements
  for each row execute function public.set_updated_at();

create table if not exists public.member_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  coupon_id uuid references public.coupons (id) on delete set null,
  transaction_type text not null
    check (transaction_type in ('BET_SETTLEMENT', 'ADJUSTMENT', 'PAYOUT', 'REFUND')),
  amount numeric(14,2) not null,
  currency text not null default 'TRY',
  balance_after numeric(14,2) not null,
  reference_id text not null unique,
  description text,
  created_at timestamptz not null default now()
);

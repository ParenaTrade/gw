-- KUponum 003: coupons
-- Zaman damgaları operasyonel sorumluluk zinciri için ayrı tutulur.
-- Para/oran alanları numeric (float yok).

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  coupon_code text not null unique,
  member_id uuid not null references public.members (id) on delete restrict,
  status text not null default 'DRAFT'
    check (status in (
      'DRAFT','UPLOADED','OCR_PROCESSING','OCR_FAILED','AI_PROCESSING',
      'NEEDS_REVIEW','READY_FOR_MEMBER_APPROVAL','MEMBER_APPROVED',
      'PARTNER_QUEUE','PARTNER_PROCESSING','PLATFORM_PREPARING',
      'PENDING_CONFIRMATION','SUBMITTED','ACCEPTED','REJECTED',
      'ODDS_CHANGED','RESULT_PENDING','WON','LOST','RESULT_UPDATED',
      'SETTLED','FAILED','CANCELLED'
    )),
  physical_coupon_date date,
  physical_coupon_time time,
  uploaded_at timestamptz,
  ai_processed_at timestamptz,
  member_approved_at timestamptz,
  partner_received_at timestamptz,
  partner_processed_at timestamptz,
  platform_processed_at timestamptz,
  result_updated_at timestamptz,
  platform_transaction_id text,
  printed_total_odds numeric(12,2),
  accepted_total_odds numeric(12,2),
  stake_amount numeric(14,2),
  potential_return numeric(14,2),
  final_result text,
  approval_version integer not null default 1,
  submission_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

-- KUponum 005: coupon_images + ocr_results + ai_coupon_parses + private bucket
-- Orijinal görsel değiştirilemez audit kaydıdır; bucket PRIVATE.

create table if not exists public.coupon_images (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  storage_path text not null,
  image_type text not null default 'original'
    check (image_type in ('original', 'processed', 'ocr')),
  mime_type text not null default 'image/jpeg',
  size_bytes integer,
  sha256 text not null,
  ocr_processed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  engine text not null,
  raw_text text,
  confidence numeric(5,4),
  processing_time_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_coupon_parses (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  model text not null,
  prompt_version text not null,
  result_json jsonb,
  confidence numeric(5,4),
  needs_review boolean not null default true,
  created_at timestamptz not null default now()
);

-- Private storage bucket (public ASLA değil)
insert into storage.buckets (id, name, public)
values ('coupon-images', 'coupon-images', false)
on conflict (id) do nothing;

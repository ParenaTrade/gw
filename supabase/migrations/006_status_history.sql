-- KUponum 006: coupon_status_history + audit_logs + idempotency_keys + notifications

create table if not exists public.coupon_status_history (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.idempotency_keys (
  key text primary key,
  scope text not null,
  entity_type text not null,
  entity_id uuid,
  response_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  coupon_id uuid references public.coupons (id) on delete set null,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

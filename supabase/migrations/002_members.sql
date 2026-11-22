-- KUponum 002: members + member_devices
-- Biyometrik şablon / ham parmak izi ASLA saklanmaz. WebAuthn doğrulaması
-- cihaz üzerinde gerçekleşir; burada yalnızca cihaz meta verisi tutulur.

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  member_code text not null unique,
  full_name text not null,
  phone text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

create table if not exists public.member_devices (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  device_name text,
  platform text,
  passkey_enabled boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

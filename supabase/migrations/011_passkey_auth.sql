-- KUponum 011: telefon + passkey kimlik doğrulama tabloları
-- Uygulama kendi oturumunu (cookie + auth_sessions) ve WebAuthn passkey'lerini yönetir.
-- Supabase burada yalnızca Postgres / Storage olarak kullanılır; sunucu DATABASE_URL ile
-- (postgres rolü, RLS'i bypass eder) bağlanır. Tekrarlanabilir (idempotent).

create table if not exists public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.member_credentials (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter integer not null default 0,
  transports jsonb not null default '[]'::jsonb,
  device_name text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists member_credentials_member_idx on public.member_credentials (member_id);

create table if not exists public.auth_otps (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  pending_full_name text,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists auth_otps_phone_idx on public.auth_otps (phone);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  identity_id uuid not null references public.auth_identities (id) on delete cascade,
  user_agent text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_sessions_identity_idx on public.auth_sessions (identity_id);

create table if not exists public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  purpose text not null,
  phone text,
  full_name text,
  member_id uuid,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
-- Daha önce (full_name'siz) oluşturulmuşsa tamamla.
alter table public.auth_challenges add column if not exists full_name text;

-- profiles / members artık Supabase auth.users'a değil, auth_identities.id'ye karşılık gelir.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.members drop constraint if exists members_auth_user_id_fkey;

-- Bu tablolar Supabase Data API (anon/authenticated) üzerinden ASLA okunamamalı:
-- RLS açık + politika yok = reddet. Sunucu bağlantısı (postgres rolü) etkilenmez.
alter table public.auth_identities enable row level security;
alter table public.member_credentials enable row level security;
alter table public.auth_otps enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.auth_challenges enable row level security;

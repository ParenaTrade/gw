-- KUponum 001: profiles + RLS yardımcıları + updated_at trigger altyapısı
-- Tekrarlanabilir (idempotent) migration.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'MEMBER'
    check (role in ('MEMBER', 'PARTNER_ADMIN', 'OPERATOR', 'AUDITOR', 'ADMIN')),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rol yardımcıları: RLS politikalarında kullanılır. SECURITY DEFINER ile
-- profiles üzerindeki recursive RLS'den kaçınılır.
create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.members where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('PARTNER_ADMIN', 'OPERATOR', 'AUDITOR', 'ADMIN')
      and status = 'ACTIVE'
  );
$$;

create or replace function public.can_audit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('PARTNER_ADMIN', 'AUDITOR', 'ADMIN')
      and status = 'ACTIVE'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- KUponum 010: team normalization + event catalog (Faz 3)
-- printed_odds nullable: okunamayan oran uydurulmaz, needs_review ile işaretlenir.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  normalized_name text not null,
  aliases jsonb not null default '[]'::jsonb,
  league text,
  created_at timestamptz not null default now()
);

create table if not exists public.event_catalog (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  home_team text not null,
  away_team text not null,
  league text,
  event_date date,
  start_time time,
  markets jsonb not null default '{}'::jsonb,
  source text not null default 'catalog',
  created_at timestamptz not null default now()
);

alter table public.coupon_bets alter column printed_odds drop not null;

alter table public.teams enable row level security;
alter table public.event_catalog enable row level security;

drop policy if exists teams_read_authenticated on public.teams;
create policy teams_read_authenticated on public.teams
  for select using (auth.uid() is not null);

drop policy if exists teams_write_staff on public.teams;
create policy teams_write_staff on public.teams
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists catalog_read_authenticated on public.event_catalog;
create policy catalog_read_authenticated on public.event_catalog
  for select using (auth.uid() is not null);

drop policy if exists catalog_write_staff on public.event_catalog;
create policy catalog_write_staff on public.event_catalog
  for all using (public.is_staff()) with check (public.is_staff());

create index if not exists teams_normalized_idx on public.teams (normalized_name);
create index if not exists event_catalog_date_idx on public.event_catalog (event_date);
create index if not exists event_catalog_teams_idx on public.event_catalog (home_team, away_team);

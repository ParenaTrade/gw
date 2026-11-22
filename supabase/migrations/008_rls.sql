-- KUponum 008: Row Level Security — RLS-first güvenlik.
-- Üye yalnızca KENDİ verisini görür; partner/staff rolleri ayrıcalıklıdır.
-- Tüm politikalar tekrarlanabilir şekilde önce drop edilir.

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.member_devices enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_bets enable row level security;
alter table public.coupon_images enable row level security;
alter table public.ocr_results enable row level security;
alter table public.ai_coupon_parses enable row level security;
alter table public.odds_snapshots enable row level security;
alter table public.coupon_status_history enable row level security;
alter table public.audit_logs enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.settlements enable row level security;
alter table public.member_ledger enable row level security;
alter table public.notifications enable row level security;

-- profiles ---------------------------------------------------------------
drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff on public.profiles
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid() and role = 'MEMBER');

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and status = (select p.status from public.profiles p where p.id = auth.uid())
  );

drop policy if exists profiles_update_staff on public.profiles;
create policy profiles_update_staff on public.profiles
  for update using (public.is_staff());

-- members ----------------------------------------------------------------
drop policy if exists members_select_own_or_staff on public.members;
create policy members_select_own_or_staff on public.members
  for select using (auth_user_id = auth.uid() or public.is_staff());

drop policy if exists members_insert_own on public.members;
create policy members_insert_own on public.members
  for insert with check (auth_user_id = auth.uid());

drop policy if exists members_update_own_or_staff on public.members;
create policy members_update_own_or_staff on public.members
  for update using (auth_user_id = auth.uid() or public.is_staff());

-- member_devices -----------------------------------------------------------
drop policy if exists devices_own_or_staff on public.member_devices;
create policy devices_own_or_staff on public.member_devices
  for select using (member_id = public.current_member_id() or public.is_staff());

drop policy if exists devices_insert_own on public.member_devices;
create policy devices_insert_own on public.member_devices
  for insert with check (member_id = public.current_member_id());

drop policy if exists devices_update_own on public.member_devices;
create policy devices_update_own on public.member_devices
  for update using (member_id = public.current_member_id());

-- coupons ------------------------------------------------------------------
drop policy if exists coupons_select_own_or_staff on public.coupons;
create policy coupons_select_own_or_staff on public.coupons
  for select using (member_id = public.current_member_id() or public.is_staff());

drop policy if exists coupons_insert_own_draft on public.coupons;
create policy coupons_insert_own_draft on public.coupons
  for insert with check (member_id = public.current_member_id() and status = 'DRAFT');

drop policy if exists coupons_update_own_editable on public.coupons;
create policy coupons_update_own_editable on public.coupons
  for update using (
    member_id = public.current_member_id()
    and status in ('DRAFT','UPLOADED','NEEDS_REVIEW','READY_FOR_MEMBER_APPROVAL')
  ) with check (member_id = public.current_member_id());

drop policy if exists coupons_update_staff on public.coupons;
create policy coupons_update_staff on public.coupons
  for update using (public.is_staff());

-- coupon_bets ----------------------------------------------------------------
drop policy if exists bets_select_own_or_staff on public.coupon_bets;
create policy bets_select_own_or_staff on public.coupon_bets
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.coupons c
      where c.id = coupon_id and c.member_id = public.current_member_id()
    )
  );

drop policy if exists bets_update_own_review on public.coupon_bets;
create policy bets_update_own_review on public.coupon_bets
  for update using (
    exists (
      select 1 from public.coupons c
      where c.id = coupon_id
        and c.member_id = public.current_member_id()
        and c.status in ('NEEDS_REVIEW','READY_FOR_MEMBER_APPROVAL')
    )
  );

drop policy if exists bets_write_staff on public.coupon_bets;
create policy bets_write_staff on public.coupon_bets
  for all using (public.is_staff()) with check (public.is_staff());

-- coupon_images ----------------------------------------------------------------
drop policy if exists images_select_own_or_staff on public.coupon_images;
create policy images_select_own_or_staff on public.coupon_images
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.coupons c
      where c.id = coupon_id and c.member_id = public.current_member_id()
    )
  );

drop policy if exists images_insert_own on public.coupon_images;
create policy images_insert_own on public.coupon_images
  for insert with check (
    exists (
      select 1 from public.coupons c
      where c.id = coupon_id
        and c.member_id = public.current_member_id()
        and c.status in ('DRAFT','UPLOADED')
    )
  );
-- Üye görseli UPDATE/DELETE edemez: orijinal audit kaydı değiştirilemez.

drop policy if exists images_write_staff on public.coupon_images;
create policy images_write_staff on public.coupon_images
  for insert with check (public.is_staff());

-- ocr_results / ai_coupon_parses / odds_snapshots: üye okur, staff yazar --------
drop policy if exists ocr_select_own_or_staff on public.ocr_results;
create policy ocr_select_own_or_staff on public.ocr_results
  for select using (
    public.is_staff()
    or exists (select 1 from public.coupons c where c.id = coupon_id and c.member_id = public.current_member_id())
  );

drop policy if exists ai_select_own_or_staff on public.ai_coupon_parses;
create policy ai_select_own_or_staff on public.ai_coupon_parses
  for select using (
    public.is_staff()
    or exists (select 1 from public.coupons c where c.id = coupon_id and c.member_id = public.current_member_id())
  );

drop policy if exists snapshots_select_own_or_staff on public.odds_snapshots;
create policy snapshots_select_own_or_staff on public.odds_snapshots
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.coupon_bets b
      join public.coupons c on c.id = b.coupon_id
      where b.id = coupon_bet_id and c.member_id = public.current_member_id()
    )
  );

-- status history ----------------------------------------------------------------
drop policy if exists history_select_own_or_staff on public.coupon_status_history;
create policy history_select_own_or_staff on public.coupon_status_history
  for select using (
    public.is_staff()
    or exists (select 1 from public.coupons c where c.id = coupon_id and c.member_id = public.current_member_id())
  );

drop policy if exists history_insert_actor on public.coupon_status_history;
create policy history_insert_actor on public.coupon_status_history
  for insert with check (
    changed_by = auth.uid()
    and (
      public.is_staff()
      or exists (select 1 from public.coupons c where c.id = coupon_id and c.member_id = public.current_member_id())
    )
  );

-- audit_logs: yalnızca denetim rolleri okur; aktör kendi kaydını yazar -----------
drop policy if exists audit_select_auditor on public.audit_logs;
create policy audit_select_auditor on public.audit_logs
  for select using (public.can_audit());

drop policy if exists audit_insert_actor on public.audit_logs;
create policy audit_insert_actor on public.audit_logs
  for insert with check (actor_id = auth.uid());

-- idempotency_keys: istemci erişimi yok (server-side / Edge Function sınırı) ------
-- RLS aktif, policy yok → authenticated rolü erişemez.

-- settlements / member_ledger: üye yalnızca okur, yazım servis katmanında ---------
drop policy if exists settlements_select_own_or_staff on public.settlements;
create policy settlements_select_own_or_staff on public.settlements
  for select using (member_id = public.current_member_id() or public.is_staff());

drop policy if exists ledger_select_own_or_staff on public.member_ledger;
create policy ledger_select_own_or_staff on public.member_ledger
  for select using (member_id = public.current_member_id() or public.is_staff());

-- notifications -------------------------------------------------------------------
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (member_id = public.current_member_id());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (member_id = public.current_member_id());

-- storage: coupon-images private bucket --------------------------------------------
drop policy if exists coupon_images_storage_read on storage.objects;
create policy coupon_images_storage_read on storage.objects
  for select using (
    bucket_id = 'coupon-images'
    and (
      (storage.foldername(name))[2] = public.current_member_id()::text
      or public.is_staff()
    )
  );

drop policy if exists coupon_images_storage_insert on storage.objects;
create policy coupon_images_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'coupon-images'
    and (storage.foldername(name))[1] = 'members'
    and (storage.foldername(name))[2] = public.current_member_id()::text
  );
-- Üye storage nesnesini update/delete edemez (orijinal immutable).

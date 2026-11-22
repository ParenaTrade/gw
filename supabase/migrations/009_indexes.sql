-- KUponum 009: performans indexleri

create index if not exists members_phone_idx on public.members (phone);
create index if not exists members_member_code_idx on public.members (member_code);
create index if not exists member_devices_member_idx on public.member_devices (member_id);

create index if not exists coupons_member_idx on public.coupons (member_id);
create index if not exists coupons_status_idx on public.coupons (status);
create index if not exists coupons_created_at_idx on public.coupons (created_at desc);
create index if not exists coupons_member_status_idx on public.coupons (member_id, status);

create index if not exists coupon_bets_coupon_idx on public.coupon_bets (coupon_id);
create index if not exists coupon_images_coupon_idx on public.coupon_images (coupon_id);
create index if not exists ocr_results_coupon_idx on public.ocr_results (coupon_id);
create index if not exists ai_parses_coupon_idx on public.ai_coupon_parses (coupon_id);
create index if not exists odds_snapshots_bet_idx on public.odds_snapshots (coupon_bet_id);

create index if not exists coupon_status_history_coupon_idx on public.coupon_status_history (coupon_id, created_at);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create index if not exists settlements_member_idx on public.settlements (member_id);
create index if not exists settlements_coupon_idx on public.settlements (coupon_id);
create index if not exists member_ledger_member_idx on public.member_ledger (member_id, created_at);
create index if not exists notifications_member_idx on public.notifications (member_id, created_at desc);

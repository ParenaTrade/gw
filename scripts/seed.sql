-- KUponum demo seed (yalnızca geliştirme/preview).
-- Kullanım: psql "$DATABASE_URL" -v sha="<görsel sha256>" -f scripts/seed.sql
-- Idempotent: CPN-000123 varsa hiçbir şey yapmaz.

create temp table if not exists _seed_sha (sha text);
truncate _seed_sha;
insert into _seed_sha values (:'sha');

do $$
declare
  v_sha text;
  partner_id uuid := '22222222-2222-4222-8222-222222222222';
  member_auth_id uuid := '33333333-3333-4333-8333-333333333333';
  member_id uuid := '11111111-1111-4111-8111-111111111111';
  c1 uuid := 'c0000001-0000-4000-8000-000000000001';
  c2 uuid := 'c0000002-0000-4000-8000-000000000002';
  c3 uuid := 'c0000003-0000-4000-8000-000000000003';
  c4 uuid := 'c0000004-0000-4000-8000-000000000004';
  b1 uuid := 'b0000001-0000-4000-8000-000000000001';
  b2 uuid := 'b0000002-0000-4000-8000-000000000002';
  b3 uuid := 'b0000003-0000-4000-8000-000000000003';
  b4 uuid := 'b0000004-0000-4000-8000-000000000004';
  b5 uuid := 'b0000005-0000-4000-8000-000000000005';
  b6 uuid := 'b0000006-0000-4000-8000-000000000006';
begin
  if exists (select 1 from coupons where coupon_code = 'CPN-000123') then
    return;
  end if;
  select sha into v_sha from _seed_sha limit 1;

  -- Kimlikler + profiller
  insert into auth_identities (id, phone) values
    (partner_id, '+905559990000'),
    (member_auth_id, '+905551112233')
  on conflict (id) do nothing;

  insert into profiles (id, full_name, phone, role) values
    (partner_id, 'Demo Partner Operatörü', '+905559990000', 'PARTNER_ADMIN'),
    (member_auth_id, 'Demo Üye', '+905551112233', 'MEMBER')
  on conflict (id) do nothing;

  insert into members (id, auth_user_id, member_code, full_name, phone) values
    (member_id, member_auth_id, 'MBR-000001', 'Demo Üye', '+905551112233')
  on conflict (id) do nothing;

  insert into member_devices (member_id, device_name, platform, passkey_enabled, last_login_at)
  values (member_id, 'iPhone / iPad', 'ios', false, now() - interval '2 hours');

  -- Kuponlar
  insert into coupons (id, coupon_code, member_id, status, physical_coupon_date, physical_coupon_time,
    uploaded_at, member_approved_at, partner_received_at, partner_processed_at, platform_processed_at,
    printed_total_odds, accepted_total_odds, stake_amount, potential_return, platform_transaction_id, created_at)
  values
    (c1, 'CPN-000123', member_id, 'ACCEPTED', current_date, '18:32',
     now() - interval '90 minutes', now() - interval '87 minutes', now() - interval '85 minutes',
     now() - interval '84 minutes', now() - interval '83 minutes',
     10.82, 10.41, 50.00, 520.50, 'PLT-DEMO-123', now() - interval '95 minutes'),
    (c2, 'CPN-000124', member_id, 'PARTNER_QUEUE', current_date, '19:05',
     now() - interval '12 minutes', now() - interval '10 minutes', null, null, null,
     null, null, 25.00, null, null, now() - interval '15 minutes'),
    (c3, 'CPN-000125', member_id, 'SETTLED', current_date - 1, '16:10',
     now() - interval '26 hours', now() - interval '25 hours', now() - interval '24 hours',
     now() - interval '23 hours', now() - interval '22 hours',
     8.42, 8.42, 100.00, 842.00, 'PLT-DEMO-125', now() - interval '27 hours'),
    (c4, 'CPN-000126', member_id, 'ODDS_CHANGED', current_date, '20:40',
     now() - interval '40 minutes', now() - interval '38 minutes', now() - interval '36 minutes',
     now() - interval '35 minutes', null,
     1.85, null, 40.00, null, null, now() - interval '45 minutes');

  -- Görseller (orijinal, immutable)
  insert into coupon_images (coupon_id, storage_path, image_type, mime_type, size_bytes, sha256)
  values
    (c1, 'members/' || member_id || '/coupons/' || c1 || '/original-seed.jpg', 'original', 'image/jpeg', null, v_sha),
    (c2, 'members/' || member_id || '/coupons/' || c2 || '/original-seed.jpg', 'original', 'image/jpeg', null, v_sha);

  -- Bahisler
  insert into coupon_bets (id, coupon_id, row_number, home_team, away_team, league, market, selection,
    printed_odds, matched_odds, event_confidence, needs_review)
  values
    (b1, c1, 1, 'Fenerbahçe', 'Galatasaray', 'Süper Lig', 'MATCH_WINNER', 'HOME', 1.85, 1.78, 0.97, false),
    (b2, c1, 2, 'Barcelona', 'Real Madrid', 'La Liga', 'MATCH_WINNER', 'DRAW', 3.40, 3.40, 0.96, false),
    (b3, c1, 3, 'Liverpool', 'Arsenal', 'Premier League', 'BOTH_TEAMS_TO_SCORE', 'YES', 1.72, 1.72, 0.98, false),
    (b4, c3, 1, 'Ajax', 'PSV', 'Eredivisie', 'MATCH_WINNER', 'HOME', 2.10, 2.10, 0.97, false),
    (b5, c3, 2, 'Celtic', 'Rangers', 'Scottish Premiership', 'MATCH_WINNER', 'AWAY', 4.01, 4.01, 0.95, false),
    (b6, c4, 1, 'Trabzonspor', 'Beşiktaş', 'Süper Lig', 'MATCH_WINNER', 'HOME', 1.85, null, 0.88, true);

  -- Oran snapshot'ları (eski oran silinmez)
  insert into odds_snapshots (coupon_bet_id, printed_odds, observed_odds, difference, observed_at, source)
  values
    (b1, 1.85, 1.78, -0.07, now() - interval '84 minutes', 'partner-operation'),
    (b6, 1.85, 1.78, -0.07, now() - interval '34 minutes', 'partner-operation');

  -- Durum geçmişi
  insert into coupon_status_history (coupon_id, old_status, new_status, changed_by, reason, created_at) values
    (c1, null, 'DRAFT', member_auth_id, 'Kupon oluşturuldu', now() - interval '95 minutes'),
    (c1, 'DRAFT', 'UPLOADED', member_auth_id, 'Orijinal kupon görseli yüklendi', now() - interval '90 minutes'),
    (c1, 'UPLOADED', 'MEMBER_APPROVED', member_auth_id, 'Üye kuponu onayladı', now() - interval '87 minutes'),
    (c1, 'MEMBER_APPROVED', 'PARTNER_QUEUE', null, 'Sistem: partner kuyruğuna alındı', now() - interval '87 minutes'),
    (c1, 'PARTNER_QUEUE', 'PARTNER_PROCESSING', partner_id, 'Operatör kuponu işleme aldı', now() - interval '85 minutes'),
    (c1, 'PARTNER_PROCESSING', 'PLATFORM_PREPARING', partner_id, 'Yetkili platform hazırlığı', now() - interval '84 minutes'),
    (c1, 'PLATFORM_PREPARING', 'SUBMITTED', partner_id, 'Yetkili entegrasyon ile iletildi', now() - interval '83 minutes'),
    (c1, 'SUBMITTED', 'ACCEPTED', partner_id, 'Platform kabul etti', now() - interval '82 minutes'),
    (c2, null, 'DRAFT', member_auth_id, 'Kupon oluşturuldu', now() - interval '15 minutes'),
    (c2, 'DRAFT', 'UPLOADED', member_auth_id, 'Orijinal kupon görseli yüklendi', now() - interval '12 minutes'),
    (c2, 'UPLOADED', 'MEMBER_APPROVED', member_auth_id, 'Üye kuponu onayladı', now() - interval '10 minutes'),
    (c2, 'MEMBER_APPROVED', 'PARTNER_QUEUE', null, 'Sistem: partner kuyruğuna alındı', now() - interval '10 minutes'),
    (c3, null, 'DRAFT', member_auth_id, 'Kupon oluşturuldu', now() - interval '27 hours'),
    (c3, 'DRAFT', 'UPLOADED', member_auth_id, 'Orijinal kupon görseli yüklendi', now() - interval '26 hours'),
    (c3, 'UPLOADED', 'MEMBER_APPROVED', member_auth_id, 'Üye kuponu onayladı', now() - interval '25 hours'),
    (c3, 'MEMBER_APPROVED', 'PARTNER_QUEUE', null, 'Sistem: partner kuyruğuna alındı', now() - interval '25 hours'),
    (c3, 'PARTNER_QUEUE', 'PARTNER_PROCESSING', partner_id, 'Operatör kuponu işleme aldı', now() - interval '24 hours'),
    (c3, 'PARTNER_PROCESSING', 'ACCEPTED', partner_id, 'Platform kabul etti', now() - interval '22 hours'),
    (c3, 'ACCEPTED', 'RESULT_PENDING', null, 'Sonuç bekleniyor', now() - interval '20 hours'),
    (c3, 'RESULT_PENDING', 'WON', partner_id, 'Platform sonucu: kazandı', now() - interval '3 hours'),
    (c3, 'WON', 'SETTLED', partner_id, 'Settlement tamamlandı', now() - interval '1 hour'),
    (c4, null, 'DRAFT', member_auth_id, 'Kupon oluşturuldu', now() - interval '45 minutes'),
    (c4, 'DRAFT', 'UPLOADED', member_auth_id, 'Orijinal kupon görseli yüklendi', now() - interval '40 minutes'),
    (c4, 'UPLOADED', 'MEMBER_APPROVED', member_auth_id, 'Üye kuponu onayladı', now() - interval '38 minutes'),
    (c4, 'MEMBER_APPROVED', 'PARTNER_QUEUE', null, 'Sistem: partner kuyruğuna alındı', now() - interval '38 minutes'),
    (c4, 'PARTNER_QUEUE', 'PARTNER_PROCESSING', partner_id, 'Operatör kuponu işleme aldı', now() - interval '36 minutes'),
    (c4, 'PARTNER_PROCESSING', 'PLATFORM_PREPARING', partner_id, 'Yetkili platform hazırlığı', now() - interval '35 minutes'),
    (c4, 'PLATFORM_PREPARING', 'ODDS_CHANGED', partner_id, 'Basılı oran 1.85 → güncel 1.78', now() - interval '34 minutes');

  -- Settlement + ledger (CPN-000125)
  insert into settlements (coupon_id, member_id, platform_reference, gross_result, partner_settlement,
    member_amount, currency, status, settlement_at)
  values (c3, member_id, 'PLT-DEMO-125', 842.00, 842.00, 842.00, 'TRY', 'COMPLETED', now() - interval '1 hour');

  insert into member_ledger (member_id, coupon_id, transaction_type, amount, currency, balance_after, reference_id, description, created_at)
  values
    (member_id, c3, 'BET_SETTLEMENT', 842.00, 'TRY', 842.00, 'STL-PLT-DEMO-125', 'CPN-000125 kupon kazancı', now() - interval '1 hour'),
    (member_id, c3, 'PAYOUT', -842.00, 'TRY', 0.00, 'PYT-PLT-DEMO-125', 'Üye ödemesi (partner mutabakatı)', now() - interval '55 minutes');

  -- Bildirimler
  insert into notifications (member_id, coupon_id, type, title, body, created_at) values
    (member_id, c2, 'PARTNER_QUEUED', 'Kuponunuz partner işlem sırasına alındı.', 'CPN-000124 yetkili partner operasyonuna iletildi.', now() - interval '10 minutes'),
    (member_id, c4, 'ODDS_CHANGED', 'Kuponunuzda oran değişikliği tespit edildi.', 'CPN-000126: basılı 1.85, güncel 1.78.', now() - interval '34 minutes'),
    (member_id, c1, 'COUPON_PROCESSED', 'Kuponunuz işlendi.', 'CPN-000123 platform tarafından kabul edildi.', now() - interval '82 minutes'),
    (member_id, c3, 'SETTLEMENT_DONE', 'Settlement tamamlandı.', 'CPN-000125 kazancı ledger hesabınıza işlendi.', now() - interval '1 hour');

  -- Audit örnekleri
  insert into audit_logs (actor_id, actor_role, action, entity_type, entity_id, after_data, created_at) values
    (member_auth_id, 'MEMBER', 'COUPON_MEMBER_APPROVED', 'coupon', c1, '{"status":"PARTNER_QUEUE"}', now() - interval '87 minutes'),
    (partner_id, 'PARTNER_ADMIN', 'PARTNER_COUPON_CLAIMED', 'coupon', c1, '{"status":"PARTNER_PROCESSING"}', now() - interval '85 minutes'),
    (partner_id, 'PARTNER_ADMIN', 'PARTNER_COUPON_VIEW', 'coupon', c4, '{"view":"detail"}', now() - interval '30 minutes'),
    (partner_id, 'PARTNER_ADMIN', 'SETTLEMENT_PROCESSED', 'coupon', c3, '{"member_amount":"842.00"}', now() - interval '1 hour');
end $$;

drop table if exists _seed_sha;

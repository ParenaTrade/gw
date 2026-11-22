# KUponum

Fiziksel İddaa kuponunun mobil kamera ile alındığı, üye kontrolü/onayı ile
yetkili partner operasyonuna iletildiği, tüm adımların zaman damgalı ve
denetlenebilir kaydedildiği merkezi kupon yönetim sistemi.

> **Sınır:** Gerçek para ile bahis/submit işlemi yalnızca ilgili platformun
> resmî izin verdiği entegrasyon yöntemi ve yetkili partner operasyonu
> kapsamında yapılabilir. Gizli bot, hesap paylaşımı, CAPTCHA/anti-bot
> atlatma veya yetkisiz otomasyon **geliştirilmez**.

## Mimari

- **Next.js 16 (App Router) + TypeScript + Tailwind v4** — mobil-first, PWA manifest.
- **Supabase hedef mimarisi**: `src/lib/supabase/{env,browser,server,middleware}.ts`,
  cookie tabanlı SSR session, RLS-first SQL migration'lar (`supabase/migrations/`).
- **Yerel çalışma modu**: Supabase env tanımlı değilse uygulama aynı şemayı
  yerel PostgreSQL + Drizzle ORM üzerinde çalıştırır (demo/preview). Auth
  (telefon+OTP, WebAuthn passkey), private görsel deposu ve yetkilendirme
  server-side uygulanır. Supabase env girildiğinde auth/storage Supabase'e geçer.
- **Durum makinesi**: `src/lib/coupons/status.ts` — 23 kanonik durum,
  geçersiz transition'lar service + DB transaction katmanında engellenir.
- **Idempotency**: onay `coupon_id + approval_version`; DB `idempotency_keys`.
- **Concurrency**: operatör claim `FOR UPDATE` + status guard (atomic).
- **Finans**: `numeric` kolonlar + bigint tabanlı `src/lib/money.ts`
  (HALF-UP, 2 ondalık). Settlement ayrı tablo, bakiye ledger'dan türetilir.
- **Güvenlik**: Zod giriş doğrulama, Origin/CSRF kontrolü, rate limit
  (bellek + OTP DB sayacı), hash'li session/OTP/IP, audit log'da PII maskeleme,
  private görsel servisi (public URL yok), WebAuthn'da yalnızca public key.

## Faz durumu

- **FAZ 1**: proje yapısı, Supabase env validator + client'lar, telefon+OTP
  auth, passkey (kayıt + giriş), üye profili, RLS migration'ları, kupon
  oluşturma, orijinal görsel yükleme, Kuponum ana ekranı, kupon detayı + onay
  + partner kuyruğu, partner paneli, audit, settlement/ledger görüntüleme.
- **FAZ 2 (bu teslimat)**: sharp görüntü işleme (orientation/kontrast/denoise,
  orijinal immutable), OCR hattı — `OCR_API_URL` PaddleOCR köprüsü veya yerel
  **tesseract.js (tur+eng)**, `ocr_results` kaydı, AI parser (OpenAI-uyumlu
  `AI_API_KEY`/`AI_API_URL`/`AI_MODEL`; anahtar yoksa deterministik kural
  tabanlı parser — veri uydurmaz), Zod şema doğrulaması, prompt versiyonlama
  (`coupon-parser-v1`), `after()` ile yanıt-sonrası job (Vercel timeout-safe),
  OCR_FAILED durumları ve tekrar deneme.
- **FAZ 3 (bu teslimat)**: üye satır düzenleme (PATCH bets), Türkçe karakter
  folding + canonical takım alias sözlüğü + fuzzy (tek başına karar vermez),
  genişletilebilir market sözlüğü, event matching (>=0.95 otomatik,
  0.80–0.95 manuel, <0.80 başarısız), oran değişimi snapshot'ları,
  NEEDS_REVIEW ↔ READY_FOR_MEMBER_APPROVAL akışı, decimal-safe toplam oran.
- FAZ 4: partner işleme akışının genişletilmesi.
- FAZ 5: `BettingPlatformAdapter` + `OneXBetAdapter` (yalnızca resmî API).
- FAZ 6: SettlementService + cron sonuç kontrolü (`CRON_SECRET`).
- FAZ 7: push bildirim, monitoring, production hardening.

## Giriş / Kayıt akışı (telefon + passkey)

Tek ekran, tek alan: **telefon numarası**.

1. Numara girilir → `POST /api/auth/identify` numaranın durumunu döner.
2. **Kayıtlı + passkey var** → parmak izi / Face ID / cihaz kilidi istenir, giriş yapılır.
3. **Kayıtsız** → ad soyad istenir → parmak izi ile passkey oluşturulur → üyelik + oturum
   tek transaction'da yaratılır (`/api/auth/passkey/signup/{options,verify}`).
4. **Kayıtlı ama passkey yok** (eski/seed hesap) → yalnızca demo modunda "Kodla Giriş" yedeği görünür.

OTP ve PIN yöntemleri sonradan tanımlanacak. Passkey doğrulaması `userVerification: required`
ile yapılır; ham biyometrik veri sunucuya hiç gelmez, yalnızca credential public key saklanır.

> ⚠️ Telefon sahipliği henüz doğrulanmıyor (SMS/OTP yok): kayıtsız bir numarayı ilk giren
> kişi o numarayı alır. OTP/PIN eklenince numara doğrulaması da eklenmelidir.

Veritabanı: `supabase/migrations/011_passkey_auth.sql` (auth_identities, auth_sessions,
member_credentials, auth_challenges, auth_otps) uygulanmalıdır. Bu migration ayrıca
`profiles`/`members` tablolarındaki `auth.users` FK'lerini kaldırır. Partner/operatör rolü
için ilgili kullanıcının `profiles.role` değeri SQL ile güncellenir.

## Demo hesaplar (seed)

| Rol | Telefon | Not |
| --- | --- | --- |
| Üye | +90 555 111 22 33 | 4 örnek kupon (Oynandı, Kuyruk, Settled, Oran Değişti) |
| Partner | +90 555 999 00 00 | PARTNER_ADMIN — panel, claim, audit |

SMS sağlayıcısı yokken OTP **demo modunda** ekranda gösterilir
(`OTP_DEV_MODE=false` + `SMS_API_KEY` ile kapanır).

## Kurulum

```bash
npm install
cp .env.example .env            # DATABASE_URL yerel mod için yeterli
npx drizzle-kit push            # yerel şema
# demo verisi:
SHA=$(sha256sum storage/coupon-images/members/11111111-1111-4111-8111-111111111111/coupons/c0000001-0000-4000-8000-000000000001/original-seed.jpg | cut -d' ' -f1)
psql "$DATABASE_URL" -v sha="$SHA" -f scripts/seed.sql
npm run dev
```

## Supabase + Vercel dağıtımı

1. `supabase/migrations/001..011` sırayla uygulanır (idempotent, RLS + private
   `coupon-images` bucket + storage policy'leri dahil).
2. Vercel env: `DATABASE_URL` (Supabase pooler), `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon JWT veya `sb_publishable_*`) ve görsel
   yükleme için sunucu tarafı `SUPABASE_SERVICE_ROLE_KEY` (asla `NEXT_PUBLIC_*`).
3. Development / Preview / Production Supabase projeleri **ayrı** tutulur.
4. `AUTH_COOKIE_SECURE=true`, güçlü `AUTH_PEPPER`, `WEBAUTHN_RP_ID`/`ORIGIN`,
   `OTP_DEV_MODE=false` + SMS sağlayıcısı.
5. Uzun OCR/AI işleri Vercel request timeout'u nedeniyle Faz 2'de job/queue
   (Supabase Edge Function + worker) olarak ayrılır.

## Sorun giderme

`https://<alan-adiniz>/api/health` kurulum teşhisi verir (şifre/adres asla gösterilmez):
`DATABASE_URL_MISSING`, `IPV6_UNREACHABLE` (pooler adresi kullanın), `AUTH_FAILED`,
`POOLER_USER_INVALID`, `TABLES_MISSING` (eksik tablolar listelenir) gibi bir `reason` ve `hint` döner.

## Test

```bash
npx vitest run        # durum makinesi, env validator, money, zod, KVKK
npx next typegen
npm exec tsc -- --noEmit
npm run build
```

RLS/security notları: üye A → üye B kupon erişimi, member → partner endpoint,
storage public erişim ve çift submit senaryoları server-side owner/role
guard + idempotency + RLS politikalarıyla engellenir (bkz. `008_rls.sql`,
`src/lib/security/api.ts`, `src/lib/coupons/service.ts`).

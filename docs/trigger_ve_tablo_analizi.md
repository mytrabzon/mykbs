# Trigger ve Tablo Çakışma / Gereksiz Tekrar Analizi

## 1. Trigger çakışmaları – aynı işi yapan fonksiyonlar

Üç farklı migration'da **aynı mantıkta** (UPDATE'te `updated_at = now()`) üç ayrı fonksiyon tanımlanmış:

| Migration | Fonksiyon | Tablo | İş |
|-----------|-----------|-------|-----|
| `0002_mykbs_community_admin.sql` | `set_updated_at()` | posts | NEW.updated_at = now(); RETURN NEW; |
| `0006_kbs_outbox_and_branch_kbs.sql` | `touch_updated_at()` | kbs_outbox | Aynı |
| `0014_kyc_verification_tables.sql` | `set_verification_sessions_updated_at()` | verification_sessions | Aynı |

**Sonuç:** Çakışma yok (aynı tabloya iki trigger yok), ama **gereksiz kod tekrarı** var. Tek bir genel fonksiyon (örn. `public.set_updated_at()`) kullanılıp üç trigger da buna bağlanabilir.

**Öneri:** Yeni migration ile:
- `set_updated_at()` tek kalacak (veya `touch_updated_at()` hepsinde kullanılacak).
- `touch_updated_at()` ve `set_verification_sessions_updated_at()` kaldırılıp ilgili trigger'lar `set_updated_at()` ile yeniden tanımlanacak.

---

## 2. Tablo çakışmaları

### profiles vs user_profiles
- **profiles** (0011): `auth.users` ile 1:1. Alanlar: `is_admin`, `privacy_policy_accepted_at`, `terms_of_service_accepted_at`, `deletion_requested_at`, `updated_at`. Global bayraklar.
- **user_profiles** (0001): Kullanıcı–şube eşlemesi. Alanlar: `user_id`, `branch_id`, `role`, `display_name`, `approval_status`, vb.

**Sonuç:** Çakışma yok. Farklı amaç: biri global auth bayrakları, diğeri şube/rol/onay.

### user_push_tokens vs push_registrations
- **user_push_tokens** (0003): Supabase auth (`user_id`) + Expo token. Edge `push_register_token` yazar; `push_dispatch` **sadece bu tabloyu** okuyor.
- **push_registrations** (0012): Backend JWT (`user_identifier` = Prisma/app user id) + Expo token. Backend `POST /push/register` yazar.

**Sonuç:** Aynı iş (push token saklama) iki farklı auth kaynağı için. Çakışma yok; tasarım gereği çift kaynak. Dokümantasyonda belirtildiği gibi: backend-only giriş yapan kullanıcıların token'ı `push_registrations`'ta, `push_dispatch` ise sadece `user_push_tokens` kullandığı için bu kullanıcılara bildirim gitmiyor. Bu bir tutarsızlık, tablo çakışması değil.

---

## 3. Özet

| Konu | Durum | Aksiyon |
|------|--------|---------|
| updated_at trigger fonksiyonları (3 adet) | Aynı iş, gereksiz tekrar | Tek fonksiyonda birleştirilebilir (opsiyonel migration) |
| profiles / user_profiles | Farklı amaç | Değişiklik yok |
| user_push_tokens / push_registrations | Farklı auth, bilinçli çift kaynak | push_dispatch’i push_registrations’ı da okuyacak şekilde genişletmek dokümante edilmiş iyileştirme |

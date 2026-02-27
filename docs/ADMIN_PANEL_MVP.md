# Admin Panel MVP — Uygulama Planı

Vizyon dokümanı: [ADMIN_PANEL_VISION.md](./ADMIN_PANEL_VISION.md).

---

## 1. Backend Admin API (Tek Katman)

**Hedef**: Panel hiçbir yerde doğrudan Supabase/DB’ye bağlanmasın; tüm istekler backend’e gitsin. Auth: Supabase `profiles.is_admin` veya `app_roles.role = 'admin'` (mevcut `appAdmin` middleware).

**Base path**: `/api/app-admin` (mevcut) veya `/api/admin` (tek token ile hem panel hem mobil). Mevcut panel `admin_token` ile farklı bir endpoint kullanıyorsa, paneli **Supabase JWT** ile `/api/app-admin` kullanacak şekilde geçirmek tutarlı olur.

### MVP Endpoint Listesi

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/app-admin/dashboard` | Genişletilmiş KPI (online, aktif, yeni kayıt, pending identity, pending KBS, ödeme/ciro, hata oranı, fraud count) |
| GET | `/api/app-admin/events/stream` | SSE ile canlı olay akışı (MVP: son N olay poll/SSE) |
| GET | `/api/app-admin/users` | Liste: search, filtre (kayıt bugün, ödeme yapan, hata, kimlik pending, risk high) |
| GET | `/api/app-admin/users/:id` | Kullanıcı detay (Overview + Identity + Payments + KBS + Errors + Audit sekmeleri için veri) |
| POST | `/api/app-admin/users/:id/freeze` | Kullanıcıyı dondur (body: reason) |
| POST | `/api/app-admin/users/:id/disable` | Kullanıcıyı devre dışı bırak (body: reason) |
| POST | `/api/app-admin/users/:id/force-logout` | Tüm cihazlardan çıkış |
| GET | `/api/app-admin/requests` | KBS tesis talepleri (mevcut) |
| POST | `/api/app-admin/requests/:id/approve` | Onayla (mevcut) |
| POST | `/api/app-admin/requests/:id/reject` | Reddet (mevcut) |
| POST | `/api/app-admin/notifications/send` | Bildirim gönder (payload: title, body, image?, target: all \| segment \| list) |
| GET | `/api/app-admin/identity/pending` | Bekleyen kimlik/pasaport listesi |
| POST | `/api/app-admin/identity/:id/approve` | Kimlik onayla |
| POST | `/api/app-admin/identity/:id/reject` | Kimlik reddet (body: reason) |
| GET | `/api/app-admin/audit` | Admin audit log listesi (filtre: action, target_user_id, admin_id, tarih) |
| GET | `/api/app-admin/payments` | Ödeme listesi (MVP: stub veya mevcut veri) |

Tüm mutasyonlarda **audit log** yazılmalı: admin_id, action, target_user_id, payload, reason, timestamp, ip/user-agent.

---

## 2. Veri Modeli Gereksinimleri

- **Admin audit log**: Admin aksiyonları için ayrı tablo veya mevcut `audit_logs` (Supabase) / `AuditLog` (Prisma). Prisma’daki `AuditLog` tesis odaklı; admin aksiyonları için ya Supabase’de `admin_audit_log` ya da Prisma’da `AdminAuditLog` (admin_id, action, target_user_id, payload, reason, ip, user_agent).
- **Kullanıcı durumu**: Freeze/Disable için Supabase `profiles` veya `app_roles` veya ayrı `user_status` tablosu (frozen, disabled, deleted_at).
- **Bildirim okundu**: `notification_reads` (notification_id, user_id, read_at) — in_app_notifications zaten read_at içerebilir; kampanya bildirimleri için ayrı tablo gerekebilir.
- **Olay akışı**: MVP için mevcut tablolardan türet (login, identity, payment, kbs_request, app_error). İleride ayrı `admin_events` tablosu + trigger’lar.

---

## 3. Admin Panel (Next.js) Yapısı

### 3.1 Layout

- **Sol sidebar**: Logo + Dashboard, Canlı Akış, Kullanıcılar, Kimlik & Pasaport, Paketler & Ödemeler, Tesis/KBS Talepleri, Bildirim & Duyurular, Raporlar, Ayarlar, Audit Log. Koyu tema varsayılan.
- **Üst bar**: Global arama (kullanıcı/telefon/email), Komut Paleti tetikleyici (Ctrl+K), bildirim ikonu, kullanıcı menüsü.
- **Komut Paleti**: Ctrl+K ile açılır; “User: 905…”, “Freeze”, “Send notice” gibi aksiyonlar. MVP’de arama + hızlı sayfa geçişi yeterli.

### 3.2 Sayfa Rotaları (MVP)

| Route | İçerik |
|-------|--------|
| `/` | Dashboard (8 KPI + son olaylar + alarmlar) |
| `/live` | Canlı Ops (SSE feed + hızlı aksiyonlar) |
| `/users` | Kullanıcı listesi (filtre, arama) |
| `/users/[id]` | Kullanıcı detay (sol kart + orta sekmeler + sağ mini feed) |
| `/identity` | Kimlik kuyruğu (pending, approve/reject) |
| `/payments` | Ödeme listesi (MVP: basit liste) |
| `/tesisler` veya `/kbs-requests` | KBS talepleri (mevcut requests + approve/reject) |
| `/notifications` | Bildirim composer + geçmiş + okundu istatistikleri |
| `/audit` | Audit log (filtre + export CSV) |
| `/settings` | Ayarlar (MVP: placeholder) |
| `/login` | Giriş (Supabase veya token) |

### 3.3 Tasarım

- Renk: gri (beklemede), yeşil (onaylı), sarı (uyarı), kırmızı (acil/fraud). Mevcut `globals.css` (--kbs-*) ile uyumlu.
- KPI kartları: büyük sayı, ikon, kısa etiket.
- Tablolar: kompakt, sıralanabilir, filtre çubukları.

---

## 4. Uygulama Sırası (Öneri)

1. **Backend**
   - Dashboard cevabını genişlet (online, aktif, yeni kayıt, pending identity/KBS, ödeme/ciro, hata, fraud — mümkün olanlar Prisma/Supabase’den).
   - Admin audit log tablosu (Prisma veya Supabase migration) + her mutasyonda kayıt.
   - `GET/POST /api/app-admin/users`, `GET /api/app-admin/users/:id`, freeze/disable/force-logout (Supabase/auth + profiles veya app_roles ile).
   - `GET /api/app-admin/audit` + filtre.
   - `GET /api/app-admin/events/stream` (SSE, son olaylar).
   - Identity pending / approve / reject (KycVerification veya Supabase documents).
   - Notifications send (mevcut notification_outbox / push + in_app).

2. **Admin Panel**
   - Layout: sidebar + top bar + command palette (Ctrl+K).
   - Dashboard sayfası: yeni KPI seti + API’den veri.
   - Kullanıcı listesi + detay sayfası (sekme iskeleti).
   - KBS talepleri sayfası (mevcut API’ye bağla).
   - Bildirim composer + okundu sayacı (API hazır olunca).
   - Audit log sayfası (filtre + CSV export).

3. **Auth**
   - Panel girişini Supabase ile yap; token’ı `api` interceptor’da `Authorization: Bearer <supabase_access_token>` olarak kullan; base URL’i backend’in `/api/app-admin` path’ine ayarla.

---

## 5. Kısa Özet

- **Tek API katmanı**: Backend `/api/app-admin/*`, auth = Supabase admin veya app_roles.
- **Panel**: Sidebar + üst bar + Ctrl+K, dark default, tüm veri backend’den.
- **MVP**: Dashboard KPI, Live feed, Kullanıcı listesi/detay, freeze/disable/force-logout, KBS queue, Bildirim composer, Audit log.
- **Full**: Fraud motoru, refund otomasyonu, segmentasyon, video bildirim, device/IP ban, A/B duyuru.

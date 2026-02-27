# Admin Panel Ürün Vizyonu

Bu belge admin panelinin hedeflerini, tasarım sistemini ve ekran özelliklerini tanımlar.

---

## 1. Ana Hedefler

| Hedef | Açıklama |
|-------|----------|
| **Tek bakışta durum** | “Şu an ne oluyor?” — Dashboard KPI + canlı akış |
| **Anında müdahale** | Kullanıcı dondur, sil, kilitle, cihazdan at, işlem iptal et |
| **Ödeme & paket** | Kim ödeme yaptı, ne aldı, iade, fraud |
| **Kimlik/pasaport akışı** | Kim ne bildirdi, hangi aşamada, neden hata aldı |
| **Bildirim/duyuru** | Tüm kullanıcılara veya segmente push / in-app |
| **Olay/Alarm** | Panel açıkken anlık bildirim + panel kapalıyken push/mail (opsiyon) |

---

## 2. Tasarım Sistemi

- **Görsel dil**: Dark + Light (varsayılan: dark). KPI kartları büyük ve net.
- **Layout**: Sol sidebar + üst bar (arama + komut paleti).
- **Renk semantiği**:
  - Gri: beklemede
  - Yeşil: onaylı / sağlıklı
  - Sarı: uyarı / risk
  - Kırmızı: acil / ban / fraud

### Navigasyon (Sidebar)

- Dashboard
- Canlı Akış (Live Ops)
- Kullanıcılar
- Kimlik & Pasaport
- Paketler & Ödemeler
- Tesis/KBS Talepleri
- Bildirim & Duyurular
- Raporlar
- Ayarlar
- Audit Log

**Komut Paleti**: `Ctrl+K` → “User: 905…”, “Freeze”, “Send notice” vb. hızlı işlem.

---

## 3. Dashboard (Tek Bakış)

### Üst KPI satırı (8 kart)

1. Online kullanıcı (son 5 dk)
2. Aktif kullanıcı (son 24 saat)
3. Yeni kayıt (bugün)
4. Bekleyen kimlik/pasaport (pending)
5. Bekleyen tesis onayı (pending)
6. Bugünkü ödeme sayısı / ciro
7. Hata oranı (son 1 saat)
8. Fraud risk flag sayısı

### Orta bölüm

- Son 60 dk olay grafiği (login, ödeme, hata, kimlik upload)
- En çok hata veren endpoint/ekran listesi

### Sağ panel (sticky)

- Acil Alarmlar (örn. “KBS login failed spike”, “Payment webhook failures”, “Identity upload errors”)

---

## 4. Canlı Ops (Live Ops)

- **Live Event Feed**: Gerçek zamanlı olaylar  
  `user_registered`, `login_success` / `login_failed`, `identity_submitted` / `approved` / `rejected`, `payment_succeeded` / `payment_failed` / `chargeback`, `kbs_request_created` / `approved` / `rejected`, `app_error`.
- Her olay kartında: kullanıcı adı + foto, olay türü, zaman, hızlı aksiyon (Aç / Dondur / Ban / İncele).
- **Alarm kuralları**: Aynı hatadan 10 dk’da > X adet; ödeme başarısız oranı > %Y; kimlik kuyruğu > N. Panel açıkken toast + ses; panel kapalıyken admin push (opsiyon).

---

## 5. Kullanıcı Yönetimi

### Liste (tablo)

Kolonlar: Profil foto, Ad Soyad, Telefon/Email, Kayıt tarihi, Son giriş, Durum (Active/Frozen/Disabled/Deleted), Paket, Risk, Kimlik durumu.  
Filtreler: Bugün kayıt, Ödeme yapanlar, Hata yaşayanlar, Kimlik pending, Risk high.  
Arama: telefon, email, userId, isim.

### Kullanıcı detay (6 sekme)

| Sekme | İçerik |
|-------|--------|
| **(A) Overview** | Profil foto, ad soyad, email/telefon, kayıt/son aktiflik, cihazlar, paket, durum rozetleri. Hızlı aksiyonlar: Freeze, Disable, Force Logout, Delete (soft), Reset flags, Grant admin. |
| **(B) Kimlik & Pasaport** | Kaç doküman, son yüklenenler, durum, hata kayıtları. Admin: approve/reject + sebep. |
| **(C) Paket & Ödemeler** | Satın alınan paketler, tarih/tutar/ödeme yöntemi/fatura, refund/chargeback. Admin: refund. |
| **(D) Tesis/KBS** | Onaylı tesis (masked), bekleyen talepler, KBS hata logları. |
| **(E) Hatalar & Crash** | Son 50 hata (screen, endpoint, device, timestamp). Admin notu, “bu hatayı yaşayan kullanıcı sayısı”. |
| **(F) Audit Timeline** | Bu kullanıcıyla ilgili tüm admin aksiyonları (kim, ne, ne zaman, neden). |

**Layout önerisi**: Sol profil + aksiyonlar (sticky), orta sekmeler, sağ “Son olaylar” mini feed (sticky).

---

## 6. Kimlik & Pasaport Yönetimi

- Kuyruk: Pending doğrulamalar, thumbnail + metadata, Approve/Reject + reject reason, Escalate.
- Kurallar: 3 kez rejected → risk high; şüpheli doküman → freeze.

---

## 7. Paketler & Ödemeler (FinOps)

- Ekranlar: Transaction list, abonelikler/paketler, promosyon/kupon, refund/chargeback.
- Liste: user, paket, tutar, durum, provider, created_at.
- Aksiyonlar: transaction detayı (receipt/provider response), refund, kullanıcıyı fraud risk işaretle.

---

## 8. Bildirim & Duyuru

- **Türler**: Push, In-app Inbox, Banner/Modal (zorunlu).
- **Composer**: Başlık, mesaj, görsel, video (opsiyon), CTA (deeplink / store link).
- **Hedef**: Tümü, ödeme yapanlar, pending kimlik, belirli branch/paket, custom list (UID/phone).
- **Okundu sayacı**: `notification_reads`; admin’de gönderilen / delivered / opened / okunma oranı. “Sayaç sıfırlama” = kullanıcı unread counter reset.
- **Zorunlu duyuru**: Forced modal (az kullan).

---

## 9. Güvenlik Müdahaleleri

- Freeze, Disable, Rate limit, Device ban, IP block (opsiyon), Rollback (işlem iptali).
- Fraud panel: şüpheli davranışlar (aynı cihazdan çok hesap, hızlı kimlik/ödeme denemesi).

---

## 10. Audit Log

Her admin aksiyonu: `admin_id`, `action`, `target_user_id`, `payload` (before/after), `reason`, `timestamp`, `ip`/`user-agent`.  
UI: Filtrelenebilir, export CSV.

---

## 11. Teknik Mimari

- **Admin panel direkt DB’ye bağlanmaz;** tüm işlemler **backend Admin API** üzerinden.
- Örnek endpoint’ler:  
  `GET /admin/dashboard`, `GET /admin/events/stream` (SSE/WebSocket), `GET/POST /admin/users`, `POST /admin/users/:id/freeze|disable|force-logout`, `POST /admin/notifications/send`, `GET /admin/payments`, `GET /admin/identity/pending`, `POST /admin/identity/:id/approve|reject`.
- Gerçek zamanlı: Panel açıkken SSE/WebSocket; panel kapalıyken admin push (opsiyon).

---

## 12. MVP vs Full

| MVP | Full (sonraki faz) |
|-----|---------------------|
| Dashboard KPI | Fraud risk motoru |
| Live Ops feed + alarm toast | Refund/chargeback otomasyonu |
| Kullanıcı listesi + detay + freeze/disable/force logout | Advanced segmentation |
| Tesis/KBS request queue + approve/reject | Video bildirim |
| Bildirim composer (text + image) + okundu sayacı | Device/IP ban |
| Audit log | A/B duyuru |

---

## 13. Mevcut Durum (Projede)

- **Backend**: `appAdmin.js` — Supabase/admin JWT ile yetki; `/dashboard`, `/requests`, `/requests/:id/approve`, `/requests/:id/reject`.  
  `admin.js` — ADMIN_SECRET ile tesis odaklı dashboard, tesisler, giriş talepleri.
- **Admin panel (Next.js)**: Dashboard (tesis/bildirim/kota), Tesisler, Kullanıcılar (Edge Function), KBS Bildirimleri, Audit, Topluluk. API: `NEXT_PUBLIC_API_URL` + `admin_token` (login’de set).
- **Supabase**: `profiles.is_admin`, `app_roles`, `facility_credentials_requests`, `facility_credentials`, `in_app_notifications`, `notification_outbox`, `audit_logs` (branch/tesis odaklı).
- **Prisma**: Tesis, Kullanici (tesis kullanıcısı), Bildirim (KBS), Log, Hata, AuditLog (tesis), KycVerification.

Vizyonla hizalama için backend’te tek bir “Admin API” katmanı (ör. `/api/app-admin/*` veya `/api/admin/*` + Supabase/admin auth), panelde sidebar + komut paleti + yeni sayfalar ve audit log’un admin aksiyonları için genişletilmesi önerilir.

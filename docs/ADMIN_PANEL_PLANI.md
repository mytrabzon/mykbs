# MyKBS Admin Paneli – Detaylı Plan (Buton Odaklı)

Bu dokümanda uygulamanın **tüm kullanıcıları ve tüm özellikleri yönetecek** admin paneli, her detay için **net butonlar ve aksiyonlarla** planlanmıştır. Güvenlik, kullanıcı deneyimi, müdahaleler ve satış takibi dahildir.

---

## 1. Genel Bakış

| Bölüm | Amaç | Ana butonlar |
|-------|------|--------------|
| Dashboard | Özet, KPIs | **Yenile**, **Rapor indir (Excel)** |
| Kullanıcılar | Tüm kullanıcı yönetimi | **Ara**, **Filtrele**, **Dondur**, **Devre dışı bırak**, **Zorla çıkış**, **Detay** |
| Tesisler | Tesis onay, paket, kota | **Onayla**, **Reddet**, **Yeni şifre**, **Paket değiştir**, **Loglar**, **Hatalar** |
| KBS Talepleri | Tesis kodu/şifre onayı | **Onayla**, **Reddet** |
| Paketler & Ödemeler | Satış ve ödeme takibi | **Satış listesi**, **İade**, **Paket fiyat düzenle**, **Manuel paket ata** |
| Bildirim & Duyurular | Push / in-app duyuru | **Gönder**, **Zamanla**, **Şablon kaydet** |
| Raporlar | İstatistik, export | **Tarih seç**, **İndir (Excel/PDF)** |
| Ayarlar | Panel ve uygulama ayarları | **Kaydet**, **Sıfırla** |
| Audit Log | Tüm admin aksiyonları | **Filtrele**, **Export** |
| Kimlik & Pasaport | KYC / MRZ durumları | **Onayla**, **Reddet**, **Detay** |
| Canlı Akış | Anlık olaylar | **Yenile**, **Filtre** |

---

## 2. Dashboard

**Sayfa:** `/` (admin-panel)

### Kartlar (her biri tıklanabilir / detay sayfasına gidebilir)
- Toplam tesis sayısı → **[Tesislere git]**
- Aktif tesis sayısı → **[Aktif tesisleri listele]**
- Paket dağılımı (deneme, starter, pro, business, enterprise) → **[Paket bazlı filtrele]**
- Günlük bildirim sayısı → **[Bildirim raporu]**
- Günlük hata sayısı → **[Hata listesi]**
- Kota aşımı yapan tesisler → **[Kota aşan tesisler]**

### Butonlar
- **Yenile** – Dashboard verilerini tekrar çek.
- **Rapor indir (Excel)** – Özet KPIs’ı Excel’e aktar.

---

## 3. Kullanıcılar

**Sayfa:** `/users`, **Detay:** `/users/[id]`

### Liste sayfası
- **Ara** – Email / telefon ile arama (input + **Ara** butonu).
- **Filtrele** – Kayıt tarihi, son giriş, durum (aktif / dondurulmuş / devre dışı).
- Tablo: ID, Email, Telefon, Son giriş, Kayıt, **İşlem**.
- Her satır:
  - **Detay** – Kullanıcı detay + aktivite logu.
  - **Dondur** – Hesabı dondur (sebep alanı + **Onayla**).
  - **Devre dışı bırak** – Ban (sebep + **Onayla**).
  - **Zorla çıkış** – Tüm cihazlardan çıkış (**Onayla**).

### Kullanıcı detay sayfası (`/users/[id]`)
- Kullanıcı bilgileri (email, telefon, kayıt, son giriş).
- **Dondur** / **Devre dışı bırak** / **Zorla çıkış** (aynı aksiyonlar).
- **Aktivite / Audit log** tablosu – **Filtrele** (tarih, işlem tipi), **Export**.

---

## 4. Tesis Listesi

**Sayfa:** `/tesisler`, **Detay:** `/tesisler/[id]`

### Liste
- **Filtrele** – Paket, durum (incelemede, onaylandi, aktif, pasif), şehir.
- **Yenile** – Listeyi güncelle.
- Her satır: Tesis adı, kod, paket, kota, durum, **Detay** butonu.

### Tesis detay
- Tesis bilgileri, KBS durumu, paket, kota.
- **Onayla** – Tesis kaydını/aktivasyonu onayla.
- **Reddet** – Reddet (opsiyonel sebep).
- **Yeni şifre oluştur** – KBS web servis şifresi için yeni şifre üret ve göster.
- **Paket değiştir** – Paket seç (deneme, starter, pro, business, enterprise) + kota; **Kaydet**.
- **Loglar** – Tesis işlem logları (sayfalama + **Yenile**).
- **Hatalar** – Tesis hata listesi (durum filtresi + **Yenile**).

---

## 5. KBS Tesis Bilgisi Talepleri

**Kaynak:** `facility_credentials_requests` (Supabase) + uygulama içi admin / app-admin API.

### Liste (pending)
- **Yenile** – Bekleyen talepleri getir.
- Her talep: Kullanıcı, tesis kodu, aksiyon (create/update/delete), tarih.
- **Onayla** – Talebi onayla (credentials güncelle/ekle).
- **Reddet** – Reddet (**Sebep gir** + **Gönder**).

---

## 6. Paketler & Ödemeler (Satış Takibi)

**Sayfa:** `/payments`

### Alt bölümler ve butonlar

#### 6.1 Paket tanımları
- Mevcut paketler: Starter, Pro, Business, Enterprise (kredi + fiyat).
- **Fiyat düzenle** – Paket seç → Fiyat/kredi düzenle → **Kaydet**.
- **Yeni paket ekle** (opsiyonel) – **Ekle** → form → **Kaydet**.

#### 6.2 Satış listesi (işlemler)
- Tablo: Tarih, Tesis/Kullanıcı, Paket, Tutar, Durum (ödendi, bekliyor, iade).
- **Filtrele** – Tarih aralığı, paket, durum.
- **Yenile** – Listeyi güncelle.
- **Excel’e aktar** – Seçilen filtreyle export.

#### 6.3 İade / Chargeback
- Satır seç → **İade başlat** (sebep + **Onayla**).
- **Chargeback listesi** – Chargeback alan işlemler; **Not ekle**, **Kapat**.

#### 6.4 Manuel işlemler
- **Manuel paket ata** – Tesis seç → Paket seç → **Ata** (ödeme olmadan paket verme, promosyon vb.).

---

## 7. Bildirim & Duyurular

**Sayfa:** `/notifications`

- **Push bildirim gönder** – Hedef (tümü / tesis / paket), başlık, metin → **Gönder**.
- **Zamanla** – Gönderim tarihi/saati seç → **Zamanla**.
- **Şablon kaydet** – Mevcut metni şablon olarak kaydet → **Kaydet**.
- Geçmiş gönderimler tablosu – **Yenile**, **Filtrele**.

---

## 8. Raporlar

**Sayfa:** `/reports`

- **Tarih aralığı seç** – Başlangıç / Bitiş → **Uygula**.
- Rapor türü: Kullanıcı artışı, tesis artışı, paket satışları, bildirim kullanımı, hata sayıları.
- **İndir (Excel)** – Seçilen rapor.
- **İndir (PDF)** – Özet rapor (grafik + tablo).

---

## 9. Ayarlar

**Sayfa:** `/settings`

- Panel ayarları (dil, tema, sayfa başına kayıt).
- **Kaydet** – Ayarları kaydet.
- **Sıfırla** – Varsayılana dön.
- Uygulama genel ayarları (deneme süresi, varsayılan kota) – **Kaydet**.

---

## 10. Audit Log

**Sayfa:** `/audit`

- Tüm admin aksiyonları (kim, ne zaman, ne yaptı, hedef).
- **Filtrele** – Tarih, admin, aksiyon tipi, hedef kullanıcı/tesis.
- **Yenile** – Listeyi güncelle.
- **Export** – CSV/Excel.

---

## 11. Kimlik & Pasaport (KYC)

**Sayfa:** `/identity`

- KYC doğrulama talepleri (MRZ/NFC roadmap).
- Liste: Kullanıcı, tip, son 4 hane, durum.
- **Onayla** – Doğrula.
- **Reddet** – Reddet (sebep).
- **Detay** – Tam kayıt detayı.

---

## 12. Canlı Akış

**Sayfa:** `/live`

- Son olaylar (giriş, bildirim, hata, paket değişimi).
- **Yenile** – Son N kayıt.
- **Filtre** – Olay tipi, tesis.

---

## 13. Güvenlik Özeti

- Tüm admin istekleri: **Bearer token** (Supabase veya backend JWT) veya **ADMIN_SECRET**.
- Admin yetkisi: `profiles.is_admin`, `app_roles.role = 'admin'`, veya `ADMIN_KULLANICI_ID`.
- Hassas işlemler (dondur, ban, zorla çıkış, paket atama): Audit log’a yazılmalı.
- Panel girişi: **Çıkış** butonu ile token silinir ve login sayfasına yönlendirilir.

---

## 14. Uygulama İçi Admin (Mobil)

Mobil uygulamadaki Admin sekmesi:

- **Dashboard** – Özet (tesis, paket dağılımı, kota aşımı) → **Yenile**.
- **KBS Talepleri** – Bekleyen talepler → **Onayla** / **Reddet** (sebep ile).

İleride mobil admin’e eklenebilecek butonlar: **Kullanıcı ara**, **Tesis onay**, **Son satışlar** (read-only).

---

## 15. Özet – Tüm Butonlar Listesi

| Sayfa / Bölüm | Butonlar |
|---------------|----------|
| Dashboard | Yenile, Rapor indir (Excel), Tesislere git, Aktif tesisler, Paket filtrele, Bildirim raporu, Hata listesi, Kota aşan tesisler |
| Kullanıcılar | Ara, Filtrele, Detay, Dondur, Devre dışı bırak, Zorla çıkış, Export |
| Kullanıcı detay | Dondur, Devre dışı bırak, Zorla çıkış, Filtrele (audit), Export |
| Tesisler | Filtrele, Yenile, Detay, Onayla, Reddet, Yeni şifre, Paket değiştir, Kaydet, Loglar, Hatalar |
| KBS Talepleri | Yenile, Onayla, Reddet, Sebep gönder |
| Paketler & Ödemeler | Fiyat düzenle, Kaydet, Yeni paket ekle, Filtrele, Yenile, Excel’e aktar, İade başlat, Chargeback listesi, Manuel paket ata |
| Bildirim & Duyurular | Gönder, Zamanla, Şablon kaydet, Yenile, Filtrele |
| Raporlar | Tarih seç, Uygula, İndir (Excel), İndir (PDF) |
| Ayarlar | Kaydet, Sıfırla |
| Audit Log | Filtrele, Yenile, Export |
| Kimlik & Pasaport | Onayla, Reddet, Detay |
| Canlı Akış | Yenile, Filtre |

Bu plan, mevcut `admin-panel` ve `appAdmin` API’leriyle uyumludur; eksik butonlar ve sayfalar kademeli eklenebilir.

---

## 16. Paketleri Nasıl Satacaksınız? (Satın Al Akışı)

Uygulamada şu an **satın al butonu** yok; PaywallModal'da "Seç" sadece modalı kapatıyor. Aşağıdaki akış ile paket satışı ve takibi mümkün.

### 16.1 Akış seçenekleri

| Yöntem | Açıklama | Buton davranışı |
|--------|----------|------------------|
| **A) Sipariş + Manuel** | Kullanıcı Satın Al → sipariş (pending) → Admin **Paket ata**. | **Satın Al** → "Siparişiniz alındı" + sipariş no |
| **B) Web ödeme** | Satın Al → Ödeme linki (Iyzico/Stripe) → Webhook ile paket. | **Satın Al** → Web/WebView |
| **C) IAP** | Mağaza üzerinden. | **Satın Al** → Native IAP |

Öneri: Önce **A** ile başlayın; sonra **B** ekleyin.

### 16.2 Uygulamada yapılanlar

1. **Mobil PaywallModal**: "Seç" → **Satın Al**; sipariş isteği → sipariş no + bilgi metni.
2. **Backend**: `Siparis` tablosu + `POST /api/siparis` + `GET /api/app-admin/satislar`.
3. **Admin /payments**: Satış listesi, **Ödeme alındı işaretle**, **Paket ata** butonları.

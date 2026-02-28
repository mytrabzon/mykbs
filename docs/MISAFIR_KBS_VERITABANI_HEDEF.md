# Misafir / KBS Hedef Veritabanı Şeması

Bu doküman, “KBS payload” ile “otel içi profil” ayrımına dayalı hedef şemayı özetler. Mevcut Prisma şeması (Tesis, Kullanici, Oda, Misafir, Bildirim) ile uyumlu genişleme önerilir.

---

## 1. Hedef tablolar (özet)

| Tablo | Amaç |
|-------|------|
| **hotels** | Mevcut `Tesis` ile eşleştirilebilir. |
| **hotel_staff** | hotel_id, user_id, role (owner \| manager \| staff), can_view_photos. |
| **guests** | Otel içi profil: display_name, photo_url, identity_hash (HMAC), expires_at (30 gün). |
| **stays** | Konaklama: room_no, check_in_at, check_out_at, usage_type, kbs_status, guest_id (nullable). |
| **kbs_submissions** | KBS’ye giden audit: payload_json, response_code, correlation_id. |

---

## 2. Zorunlu alanlar (KBS)

- **T.C. vatandaşı:** tc_kimlik_no (11 hane + checksum).
- **YKN:** ykn.
- **Yabancı:** passport_no, country.
- **Ortak:** Ad, Soyad, Doğum tarihi, Ülke, Oda no, Giriş tarihi, Kullanım şekli (konaklama \| güniçi \| depremzede).

---

## 3. guests tablosu (otel içi)

- **identity_hash:** HMAC-SHA256(docType + docNo + birthDate, server-secret). Belge numarası saklanmaz; sadece “aynı kişi tekrar geldi mi?” eşleştirmesi için.
- **expires_at:** created_at + 30 gün (otomatik silme/anonymize job).

---

## 4. kbs_submissions (audit)

- **payload_json:** Sadece KBS’ye giden zorunlu/gerçek zorunlu alanlar.
- **correlation_id:** Tarama/istek izleme.
- Saklama süresi mevzuata göre (6–12 ay audit); otel içi liste 30 gün.

---

## 5. Mevcut şema ile ilişki

- **Tesis** → hotels kavramsal karşılık; yeni tablolar `tesisId` (veya `hotel_id`) ile bağlanabilir.
- **Misafir** (mevcut): Oda + tesis + ad, soyad, kimlikNo, pasaportNo, dogumTarihi, uyruk, misafirTipi, girisTarihi, cikisTarihi. Hedef `guests` + `stays` ayrımına geçişte mevcut Misafir ya yavaşça eşlenir ya da migration ile stays/guests doldurulur.
- **Bildirim** (mevcut): KBS bildirim durumu. Hedef `kbs_submissions` ayrı audit tablosu; Bildirim ile ilişkilendirilebilir.

---

## 6. Migration stratejisi

1. **Faz 1:** Yeni tablolar ekle (hotel_staff, guests, stays, kbs_submissions) ve mevcut Tesis/Oda/Misafir/Bildirim ile foreign key’ler tanımla.
2. **Faz 2:** Check-in akışını yeni stays + kbs_submissions kullanacak şekilde güncelle; Misafir/Bildirim’i isteğe bağlı geri uyumluluk için tutun veya kademeli taşıyın.
3. **Faz 3:** 30 günlük otomatik silme job’ı (guests, stays); kbs_submissions için saklama politikası uygula.

Bu doküman sadece hedef tasarımı tanımlar; Prisma migration dosyaları ayrı oluşturulacaktır.

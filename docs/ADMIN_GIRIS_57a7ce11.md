# Admin hesaba giriş (sonertoprak97@gmail.com / UID 57a7ce11)

Bu hesap Supabase’te tanımlı ve `user_profiles` içinde **admin** rolüne sahip. Mobil uygulama girişi **telefon** (SMS OTP) ile yapıldığı için, bu hesaba girebilmek için hem Supabase’te hem backend’de aynı telefonla eşleşme gerekir.

---

## 1) Supabase’te telefona izin ver

1. **Supabase Dashboard** → **Authentication** → **Users**
2. Kullanıcıyı bul: **57a7ce11-b979-4614-9521-dbf12d1138e0** (veya sonertoprak97@gmail.com)
3. **Edit** (veya üç nokta → Edit user)
4. **Phone** alanına kendi numaranı gir (örn. `+905551234567`).  
   - Sadece rakam girebiliyorsan: `5551234567` veya `05551234567` (ülke kodu +90 otomatik eklenebilir)
5. Kaydet.

Bu numara, mobilde “SMS ile giriş”te kullanacağın numara olacak.

---

## 2) Backend’de aynı telefonla kullanıcı oluştur

Backend (Prisma/SQLite) girişte **telefon** ile kullanıcı arıyor. Bu yüzden aynı telefonla bir **Kullanici** (ve bağlı bir **Tesis**) kaydı olmalı.

### Seçenek A: Seed script ile (önerilen)

1. `backend/.env` içine ekle (kendi bilgilerinle doldur):
   ```env
   ADMIN_SEED_PHONE=+905551234567
   ADMIN_SEED_EMAIL=sonertoprak97@gmail.com
   ADMIN_SEED_NAME=Serdar Toprak
   ```
2. Backend klasöründe:
   ```bash
   cd backend
   npx node scripts/seed-admin-link.js
   ```
3. Script bir **Tesis** ve bu telefona bağlı bir **Kullanici** oluşturur.  
   (İlk çalıştırmada tesis/kullanıcı yoksa oluşturur; varsa sadece telefon/email günceller.)

### Seçenek B: Prisma Studio ile

1. `cd backend && npx prisma studio`
2. **Tesis** tablosunda en az bir kayıt yoksa bir tesis ekle (tesisAdi, email, telefon, il, ilce, adres, odaSayisi, tesisTuru, tesisKodu, durum: `aktif` vb.).
3. **Kullanici** tablosunda bu tesis için bir kullanıcı ekle:
   - `telefon`: Supabase’e yazdığın numara (aynı format, örn. `+905551234567`)
   - `email`: `sonertoprak97@gmail.com`
   - `adSoyad`: İstediğin isim
   - `tesisId`: Az önce oluşturduğun tesisin id’si
   - `rol`: `sahip` veya `yonetici`

**Not:** Railway’de backend SQLite kullanıyorsa, deploy sonrası veritabanı sıfırlanıyorsa bu seed’i deploy sonrası veya kalıcı bir volume kullanacak şekilde düzenlemek gerekir.

---

## 3) Mobilde giriş

1. Uygulamada **SMS ile giriş** seç.
2. **Telefon** alanına 1. adımda Supabase’e yazdığın numarayı gir (örn. `5551234567` veya `05551234567`).
3. **Kod iste** → Gelen SMS’teki kodu gir → Doğrula.
4. Giriş sonrası backend `supabase-phone-session` ile Supabase kullanıcısını (57a7ce11) bu telefonla eşleştirir; `user_profiles` zaten admin olduğu için admin yetkisi devam eder.

---

## Özet

| Nerede              | Ne yapılır |
|----------------------|------------|
| Supabase Auth        | 57a7ce11 kullanıcısına **Phone** ekle (girişte kullanacağın numara). |
| Backend (Prisma)     | Aynı telefonla bir **Kullanici** (ve bir **Tesis**) oluştur (seed veya Prisma Studio). |
| Mobil                | **SMS ile giriş** → bu telefonu yaz → OTP doğrula. |

Böylece hem backend hem Supabase aynı telefonu kullanır; girişte admin profili (57a7ce11) ile devam edersin.

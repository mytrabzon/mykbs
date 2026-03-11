# "Tesis erişimi yapılandırılmamış" / Panele girememe

Bu mesaj doğrudan kodda geçmez; genelde şu iki durumdan biri kastedilir.

---

## 1. "Hesabınız bir tesise bağlı değil" (Backend e-posta + şifre ile giriş)

**Ne zaman:** Admin panelde **"Backend (e-posta + şifre)"** ile giriş yapıyorsunuz; backend `POST /api/auth/giris/yeni` 403 döner.

**Sebep:** Prisma `Kullanici` kaydında `tesisId` boş (hesap hiçbir tesise atanmamış).

**Çözüm (birini uygulayın):**

### A) Aynı e-postayla Supabase ile giriş (önerilen)

- Giriş ekranında **"Supabase (e-posta + şifre)"** seçin.
- E-posta ve şifre ile giriş yapın.
- Admin yetkisi Supabase tarafında tanımlı olmalı: `docs/fix_admin_user.sql` içeriğini Supabase SQL Editor’de çalıştırın (kendi `admin_user_id` ile). Bu script `profiles.is_admin`, `user_profiles.role`, `app_roles` vb. ayarlar.

### B) Backend kullanıcısına tesis atama

Kullanıcıyı bir tesise bağlamak için Prisma/veritabanında `Kullanici.tesisId` doldurulmalı:

```sql
-- Örnek: email ile kullanıcı bulunup bir tesise atanır
UPDATE "Kullanici"
SET "tesisId" = (SELECT id FROM "Tesis" LIMIT 1)
WHERE email = 'sizin@email.com';
```

Veya Prisma Studio / script ile:

```js
await prisma.kullanici.update({
  where: { email: 'sizin@email.com' },
  data: { tesisId: 'MEVCUT_TESIS_ID' }
});
```

Tesis yoksa önce bir `Tesis` kaydı oluşturmanız gerekir.

---

## 2. "Admin erişimi yapılandırılmamış" (503)

**Ne zaman:** Panel şifresi (ADMIN_SECRET) ile veya backend JWT ile giriş sonrası herhangi bir admin isteği 503 döner.

**Sebep:** Backend’de `NODE_ENV=production` iken `ADMIN_SECRET` tanımlı değil veya hâlâ varsayılan `admin-secret-key`.

**Çözüm:**

1. **Backend** `.env`:
   ```env
   ADMIN_SECRET=güçlü-gizli-bir-anahtar
   ```
2. **Admin panel** `admin-panel/.env.local`:
   ```env
   NEXT_PUBLIC_ADMIN_SECRET=güçlü-gizli-bir-anahtar
   ```
   (Aynı değer olmalı; panel şifre ile girişte bunu kullanır.)

---

## Hangi giriş türünü kullanmalı?

- **Supabase giriş:** Tesis zorunlu değil; admin yetkisi `profiles` / `user_profiles` / `app_roles` ile verilir. `fix_admin_user.sql` bu hesabı admin yapar.
- **Backend (e-posta + şifre) giriş:** `Kullanici.tesisId` zorunlu; yoksa "Hesabınız bir tesise bağlı değil" alırsınız. Admin panel erişimi için ayrıca `ADMIN_KULLANICI_ID` veya `app_roles` ile bu kullanıcının admin sayılması gerekir.

Özet: Panele tesis olmadan girmek istiyorsanız **Supabase** ile giriş yapıp `docs/fix_admin_user.sql` ile hesabı admin yapın. "Tesis erişimi yapılandırılmamış" hissi çoğu zaman "hesaba tesis atanmamış" (Backend giriş) veya "ADMIN_SECRET eksik" (503) durumuna karşılık gelir.

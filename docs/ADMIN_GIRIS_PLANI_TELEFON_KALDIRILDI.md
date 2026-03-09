# Admin giriş planı (telefon ile giriş kaldırıldı)

Telefon ile giriş kaldırıldığı için süper admin hesabı (önceden 905330483061) artık uygulama veya panelde telefon ile giriş yapamıyor. Aşağıdaki planla **tek bir admin hesabı** ile hem **mobil uygulama** hem **web admin panel** kullanılabilir.

---

## Seçenek A: Backend hesap (e-posta + şifre) — önerilen

Tek hesap: **e-posta + şifre**. Backend (Prisma) üzerinden giriş; mobil ve web panel aynı bilgilerle açılır.

### 1. Backend'de admin kullanıcı

- Prisma'da bir **Tesis** + bir **Kullanici** olmalı (örn. "Admin Tesis" / admin@…).
- Bu kullanıcının **e-posta** ve **şifre** (hash'lenmiş) kayıtlı olmalı.
- `.env` içinde: **`ADMIN_KULLANICI_ID`** = bu kullanıcının Prisma `id` değeri (örn. `1`).

Örnek (ilk kurulumda tek seferlik):

- Tesis: "KBS Prime Admin", tesisKodu: MYKBS-ADMIN vb.
- Kullanici: email = `admin@litxtech.com` (veya sizin belirleyeceğiniz), sifre = bcrypt hash, rol = sahip, tesisId = yukarıdaki tesis.
- `ADMIN_KULLANICI_ID=1` (veya oluşan kullanıcı id’si).

### 2. Mobil uygulama

- Giriş ekranında **E-posta** ve **Şifre** alanlarına admin e-postası ve şifresini girin → **Giriş Yap**.
- İstek `POST /auth/giris/yeni` ile backend’e gider; dönen JWT ile `/auth/me` çağrılır.
- `ADMIN_KULLANICI_ID` eşleştiği için `/auth/me` cevabında `is_admin: true` döner → Admin sekmesi görünür.

### 3. Web admin panel

- **E-posta + Şifre** sekmesi (varsayılan): Aynı admin **e-posta + şifre** → `POST /auth/giris/yeni` → dönen JWT `admin_token` olarak saklanır; tüm `/api/app-admin/*` istekleri bu token ile yapılır.
- **Panel Şifresi** sekmesi: Sadece **ADMIN_SECRET** (NEXT_PUBLIC_ADMIN_SECRET) ile giriş — hesap yok, sadece panel şifresi.
- **Supabase** sekmesi: Supabase Auth e-posta + şifre (isteğe bağlı).

Böylece hem mobil hem web’de **aynı e-posta + şifre** kullanılır; telefon gerekmez.

---

## Seçenek B: Supabase süper admin’e e-posta ekle (opsiyonel)

Eski süper admin UUID’si (`f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7`) kullanılmaya devam edecekse:

1. **Supabase Dashboard** → Authentication → Users → ilgili kullanıcıyı bul (telefon 905330483061 ile).
2. Kullanıcıya **e-posta ekleyin** (ve isteğe bağlı **şifre** tanımlayın).
3. Mobilde: **Kod ile giriş** → bu e-postayı yazın → gelen 6 haneli kodu girin → giriş Supabase + backend ile tamamlanır, `profiles.is_admin` sayesinde admin görünür.
4. Web panelde: **Supabase** sekmesinde bu e-posta + şifre ile giriş (şifre tanımladıysanız).

Bu seçenek, mevcut Supabase kullanıcısını kullanmak istiyorsanız anlamlıdır; yoksa Seçenek A daha sade ve tek kaynak (backend) üzerinden yönetilir.

---

## Özet tablo

| Nerede giriş      | Nasıl giriş (Seçenek A)     | Nasıl giriş (Seçenek B)        |
|-------------------|-----------------------------|---------------------------------|
| Mobil             | E-posta + şifre (backend)   | Kod ile giriş (Supabase OTP)   |
| Web admin panel   | Backend sekmesi: e-posta + şifre **veya** Şifre: ADMIN_SECRET | Supabase sekmesi: e-posta + şifre **veya** Şifre: ADMIN_SECRET |

---

## Yapılacaklar (teknik)

1. **Backend:** Prisma’da admin Tesis + Kullanici (e-posta + şifre) oluşturulmalı; `ADMIN_KULLANICI_ID` set edilmeli.
2. **Admin panel:** Login sayfasına "Backend giriş" (e-posta + şifre → `POST /auth/giris/yeni` → JWT’yi token olarak kullan) eklenmeli.
3. **Mobil:** Değişiklik gerekmez; zaten e-posta + şifre ile backend girişi var ve `ADMIN_KULLANICI_ID` ile `is_admin` dönüyor.

Bu plan ile telefon kullanmadan tek bir admin hesabı (e-posta + şifre) ile hem uygulama hem panel kullanılabilir.

---

## Neden mobilde "Admin Panel" görünmüyor?

- **NEXT_PUBLIC_ADMIN_SECRET** / **ADMIN_SECRET** sadece **web** panelinin giriş şifresidir; mobil uygulamada hangi hesabın Admin sekmesini göreceğini **belirlemez**.
- Mobilde Admin’in görünmesi için giriş yaptığınız **hesabın** backend’den `is_admin: true` veya `role: 'admin'` alması gerekir.
- **E-posta + şifre** ile giriş yapıyorsanız: Backend’de **`ADMIN_KULLANICI_ID`** değişkeni, giriş yaptığınız kullanıcının Prisma **Kullanici.id** değerine eşit olmalı (backend’in çalıştığı sunucudaki `.env` dosyasında).

**Yapmanız gereken:** Backend’in çalıştığı yerde (VPS / Railway vb.) **`.env`** içine şunu ekleyin veya güncelleyin:

```bash
ADMIN_KULLANICI_ID=1
```

`1` yerine, mobilde giriş yaptığınız e-posta+şifre hesabının **Prisma’daki Kullanici id** değerini yazın (veritabanında `Kullanici` tablosundan bakabilirsiniz). Backend’i yeniden başlattıktan sonra aynı hesapla mobilde giriş yapın; "Daha Fazla" menüsünde Admin Panel görünür.

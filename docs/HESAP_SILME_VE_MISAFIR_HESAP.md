# Hesap Silme ve Misafir Hesap

## Hesap silme (7 gün)

- **Ayarlar > Hesap > Hesabı sil**: Kullanıcı talebi oluşturulur, çıkış yapılır ve lobiye dönülür.
- **7 gün içinde**: Kullanıcı tekrar giriş yapabilir; "Hesap silme talebi aktif" ekranında **Hesabı geri al** veya **Çıkış yap** seçenekleri sunulur. Onay vermeden (geri almadan) normal uygulama kullanılamaz.
- **7 gün sonra**: Tüm veriler (şube, misafirler, KBS outbox, audit log, belgeler vb.) silinir; Supabase Auth kullanıcısı kaldırılır.

### Backend

- `GET /api/auth/me`: `accountPendingDeletion`, `deletionAt` döner.
- `POST /api/auth/request-account-deletion`: `profiles.deletion_requested_at` set edilir.
- `POST /api/auth/restore-account`: `deletion_requested_at` temizlenir.

### Cron (7 gün sonra kalıcı silme)

Günlük çalışacak bir cron ile aşağıdaki endpoint çağrılmalıdır:

```http
POST /internal/purge-deleted-accounts
x-worker-secret: <WORKER_SECRET>
```

Örnek (Railway cron): `WORKER_SECRET` environment variable ile günde bir kez bu URL’e istek atın.

### Migration

- `supabase/migrations/0022_profiles_deletion_requested.sql` — `profiles.deletion_requested_at` kolonu.

---

## Misafir hesap

- **Giriş ekranı**: "Misafir olarak devam et" ile Supabase Anonymous giriş yapılır; backend ilk istekte otomatik şube + profil oluşturur.
- **Kısıtlar**:
  - En fazla **5 pasaport/kimlik** (okutulan belgeler) kaydedilebilir.
  - **KBS bilgileri doldurulamaz** (check-in/checkout/oda değişikliği KBS’e gitmez); e-posta doğrulaması gerekir.
- **Yasaklar kalkması**: Profil > Telefon ve e-posta bağla bölümünden e-posta eklenip **doğrulandığında** (`email_confirmed_at` set) misafir kısıtları otomatik kalkar.

### Supabase

- **Anonymous sign-in** açık olmalı: Supabase Dashboard → Authentication → Providers → Anonymous → Enable.

### Backend

- Anonim kullanıcı ilk istekte: "Misafir Organizasyonu" + "Misafir Hesap" şubesi + `user_profiles` oluşturulur.
- `GET /api/auth/me`: `isGuest: true/false` (anon ve e-posta doğrulanmamışsa `true`).
- `POST /api/okutulan-belgeler`: Misafir için tesis başına 5 kayıt limiti.
- `POST /api/checkin`, `checkout`, `room-change`: Misafir ise 403, "E-posta doğrulaması gerekli" mesajı.

### Mobil

- Misafir girişi: `AuthContext.loginAsGuest()` → `signInAnonymously()`.
- Lobi üstünde misafir banner’ı: "Misafir modu: En fazla 5 pasaport. KBS için Daha Fazla → Ayarlar → E-posta ekleyin."

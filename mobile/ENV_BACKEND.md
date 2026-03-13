# Backend bağlantısı için .env (Supabase + Node backend)

Mobil uygulama **iki hedefe** istek atar:

1. **Supabase** – Auth, Edge Functions (giriş/kayıt, tesis/oda listesi, bildirimler, vb.)
2. **Node backend (Railway/VPS)** – OCR (MRZ/kimlik), check-in, tesis/oda CRUD, KBS senkron, raporlar, okutulan belgeler (`EXPO_PUBLIC_BACKEND_URL`)

**Hangi .env nerede?**  
- **mobile/.env** → Mobil uygulama sadece bunu okur. Backend URL ve Supabase burada tanımlı olmalı.  
- **Proje kökü .env** → Supabase CLI / referans; mobil bu dosyayı okumaz.

## Zorunlu değişkenler (mobile/.env)

Bu değişkenler **mutlaka** olmalı; yoksa "Supabase yapılandırması eksik" veya "EXPO_PUBLIC_BACKEND_URL tanımlayın" hatası alırsınız.

| Değişken | Açıklama | Nereden alınır |
|----------|----------|----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Proje URL’si, sonda `/` olmamalı | Supabase Dashboard → **Project Settings** → **API** → **Project URL** |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Proje public key’i (anon veya publishable) | Aynı sayfa → **API Keys** bölümü (aşağıda hangisini kullanacağınız var) |

### Hangi key kullanılmalı?

Supabase iki tür “public” key sunuyor; **ikisi de mobilde kullanılabilir**:

| Tür | Format | Öneri |
|-----|--------|--------|
| **Publishable (yeni)** | `sb_publishable_...` | **Önerilen.** Rotasyon kolay, Supabase’in yeni nesil key’i. Dashboard’da **API Keys** sekmesinde “Publishable key” olarak geçer. |
| **Anon (JWT, legacy)** | `eyJhbGciOiJIUzI1...` (~200+ karakter) | Eski projelerde veya publishable yoksa. Aynı sayfada **Legacy API Keys** → **anon** **public**. |

Mobil uygulama ve Edge Functions çağrıları için **birini** seçip `EXPO_PUBLIC_SUPABASE_ANON_KEY` olarak koymanız yeterli (isim anon kalmış olsa da publishable key de bu değişkene yazılır). Projede Edge Functions için `verify_jwt = false` kullandığınız için publishable key ile de çağrılar çalışır.

## Örnek mobile/.env

**Publishable key (önerilen):**
```env
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx
```

**Veya anon JWT (legacy):**
```env
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
```

- Değerler **tam** olmalı (kesilmiş veya kısaltılmış olmasın).
- Satır sonunda boşluk veya aynı satırda `#` yorumu olmasın.
- İsterseniz tırnak kullanmayın; kullanırsanız tek/çift tırnak otomatik temizlenir.

## Node backend (EXPO_PUBLIC_BACKEND_URL)

Mobil uygulama **Node backend**e (Railway veya VPS) şu işlemler için istek atar: OCR (MRZ/kimlik), check-in, tesis/oda CRUD, KBS senkron, raporlar, okutulan belgeler. Bunun için **mobile/.env** içinde:

```env
EXPO_PUBLIC_BACKEND_URL=https://mykbs-production.up.railway.app
```

veya VPS kullanıyorsanız (sonda `/` olmamalı):

```env
EXPO_PUBLIC_BACKEND_URL=http://178.104.12.20
```

**Not:** Proje kökündeki `.env` dosyasındaki `EXPO_PUBLIC_BACKEND_URL` mobil tarafından **okunmaz**; sadece **mobile/.env** geçerli.

## İsteğe bağlı

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL` | `EXPO_PUBLIC_SUPABASE_URL` + `/functions/v1` | Edge Functions base URL (genelde değiştirmenize gerek yok) |
| `EXPO_PUBLIC_USE_TRPC` | - | tRPC health artık kullanılmıyor; yok sayılır |

## Değişkenler nerede okunuyor?

- **Supabase client (auth):** `src/lib/supabase/supabase.ts` → URL + anon key
- **Edge Function çağrıları (health, facilities_list, rooms_list, auth_*, vb.):** `src/lib/supabase/functions.ts` → `callFn()` aynı URL + anon key ile `https://<URL>/functions/v1/<name>` yapar
- **Node backend (OCR, check-in, tesis, oda, KBS, vb.):** `src/services/apiSupabase.ts` → `getBackendUrl()` = `process.env.EXPO_PUBLIC_BACKEND_URL` (mobile/.env)

Hem Supabase hem Node backend için **mobile/.env** içinde ilgili değişkenler tanımlı olmalı.

## .env değiştirdikten sonra

1. `npx expo start --clear` ile yeniden başlatın.
2. Dev client kullanıyorsanız gerekirse uygulamayı yeniden derleyin (env build time’da gömülür).

## Hâlâ bağlantı hatası alıyorsanız

1. **mobile/.env** dosyasının `mobile` klasöründe olduğundan emin olun (proje kökünde değil).
2. Değişken isimlerinin **birebir** `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` olduğunu kontrol edin.
3. Anon key’i Supabase Dashboard’dan yeniden kopyalayıp yapıştırın (tam JWT, tek satır).
4. Supabase Dashboard → **Edge Functions** → ilgili fonksiyonun **deploy** edildiğini ve loglarda 401/404/500 olmadığını kontrol edin.
5. "EXPO_PUBLIC_BACKEND_URL tanımlayın" / "Backend'e ulaşılamadı" hatası: **mobile/.env** içinde `EXPO_PUBLIC_BACKEND_URL` tanımlı mı, Railway/VPS adresi doğru mu (https/http, sonda `/` yok) kontrol edin.

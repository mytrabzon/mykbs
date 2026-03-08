# Supabase Auth – Site URL ve Redirect URLs (kbsprime.com)

Supabase Dashboard → **Authentication** → **URL Configuration** bölümünde aşağıdaki değerler kullanılmalıdır.

## Site URL

```
https://kbsprime.com
```

Varsayılan yönlendirme ve e-posta şablonlarındaki `{{ .SiteURL }}` bu değeri kullanır.

---

## Redirect URLs (izin verilen yönlendirme adresleri)

Aşağıdaki 4 URL’nin **Redirect URLs** listesine ekli olduğundan emin olun:

| URL | Açıklama |
|-----|----------|
| `kbsprime://auth/callback` | Mobil uygulama – şifre sıfırlama ve e-posta doğrulama linkleri buraya yönlenir. |
| `https://www.kbsprime.com/auth/reset-password` | Web – şifre sıfırlama sayfası. |
| `https://kbsprime.com` | Web – ana site. |
| `https://kbsprime.com/auth/callback` | Web – auth callback. |

Wildcard kullanılabilir, örn: `https://*.kbsprime.com/**`

---

## Projede kullanıldığı yerler

- **Şifre sıfırlama (mobil):** `AuthContext.resetPasswordForEmail` → `redirectTo: 'kbsprime://auth/callback'`
- **Deep link işleme (mobil):** `App.js` → `kbsprime://auth/callback` veya `mykbs://reset-password` (eski) açıldığında recovery session işlenir, ForgotPassword ekranında yeni şifre belirlenir.
- **App scheme:** `app.config.js` → `scheme: "kbsprime"` (deep link öneki: `kbsprime://`)

---

## E-posta şablonları

**Authentication** → **Email Templates** içinde:

- **Redirect URL** / **Site URL** alanları `https://kbsprime.com` veya ilgili web/mobil URL’leri ile uyumlu olmalı.
- Magic Link / Confirm signup / Reset password şablonlarında `{{ .SiteURL }}` veya `{{ .ConfirmationURL }}` kullanılıyorsa, Site URL’in doğru olduğundan emin olun.

Bu yapılandırma ile mobil şifre sıfırlama linki `kbsprime://auth/callback#access_token=...&refresh_token=...&type=recovery` olarak açılır ve uygulama oturumu alıp yeni şifre ekranını gösterir.

# Supabase Edge Functions — URL referansı

Proje ref: **iuxnpxszfvyrdifchwvr**

Base URL (functions):  
`https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1`

## Sık kullanılan endpoint’ler

| Amaç | Tam URL |
|------|--------|
| **tRPC** (Edge’deki tRPC router) | https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1/trpc |
| **Topluluk resmi yükleme** | https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1/upload_community_image |
| **me** (oturum bilgisi) | https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1/me |

## Mobil / client tarafında kullanım

- **Mobil:** `EXPO_PUBLIC_SUPABASE_URL` veya `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL` ile base alınır; fonksiyon adı path’e eklenir.
  - Örnek: `buildApiUrl('trpc')` → `…/functions/v1/trpc`
  - Örnek: `callFn('upload_community_image', body)` → `…/functions/v1/upload_community_image`
- **api.ts:** `getSupabaseBaseUrl()` + `/functions/v1/${path}` ile URL üretilir.

## Test

```bash
# tRPC health
curl -s "https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1/trpc/health"

# upload_community_image → POST + Authorization + body gerekir (anon 401 dönebilir)
```

## Not

- 401 alırsanız: `Authorization: Bearer <access_token>` (Supabase Auth session) gönderildiğinden emin olun.
- Farklı ortam (staging/prod) için aynı proje kullanılıyorsa URL aynı kalır; env’de `EXPO_PUBLIC_SUPABASE_URL` ile değiştirilebilir.

# Supabase Edge Functions - tRPC

Bu dizin Supabase Edge Functions için tRPC entegrasyonunu içerir.

## Yapı

```
supabase/
├── functions/
│   ├── trpc/
│   │   ├── index.ts          # Ana Edge Function
│   │   └── deno.json         # Deno imports
│   └── _shared/
│       ├── trpc.ts           # tRPC setup
│       ├── context.ts        # Context oluşturma
│       └── deno.json         # Shared imports
└── config.toml               # Supabase config
```

## Deploy

```bash
# Supabase CLI ile
supabase functions deploy trpc

# veya Supabase Dashboard'dan manuel olarak
```

## Kullanım

Edge Function URL'i:
```
https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1/trpc
```

### Client Örneği

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1/trpc',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
  ]
});
```

## Environment Variables

Edge Function'da `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` otomatik verilir. **SMS ile giriş tamamen Supabase üzerinden çalışır; ekstra secret gerekmez.**

- **auth_supabase_phone_session:** Oturumu sadece Supabase ile oluşturur (organization/branch/profile ilk girişte otomatik oluşturulur).
- **BACKEND_URL** yalnızca Node backend kullanıyorsanız (auth_request_otp / auth_verify_otp proxy) isteğe bağlıdır.

**Fonksiyon deploy (ikisini de çalıştırın):** Proje kökünden:
```bash
supabase functions deploy auth_supabase_phone_session
supabase functions deploy auth_verify_otp
```
- `auth_supabase_phone_session`: OTP sonrası oturum + tesis (client verifyOtp → bu fonksiyon).
- `auth_verify_otp`: Aynı işi yapabilir; ayrıca sadece `telefon` + `otp` ile de doğrulayıp gerçek Supabase JWT döner (bağlantı sorununda yedek yol).


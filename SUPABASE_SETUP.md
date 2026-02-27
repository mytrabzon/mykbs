# Supabase Entegrasyon Kılavuzu

## Kurulum

### 1. Backend Entegrasyonu

Backend'de Supabase kullanmak için:

```bash
cd backend
npm install @supabase/supabase-js
```

`.env` dosyasına ekleyin:
```env
SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxxx
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2. Mobile App Entegrasyonu

Mobile app'te Supabase kullanmak için:

```bash
cd mobile
npm install @supabase/supabase-js
```

`.env` dosyası oluşturun:
```env
EXPO_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
```

### 3. Admin Panel Entegrasyonu

Admin panel'de Supabase kullanmak için:

```bash
cd admin-panel
npm install @supabase/supabase-js
```

`.env.local` dosyasına ekleyin:
```env
NEXT_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
```

## Edge Functions - tRPC

### Kurulum

Supabase Edge Functions için Deno kullanılır. tRPC entegrasyonu için:

```bash
# Supabase CLI kurulumu (gerekirse)
npm install -g supabase

# Edge Functions dizinini oluştur
mkdir -p supabase/functions/trpc
```

### tRPC Router Kullanımı

Edge Function'da tRPC router'ı kullanmak için:

```typescript
// supabase/functions/trpc/index.ts
import { router, publicProcedure } from '../_shared/trpc.ts';

const appRouter = router({
  // Query örneği
  getTesisler: publicProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase.from('tesis').select('*');
    return data;
  }),

  // Mutation örneği
  createTesis: publicProcedure
    .input(z.object({ tesisAdi: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { data } = await ctx.supabase
        .from('tesis')
        .insert(input)
        .select()
        .single();
      return data;
    }),
});
```

### Edge Function Deploy

```bash
# Supabase projesine bağlan
supabase link --project-ref your-project-ref

# Edge Function'ı deploy et
supabase functions deploy trpc
```

### Client'tan Kullanım

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

// Kullanım
const tesisler = await trpc.getTesisler.query();
```

## Güvenlik Notları

⚠️ **ÖNEMLİ**: 
- `SUPABASE_ANON_KEY` public olabilir (anon key)
- `SUPABASE_SERVICE_ROLE_KEY` asla client tarafında kullanılmamalı
- Service role key sadece backend ve edge functions'da kullanılmalı
- `.env` dosyaları asla commit edilmemeli

## Environment Variables

### Backend (.env)
```env
SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxxx
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Mobile (.env)
```env
EXPO_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
```

### Admin Panel (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
```

## Supabase Client Kullanımı

### Backend'de
```javascript
const { supabase, supabaseAdmin } = require('./services/supabase');

// Anon client (public operations)
const { data } = await supabase.from('tesis').select('*');

// Admin client (bypass RLS)
const { data } = await supabaseAdmin.from('tesis').select('*');
```

### Mobile'da
```javascript
import { supabase } from './services/supabase';

const { data } = await supabase.from('tesis').select('*');
```

### Realtime Subscription
```javascript
const subscription = supabase
  .channel('tesis-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'tesis' },
    (payload) => {
      console.log('Change:', payload);
    }
  )
  .subscribe();
```

## Sorun Giderme

1. **Connection Error**: Supabase URL ve key'lerin doğru olduğundan emin olun
2. **RLS Policy**: Row Level Security politikalarını kontrol edin
3. **CORS**: Edge Functions için CORS ayarlarını kontrol edin
4. **Environment Variables**: `.env` dosyalarının doğru yerde olduğundan emin olun


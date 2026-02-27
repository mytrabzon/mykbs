# Supabase Entegrasyonu

## 🔐 Güvenlik

**ÖNEMLİ**: Supabase bilgileri environment variables'da saklanıyor ve `.gitignore` ile korunuyor.

- ✅ URL ve Anon Key: Public olabilir (anon key güvenli)
- ⚠️ Service Role Key: **ASLA** client tarafında kullanılmamalı, sadece backend/edge functions

## 📁 Dosya Yapısı

```
MYKBS/
├── backend/
│   ├── .env                    # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
│   └── src/services/supabase.js
├── mobile/
│   ├── .env                    # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
│   └── src/services/supabase.js
├── admin-panel/
│   ├── .env.local              # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
│   └── src/services/supabase.ts
└── supabase/
    ├── functions/
    │   ├── trpc/               # tRPC Edge Function
    │   └── _shared/            # Shared tRPC utilities
    └── config.toml
```

## 🚀 Hızlı Başlangıç

### 1. Environment Variables Ayarla

**Backend** (`backend/.env`):
```env
SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxxx
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Mobile** (`mobile/.env`):
```env
EXPO_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
```

**Admin Panel** (`admin-panel/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
```

### 2. Paketleri Yükle

```bash
# Backend
cd backend && npm install @supabase/supabase-js

# Mobile
cd mobile && npm install @supabase/supabase-js

# Admin Panel
cd admin-panel && npm install @supabase/supabase-js
```

## 🔧 Kullanım

### Backend'de

```javascript
const { supabase, supabaseAdmin } = require('./services/supabase');

// Anon client (public operations)
const { data, error } = await supabase
  .from('tesis')
  .select('*');

// Admin client (bypass RLS - sadece backend'de)
const { data } = await supabaseAdmin
  .from('tesis')
  .select('*');
```

### Mobile'da

```javascript
import { supabase, supabaseHelpers } from './services/supabase';

// Query
const { data } = await supabase.from('tesis').select('*');

// Realtime subscription
const subscription = supabaseHelpers.subscribe('tesis', (payload) => {
  console.log('Change:', payload);
});
```

### Admin Panel'de

```typescript
import { supabase } from '@/services/supabase';

const { data } = await supabase.from('tesis').select('*');
```

## 🌐 Edge Functions - tRPC

### Deploy

```bash
# Supabase CLI ile
supabase functions deploy trpc

# veya manuel olarak Supabase Dashboard'dan
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

## 📝 Notlar

- Tüm `.env` dosyaları `.gitignore`'da
- Service Role Key sadece backend ve edge functions'da
- Anon Key public olabilir ama yine de dikkatli kullanın
- Detaylı bilgi için [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) dosyasına bakın


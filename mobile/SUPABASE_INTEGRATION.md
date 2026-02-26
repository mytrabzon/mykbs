# 🔗 Supabase Edge Functions Entegrasyonu

## 📋 Genel Bakış

Bu dokümantasyon, Supabase Edge Functions (özellikle tRPC endpoint) kullanımını açıklar.

## 🔧 Yapılandırma

### 1. Environment Variables

`app.config.js` içinde yapılandırılmış:

```javascript
extra: {
  EXPO_PUBLIC_SUPABASE_URL: "https://iuxnpxszfvyrdifchwvr.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_xzlZ7XfGyx9CfBaQyLWgKw_ic_v5K1J",
  EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL: "https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1",
}
```

### 2. Supabase Functions Client

**Dosya**: `mobile/src/services/supabaseFunctions.ts`

## 🚀 Kullanım

### tRPC Endpoint Kullanımı

```typescript
import { trpc } from '../services/supabaseFunctions';

// tRPC procedure çağrısı
const result = await trpc.call('tesis.get', { tesisId: '123' }, token);

// Örnek: Tesis bilgilerini getir
const tesis = await trpc.call('tesis.get', { tesisId: 'abc123' }, userToken);
```

### Generic Edge Function Kullanımı

```typescript
import { supabaseFunctions } from '../services/supabaseFunctions';

// Herhangi bir Edge Function çağrısı
const result = await supabaseFunctions.callFunction('my-function', {
  param1: 'value1',
  param2: 'value2'
}, token);
```

## 📝 Örnekler

### 1. Tesis Bilgilerini Getir

```typescript
import { trpc } from '../services/supabaseFunctions';
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { token } = useAuth();
  
  const loadTesis = async () => {
    try {
      const result = await trpc.call('tesis.get', {
        tesisId: 'abc123'
      }, token);
      
      console.log('Tesis:', result);
    } catch (error) {
      console.error('Hata:', error);
    }
  };
  
  return (
    // ...
  );
}
```

### 2. Oda Listesi Getir

```typescript
import { trpc } from '../services/supabaseFunctions';

const loadOdalar = async (filtre: string, token: string) => {
  try {
    const result = await trpc.call('oda.list', {
      filtre: filtre // 'tumu', 'bos', 'dolu', 'hatali'
    }, token);
    
    return result.odalar;
  } catch (error) {
    console.error('Odalar yüklenemedi:', error);
    throw error;
  }
};
```

### 3. Misafir Check-in

```typescript
import { trpc } from '../services/supabaseFunctions';

const checkIn = async (odaId: string, misafirData: any, token: string) => {
  try {
    const result = await trpc.call('misafir.checkIn', {
      odaId,
      misafir: misafirData
    }, token);
    
    return result;
  } catch (error) {
    console.error('Check-in hatası:', error);
    throw error;
  }
};
```

## 🔐 Authentication

Supabase Edge Functions, JWT token ile authentication yapılır:

```typescript
// Token'ı AuthContext'ten al
const { token } = useAuth();

// tRPC çağrısında token kullan
const result = await trpc.call('procedure.name', input, token);
```

## ⚠️ Hata Yönetimi

```typescript
try {
  const result = await trpc.call('procedure.name', input, token);
  // Başarılı
} catch (error: any) {
  if (error.response?.status === 401) {
    // Unauthorized - token geçersiz
    // Kullanıcıyı login ekranına yönlendir
  } else if (error.response?.status === 404) {
    // Not found
  } else {
    // Diğer hatalar
    console.error('Hata:', error.message);
  }
}
```

## 🔄 Backend vs Supabase Functions

### Backend API (Local)
- **URL**: `http://10.0.2.2:8080/api` (Android Emulator)
- **Kullanım**: Local development, offline çalışma
- **Avantaj**: Hızlı, local kontrol

### Supabase Edge Functions
- **URL**: `https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1`
- **Kullanım**: Production, cloud-based
- **Avantaj**: Scalable, managed infrastructure

### Hibrit Yaklaşım

Her ikisini de kullanabilirsiniz:

```typescript
import { api } from '../services/api'; // Backend API
import { trpc } from '../services/supabaseFunctions'; // Supabase Functions

// Development'ta backend, production'da Supabase
const useBackend = process.env.NODE_ENV === 'development';

if (useBackend) {
  const result = await api.get('/tesis');
} else {
  const result = await trpc.call('tesis.get', {}, token);
}
```

## 📚 İlgili Dosyalar

- `mobile/src/services/supabaseFunctions.ts` - Supabase Functions client
- `mobile/src/services/supabase.js` - Supabase client (database, storage)
- `mobile/app.config.js` - Environment variables
- `mobile/src/services/api.js` - Backend API client

## ✅ Test

```typescript
import { trpc } from '../services/supabaseFunctions';

// Test çağrısı
const test = async () => {
  try {
    const result = await trpc.call('health', {}, null);
    console.log('Health check:', result);
  } catch (error) {
    console.error('Health check failed:', error);
  }
};
```

## 🎯 Sonuç

Supabase Edge Functions entegrasyonu tamamlandı. Artık:
- ✅ tRPC endpoint'lerini kullanabilirsiniz
- ✅ Generic Edge Functions çağırabilirsiniz
- ✅ Authentication token ile güvenli çağrılar yapabilirsiniz
- ✅ Backend ve Supabase arasında seçim yapabilirsiniz


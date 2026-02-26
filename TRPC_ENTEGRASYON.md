# ✅ tRPC Entegrasyonu - Supabase Edge Functions

## 🎯 Amaç

Network error'ları çözmek için Supabase Edge Functions (tRPC) üzerinden bağlanma sistemi eklendi.

## ✅ Yapılan Değişiklikler

### 1. **app.config.js**
- ✅ `EXPO_PUBLIC_USE_TRPC: "true"` eklendi
- ✅ tRPC kullanımını kontrol eden flag

### 2. **dataService.ts**
- ✅ tRPC desteği eklendi
- ✅ `USE_TRPC` flag'i ile backend API veya tRPC seçimi
- ✅ tRPC hatası durumunda otomatik backend API fallback
- ✅ `getTesis()` ve `getOdalar()` metodları tRPC destekli

### 3. **supabaseFunctions.ts**
- ✅ tRPC endpoint formatı düzeltildi: `/trpc/{procedure}`
- ✅ Geliştirilmiş hata yönetimi
- ✅ Network error için detaylı loglama

## 🔄 Veri Yükleme Akışı

### tRPC Modu (USE_TRPC = true)
```
1. tRPC endpoint'e istek gönder
   └─ /trpc/tesis.get veya /trpc/oda.list

2. Başarılı ise → Veriyi döndür

3. Hata varsa → Backend API'ye fallback
   └─ http://10.0.2.2:8080/api/tesis
```

### Backend API Modu (USE_TRPC = false)
```
1. Backend API'ye istek gönder
   └─ http://10.0.2.2:8080/api/tesis

2. Başarılı ise → Veriyi döndür

3. Hata varsa → Cache'den dön
```

## 📋 tRPC Procedure'ları

### Tesis Bilgileri
- **Procedure**: `tesis.get`
- **Input**: `{}`
- **Response**: 
  ```typescript
  {
    tesis: {
      id: string;
      tesisAdi: string;
      paket: string;
      kota: number;
      kullanilanKota: number;
      kbsTuru?: string;
    };
    ozet: {
      toplamOda: number;
      doluOda: number;
      bugunGiris: number;
      bugunCikis: number;
      hataliBildirim: number;
    };
  }
  ```

### Odalar Listesi
- **Procedure**: `oda.list`
- **Input**: `{ filtre: string }`
- **Response**:
  ```typescript
  {
    odalar: OdaData[];
  }
  ```

## 🔧 Yapılandırma

### app.config.js
```javascript
extra: {
  EXPO_PUBLIC_USE_TRPC: "true", // tRPC kullan
  // veya
  EXPO_PUBLIC_USE_TRPC: "false", // Backend API kullan
}
```

### Environment Variables
Expo'da environment variables `app.config.js` içindeki `extra` objesinden otomatik olarak `process.env`'e aktarılır.

## 🚀 Kullanım

### Otomatik Seçim
DataService otomatik olarak `USE_TRPC` flag'ine göre doğru endpoint'i seçer:

```typescript
// tRPC kullan
const tesis = await dataService.getTesis();

// Backend API kullan (fallback)
// Otomatik olarak backend API'ye geçer
```

### Manuel Kontrol
```typescript
// tRPC kullanımını kontrol et
const USE_TRPC = process.env.EXPO_PUBLIC_USE_TRPC === 'true';

if (USE_TRPC) {
  // tRPC kullan
  const result = await trpc.call('tesis.get', {});
} else {
  // Backend API kullan
  const response = await api.get('/tesis');
}
```

## ✅ Avantajlar

1. **Network Error Çözümü**
   - Supabase Edge Functions cloud'da çalışır
   - Local backend'e bağımlılık yok

2. **Otomatik Fallback**
   - tRPC hatası durumunda backend API'ye geçer
   - Kullanıcı deneyimi kesintisiz

3. **Esnek Yapılandırma**
   - `USE_TRPC` flag'i ile kolayca değiştirilebilir
   - Development ve production için farklı ayarlar

4. **Cache Desteği**
   - Her iki modda da cache çalışır
   - Hızlı yükleme garantisi

## 🔍 Debug

### tRPC Logları
```
[LOG] Supabase tRPC request { procedure: 'tesis.get', url: '...', ... }
[LOG] Supabase tRPC response { status: 200, hasData: true }
```

### Hata Durumu
```
[ERROR] Supabase tRPC error { procedure: 'tesis.get', message: '...', ... }
[ERROR] tRPC tesis error, falling back to backend API
```

## 📝 Notlar

- tRPC endpoint formatı: `/trpc/{procedure}`
- Supabase Edge Functions URL: `https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1`
- tRPC hatası durumunda otomatik backend API fallback
- Cache her iki modda da çalışır


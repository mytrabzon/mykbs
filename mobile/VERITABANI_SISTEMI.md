# 🗄️ Veritabanı ve Veri Yönetim Sistemi

## 📋 Genel Bakış

Bu sistem, mobile app'in backend veritabanından veri çekmesini, cache'lemesini ve senkronize etmesini sağlar.

## 🏗️ Mimari

```
┌─────────────────┐
│  Mobile App     │
│                 │
│  ┌───────────┐  │
│  │ Screens   │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │DataService│  │ ← Merkezi Veri Yönetimi
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │   API     │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │
         ▼
┌─────────────────┐
│   Backend API   │
│                 │
│  ┌───────────┐  │
│  │  Prisma   │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │ SQLite DB │  │
│  └───────────┘  │
└─────────────────┘
```

## 🔧 DataService Özellikleri

### 1. **Otomatik Cache Yönetimi**
- Veriler otomatik olarak AsyncStorage'da cache'lenir
- Cache süresi: 5 dakika
- Offline durumda cache'den veri sağlanır

### 2. **Veri Senkronizasyonu**
- Tüm veriler tek yerden yönetilir
- Otomatik senkronizasyon
- Force refresh desteği

### 3. **Hata Yönetimi**
- Network hatalarında cache'den devam
- Detaylı hata loglama
- Kullanıcı dostu hata mesajları

### 4. **Event System**
- Veri güncellemeleri için event sistemi
- Dinleyiciler (listeners) ile reactive updates

## 📊 Veri Modelleri

### TesisData
```typescript
{
  id: string;
  tesisAdi: string;
  paket: string;
  kota: number;
  kullanilanKota: number;
  kbsTuru?: string;
  ozet: {
    toplamOda: number;
    doluOda: number;
    bugunGiris: number;
    bugunCikis: number;
    hataliBildirim: number;
  };
}
```

### OdaData
```typescript
{
  id: string;
  odaNumarasi: string;
  odaTipi: string;
  kapasite: number;
  fotograf?: string;
  durum: 'bos' | 'dolu' | 'temizlik' | 'bakim';
  fiyat?: number;
  misafir?: {
    id: string;
    ad: string;
    soyad: string;
    girisTarihi: string;
    cikisTarihi?: string;
  };
  kbsDurumu?: string;
  kbsHataMesaji?: string;
}
```

### MisafirData
```typescript
{
  id: string;
  ad: string;
  soyad: string;
  kimlikNo: string;
  pasaportNo?: string;
  dogumTarihi: string;
  uyruk: string;
  girisTarihi: string;
  cikisTarihi?: string;
  odaId: string;
  odaNumarasi: string;
}
```

## 🚀 Kullanım

### Temel Kullanım

```typescript
import { dataService } from '../services/dataService';

// Tesis bilgilerini getir
const tesis = await dataService.getTesis();

// Odaları getir (filtreli)
const odalar = await dataService.getOdalar('tumu'); // tumu, bos, dolu, hatali

// Misafirleri getir
const misafirler = await dataService.getMisafirler();

// Tüm verileri senkronize et
const { tesis, odalar, misafirler } = await dataService.syncAll();
```

### Force Refresh

```typescript
// Cache'i atla ve API'den yeni veri çek
const tesis = await dataService.getTesis(true);
const odalar = await dataService.getOdalar('tumu', true);
```

### Event Listener

```typescript
// Veri güncellemelerini dinle
const unsubscribe = dataService.subscribe('odalar:updated', (data) => {
  console.log('Odalar güncellendi:', data);
});

// Cleanup
unsubscribe();
```

### Cache Yönetimi

```typescript
// Cache durumunu kontrol et
const status = dataService.getCacheStatus();
console.log('Cache durumu:', status);

// Cache'i temizle
await dataService.clearCache();
```

## 🔄 Veri Akışı

### 1. İlk Yükleme
```
Screen → DataService.getOdalar() 
  → Cache kontrolü (yoksa API'ye git)
  → API çağrısı
  → Veriyi cache'le
  → Screen'e döndür
```

### 2. Sonraki Yüklemeler
```
Screen → DataService.getOdalar() 
  → Cache kontrolü (varsa ve geçerliyse)
  → Cache'den döndür (hızlı!)
```

### 3. Force Refresh
```
Screen → DataService.getOdalar(true) 
  → Cache'i atla
  → API çağrısı
  → Yeni veriyi cache'le
  → Screen'e döndür
```

## 🐛 Hata Yönetimi

### Network Hatası
```typescript
try {
  const odalar = await dataService.getOdalar();
} catch (error) {
  if (error.message === 'Network Error') {
    // Cache'den devam et
    const cached = dataService.odalarCache.get('odalar:tumu');
  }
}
```

### Backend Hatası
- DataService otomatik olarak cache'den devam eder
- Kullanıcıya uygun hata mesajı gösterilir
- Log'lar detaylı şekilde kaydedilir

## 📱 Screen Entegrasyonu

### Örnek: OdalarScreen

```javascript
import { dataService } from '../services/dataService';

const loadData = async (isInitial = false) => {
  try {
    const forceRefresh = !isInitial;
    const [tesis, odalar] = await Promise.all([
      dataService.getTesis(forceRefresh),
      dataService.getOdalar(filtre, forceRefresh)
    ]);
    
    setOzet(tesis?.ozet);
    setOdalar(odalar);
  } catch (error) {
    // Hata yönetimi
  }
};
```

## 🔍 Veri Eşleştirme (Mapping)

Backend'den gelen veriler otomatik olarak mobile app formatına dönüştürülür:

```typescript
// Backend formatı
{
  id: "abc123",
  odaNumarasi: "101",
  durum: "dolu",
  misafirler: [{ ... }]
}

// Mobile app formatı (otomatik dönüşüm)
{
  id: "abc123",
  odaNumarasi: "101",
  durum: "dolu",
  misafir: { ... } // misafirler[0] → misafir
}
```

## ⚡ Performans

- **Cache Hit**: ~1ms (AsyncStorage'dan okuma)
- **API Call**: ~200-500ms (network'e bağlı)
- **Cache Duration**: 5 dakika (ayarlanabilir)

## 🔐 Güvenlik

- Token otomatik olarak API isteklerine eklenir
- Hassas veriler (kimlik no, şifre) maskelenir
- Cache'de hassas veriler saklanmaz

## 📝 Notlar

1. **Cache Süresi**: 5 dakika (CACHE_DURATION)
2. **Offline Support**: Cache sayesinde offline çalışır
3. **Auto Sync**: App foreground'a geldiğinde otomatik sync
4. **Error Recovery**: Network hatalarında cache'den devam

## 🛠️ Geliştirme

### Yeni Veri Tipi Ekleme

1. `dataService.ts`'e yeni interface ekle
2. Get metodu ekle (örn: `getBildirimler()`)
3. Cache key ekle
4. Mapping logic ekle

### Cache Stratejisi Değiştirme

```typescript
// Cache süresini değiştir
const CACHE_DURATION = 10 * 60 * 1000; // 10 dakika

// Cache validation logic'i değiştir
private isCacheValid(): boolean {
  // Özel validation logic
}
```

## ✅ Test Senaryoları

1. ✅ İlk yükleme (cache yok)
2. ✅ Cache'den yükleme
3. ✅ Force refresh
4. ✅ Network hatası (cache'den devam)
5. ✅ Offline mod
6. ✅ Veri güncelleme (event system)
7. ✅ Cache temizleme

## 🎯 Sonuç

Bu sistem sayesinde:
- ✅ Veriler merkezi yönetiliyor
- ✅ Cache ile hızlı erişim
- ✅ Offline destek
- ✅ Hata toleransı
- ✅ Otomatik senkronizasyon
- ✅ Temiz kod yapısı


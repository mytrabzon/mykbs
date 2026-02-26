# ✅ Uygulama İzolasyonu - MyKBS ve MyTrabzon

## ❌ Sorun

Farklı uygulamalar (MyKBS ve MyTrabzon) aynı Expo Go veya development build'de çalışıyorsa:

1. **AsyncStorage Key'leri Karışıyor**
   - Her iki uygulama aynı key'leri kullanıyor
   - `token`, `user`, `tesis` gibi key'ler çakışıyor
   - Cache verileri karışıyor

2. **Environment Variables Karışıyor**
   - `EXPO_PUBLIC_USE_TRPC` gibi flag'ler karışabilir
   - API URL'leri karışabilir

3. **Cache Verileri Karışıyor**
   - Tesis bilgileri karışıyor
   - Oda listeleri karışıyor

## ✅ Çözüm

### 1. **Uygulama Prefix'i Eklendi**

Her AsyncStorage key'ine uygulama prefix'i eklendi:

```javascript
// Önceki (karışan)
'token' → 'mykbs:auth:token'
'user' → 'mykbs:auth:user'

// Yeni (izole)
'@mykbs:auth:token'
'@mykbs:auth:user'
```

### 2. **AuthContext.js**

```javascript
const APP_PREFIX = 'mykbs';

const AUTH_STORAGE_KEYS = {
  TOKEN: `@${APP_PREFIX}:auth:token`,
  USER: `@${APP_PREFIX}:auth:user`,
  TESIS: `@${APP_PREFIX}:auth:tesis`,
};
```

### 3. **dataService.ts**

```javascript
const APP_PREFIX = 'mykbs';

const CACHE_KEYS = {
  TESIS: `@${APP_PREFIX}:data:tesis`,
  ODALAR: `@${APP_PREFIX}:data:odalar`,
  MISAFIRLER: `@${APP_PREFIX}:data:misafirler`,
  LAST_SYNC: `@${APP_PREFIX}:data:lastSync`,
};
```

### 4. **LoginScreen.js**

```javascript
const APP_PREFIX = 'mykbs';

const STORAGE_KEYS = {
  GIRIS_TIPI: `@${APP_PREFIX}:login:giris_tipi`,
  TELEFON: `@${APP_PREFIX}:login:telefon`,
  EMAIL: `@${APP_PREFIX}:login:email`,
  TESIS_KODU: `@${APP_PREFIX}:login:tesis_kodu`,
  PIN: `@${APP_PREFIX}:login:pin`
};
```

## 🔍 Key Formatı

### Önceki Format (Karışan)
```
token
user
tesis
login_giris_tipi
@data:tesis
```

### Yeni Format (İzole)
```
@mykbs:auth:token
@mykbs:auth:user
@mykbs:auth:tesis
@mykbs:login:giris_tipi
@mykbs:data:tesis
```

## ✅ Avantajlar

1. **Tam İzolasyon**
   - Her uygulama kendi verilerini kullanır
   - Key çakışması yok

2. **Kolay Debug**
   - Key'lerde uygulama adı görünür
   - Hangi uygulamaya ait olduğu belli

3. **Güvenlik**
   - Uygulamalar birbirinin verilerine erişemez
   - Token'lar karışmaz

## 🔧 MyTrabzon İçin

MyTrabzon uygulamasında da aynı prefix sistemi kullanılmalı:

```javascript
const APP_PREFIX = 'mytrabzon'; // MyTrabzon için

const AUTH_STORAGE_KEYS = {
  TOKEN: `@${APP_PREFIX}:auth:token`,
  USER: `@${APP_PREFIX}:auth:user`,
  TESIS: `@${APP_PREFIX}:auth:tesis`,
};
```

## 📝 Notlar

- Prefix `app.config.js`'deki `slug` değerinden alınır
- MyKBS: `slug: "mykbs"` → `APP_PREFIX = 'mykbs'`
- MyTrabzon: `slug: "mytrabzon"` → `APP_PREFIX = 'mytrabzon'`
- Her uygulama kendi prefix'ini kullanmalı

## 🚀 Test

1. **MyKBS Uygulaması:**
   - Token kaydedilir: `@mykbs:auth:token`
   - Cache kaydedilir: `@mykbs:data:tesis`

2. **MyTrabzon Uygulaması:**
   - Token kaydedilir: `@mytrabzon:auth:token`
   - Cache kaydedilir: `@mytrabzon:data:tesis`

3. **Sonuç:**
   - Key'ler çakışmaz
   - Veriler izole kalır
   - Her uygulama kendi verilerini kullanır


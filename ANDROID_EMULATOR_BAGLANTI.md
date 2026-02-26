# 📱 Android Emulator Bağlantı Sorunu - Çözüm

## ✅ Backend Durumu

- ✅ **Backend çalışıyor**: Port 8080'de dinliyor
- ✅ **0.0.0.0'da dinliyor**: Tüm network interface'lerde erişilebilir
- ✅ **Health check**: Başarılı (http://localhost:8080/health)

## 🔍 Sorun

Android emulator'den backend'e erişilemiyor:
- URL: `http://10.0.2.2:8080/api`
- Hata: Network Error

## 🔧 Çözüm Adımları

### 1. Backend Çalışıyor mu Kontrol Edin

```powershell
cd C:\MYKBS
.\check-backend.ps1
```

Veya manuel:
```powershell
# Port kontrolü
netstat -ano | findstr ":8080.*LISTENING"

# Health check
Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing
```

### 2. Android Emulator Network Ayarları

Android emulator'ün network ayarlarını kontrol edin:

1. **Emulator Settings** → **Network**
2. **DNS**: `8.8.8.8` veya `8.8.4.4`
3. **Proxy**: Kapalı olmalı

### 3. Mobil Uygulamayı Tamamen Yeniden Başlatın

```powershell
# 1. Expo'yu durdurun (Ctrl+C)
# 2. Cache temizle
cd C:\MYKBS\mobile
npx expo start --clear

# 3. Android emulator'ü yeniden başlatın
# 4. QR kodu tekrar tarayın
```

### 4. Android Emulator'ü Yeniden Başlatın

Bazen emulator'ün network stack'i düzgün çalışmaz:
1. Android emulator'ü kapatın
2. Android Studio'dan yeniden başlatın
3. Uygulamayı tekrar yükleyin

### 5. Alternatif: Fiziksel Cihaz Kullanın

Eğer emulator sorunları devam ederse:

1. **Bilgisayarınızın IP'sini bulun**:
```powershell
cd C:\MYKBS
.\find-my-ip.ps1
```

2. **API config'i güncelleyin**:
`mobile/src/config/api.ts`:
```typescript
const androidHost = "192.168.2.181"; // Fiziksel cihaz için (IP'nizi yazın)
```

3. **Telefon ve bilgisayar aynı WiFi'de olmalı**

## 🐛 Detaylı Sorun Giderme

### Adım 1: Backend Loglarını Kontrol Edin

Backend terminal penceresinde hata var mı?

### Adım 2: Android Emulator Network Test

Android emulator'de terminal açın (adb shell):
```bash
adb shell
ping 10.0.2.2
```

### Adım 3: Firewall Kontrolü

Windows Firewall port 8080'i engelliyor olabilir:
1. Windows Defender Firewall → Advanced Settings
2. Inbound Rules → New Rule
3. Port → TCP → 8080 → Allow
4. Apply

### Adım 4: Antivirus Kontrolü

Antivirus programı portu engelliyor olabilir:
- Windows Defender
- Avast, Norton, vb.
- Port 8080'i whitelist'e ekleyin

## ✅ Hızlı Test

### Backend Test
```powershell
# Backend çalışıyor mu?
Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing
# Başarılı: StatusCode 200
```

### Network Test
```powershell
# Port dinleniyor mu?
netstat -ano | findstr ":8080.*LISTENING"
# Çıktı: TCP    0.0.0.0:8080 ... LISTENING
```

## 🎯 Beklenen Sonuç

Backend çalışıyor ve mobil uygulama reload edildikten sonra:
- ✅ Health check başarılı
- ✅ API istekleri çalışmalı
- ✅ Veritabanı erişilebilir olmalı

## 📚 İlgili Dosyalar

- `mobile/src/config/api.ts` - API URL yapılandırması
- `start-backend-8080.ps1` - Backend başlatma
- `check-backend.ps1` - Durum kontrolü

## ⚠️ Önemli Notlar

1. **10.0.2.2**: Android emulator'ün özel IP'si (host machine'in localhost'u)
2. **0.0.0.0**: Backend tüm network interface'lerde dinliyor (doğru)
3. **Firewall**: Port 8080 açık olmalı
4. **Network**: Emulator ve backend aynı makinede olmalı

## 🔄 Sonraki Adımlar

1. ✅ Backend çalışıyor (kontrol edildi)
2. ⏳ Mobil uygulamayı reload edin
3. ⏳ Android emulator'ü yeniden başlatın (gerekirse)
4. ⏳ Firewall kontrolü yapın


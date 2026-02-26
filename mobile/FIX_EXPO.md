# 🔧 Expo Go Bağlantı Sorunu - Adım Adım Çözüm

## ❌ Sorun: Expo Go'dan Uygulamaya Giremiyorum

### 🔍 Kontrol Listesi

#### 1. Expo Server Çalışıyor mu?

```powershell
cd C:\MYKBS\mobile
npx expo start --clear
```

**Beklenen:** Terminal'de QR kod ve bağlantı bilgileri görünmeli

#### 2. Backend Server Çalışıyor mu?

Yeni bir terminal açın:

```powershell
cd C:\MYKBS\backend
npm run dev
```

**Beklenen:** `Server running on http://0.0.0.0:3000`

#### 3. Aynı WiFi Ağında mısınız?

- Telefon ve bilgisayar **aynı WiFi ağında** olmalı
- Farklı ağlardaysanız: `npx expo start --tunnel`

#### 4. IP Adresi Doğru mu?

```powershell
# IP adresinizi kontrol edin
ipconfig | findstr "IPv4"

# .env dosyasında bu IP olmalı
# EXPO_PUBLIC_API_URL=http://YOUR_IP:3000/api
```

#### 5. Firewall Açık mı?

Windows Firewall port 3000'i engelliyor olabilir:
- Windows Defender Firewall → Advanced Settings
- Inbound Rules → New Rule → Port → TCP → 3000 → Allow

## ✅ Hızlı Çözüm

### Adım 1: Tüm Process'leri Durdur

```powershell
# Tüm node process'lerini durdur
Get-Process node | Stop-Process -Force
```

### Adım 2: Backend'i Başlat (Yeni Terminal)

```powershell
cd C:\MYKBS\backend
npm run dev
```

### Adım 3: Expo'yu Başlat

```powershell
cd C:\MYKBS\mobile
npx expo start --clear
```

### Adım 4: QR Kodu Tarayın

- Expo Go uygulamasını açın
- QR kodu tarayın
- Uygulama açılmalı

## 🚨 Yaygın Hatalar

### "Unable to resolve module"
```powershell
cd mobile
npm install
npx expo start --clear
```

### "Network request failed"
- Backend çalışıyor mu kontrol edin
- IP adresi doğru mu kontrol edin
- Firewall açık mı kontrol edin

### "Connection refused"
- Backend server çalışmıyor
- Port 3000 kullanılıyor olabilir
- IP adresi yanlış olabilir

## 📱 Test

1. Backend test: Browser'da `http://192.168.1.3:3000/health` açın
2. Expo test: QR kodu tarayın
3. Network test: Telefon ve bilgisayar aynı WiFi'de


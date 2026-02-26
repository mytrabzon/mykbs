# 🚨 Expo Go Bağlantı Sorunu - Detaylı Çözüm

## ❌ Sorun: Expo Go'dan Uygulamaya Giremiyorum

### 🔍 Muhtemel Nedenler

1. **Backend Server Çalışmıyor** ❌
2. **Expo Server Çalışmıyor** ❌  
3. **Yanlış IP Adresi** ❌
4. **Firewall Engelliyor** ❌
5. **Farklı WiFi Ağı** ❌
6. **app.json/app.config.js Çakışması** ❌ (Düzeltildi ✅)

## ✅ Adım Adım Çözüm

### ADIM 1: Backend Server'ı Başlatın

**YENİ BİR TERMINAL AÇIN:**

```powershell
cd C:\MYKBS\backend
npm run dev
```

**Kontrol:** Terminal'de şunu görmelisiniz:
```
Server running on http://0.0.0.0:3000
Network: http://192.168.1.3:3000
```

### ADIM 2: IP Adresinizi Kontrol Edin

```powershell
ipconfig | findstr "IPv4"
```

IP adresiniz değiştiyse `.env` dosyasını güncelleyin:

```powershell
cd C:\MYKBS\mobile
# .env dosyasını açın ve şunu değiştirin:
# EXPO_PUBLIC_API_URL=http://YENİ_IP:3000/api
```

### ADIM 3: Expo'yu Başlatın

```powershell
cd C:\MYKBS\mobile
npx expo start --clear
```

**Beklenen:** Terminal'de QR kod görünmeli

### ADIM 4: Firewall Kontrolü

Windows Firewall port 3000'i engelliyor olabilir:

1. **Windows Defender Firewall** → **Advanced Settings**
2. **Inbound Rules** → **New Rule**
3. **Port** → **TCP** → **Specific local ports: 3000** → **Allow**
4. **Apply**

### ADIM 5: Aynı WiFi Kontrolü

- Telefon ve bilgisayar **AYNI WiFi ağında** olmalı
- Farklı ağlardaysanız: `npx expo start --tunnel`

## 🔧 Hızlı Test

### Backend Test:
Browser'da açın: `http://192.168.1.3:3000/health`

Eğer açılmazsa:
- Backend çalışmıyor
- IP adresi yanlış
- Firewall engelliyor

### Expo Test:
1. Expo Go uygulamasını açın
2. QR kodu tarayın
3. Uygulama açılmalı

## 📱 Tunnel Modu (Alternatif)

Eğer aynı WiFi'de değilseniz:

```powershell
cd C:\MYKBS\mobile
npx expo start --tunnel --clear
```

**Not:** Tunnel modu yavaş olabilir ama internet üzerinden çalışır.

## ⚠️ Önemli Notlar

1. **Backend MUTLAKA çalışmalı** - Port 3000
2. **Expo MUTLAKA çalışmalı** - Port 8081
3. **IP adresi doğru olmalı** - localhost çalışmaz!
4. **Firewall açık olmalı** - Port 3000
5. **Aynı WiFi ağı** - veya tunnel modu

## 🎯 Hızlı Komutlar

```powershell
# 1. Backend (YENİ TERMINAL)
cd C:\MYKBS\backend
npm run dev

# 2. Expo (MEVCUT TERMINAL)
cd C:\MYKBS\mobile
npx expo start --clear

# 3. Tunnel Modu (Farklı WiFi)
npx expo start --tunnel --clear
```


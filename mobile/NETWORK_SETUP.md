# Network Kurulum Kılavuzu - Telefondan Erişim

## 🔴 Sorun: "Could not connect to server"

Telefon Expo Go uygulamasından `localhost` adresine erişemez. Bu yüzden API bağlantısı çalışmaz.

## ✅ Çözüm 1: Bilgisayarın IP Adresini Kullan

### Adım 1: Bilgisayarın IP Adresini Bulun

**Windows:**
```powershell
ipconfig
```
`IPv4 Address` değerini bulun (örn: `192.168.1.100`)

**Mac/Linux:**
```bash
ifconfig
# veya
ip addr
```

### Adım 2: .env Dosyasını Güncelleyin

`mobile/.env` dosyasını açın ve şunu değiştirin:

```env
# ÖNCE (çalışmaz)
EXPO_PUBLIC_API_URL=http://localhost:3000/api

# SONRA (çalışır)
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api
```

**ÖNEMLİ:** `192.168.1.100` yerine kendi IP adresinizi yazın!

### Adım 3: Backend Server'ı Başlatın

Backend'in **tüm network interface'lerinde** dinlemesi gerekiyor:

```powershell
cd backend
# .env dosyasında PORT=3000 olduğundan emin olun
npm run dev
```

Backend `http://0.0.0.0:3000` veya `http://localhost:3000` adresinde çalışmalı.

### Adım 4: Firewall Kontrolü

Windows Firewall backend portunu engelliyor olabilir:

1. Windows Defender Firewall → Advanced Settings
2. Inbound Rules → New Rule
3. Port → TCP → 3000 → Allow
4. Apply

### Adım 5: Expo'yu Yeniden Başlatın

```powershell
cd mobile
npm start
# veya
npx expo start --clear
```

## ✅ Çözüm 2: Tunnel Modu (Önerilen)

Tunnel modu internet üzerinden çalışır, aynı WiFi'ye gerek yok:

```powershell
cd mobile
npx expo start --tunnel
```

**Not:** Tunnel modu yavaş olabilir ama her zaman çalışır.

## ✅ Çözüm 3: LAN Modu

Aynı WiFi ağındaysanız:

```powershell
cd mobile
npx expo start --lan
```

## 🔍 Test

1. Expo Go uygulamasını açın
2. QR kodu tarayın
3. Uygulama açıldığında console'da API URL'i göreceksiniz
4. Network hatası varsa, IP adresini kontrol edin

## 📱 Hızlı Test

Backend'in çalıştığını test edin:

```powershell
# Bilgisayarınızdan
curl http://localhost:3000/health

# Telefonunuzdan (aynı WiFi'de)
# Browser'da açın: http://YOUR_IP:3000/health
```

## ⚠️ Önemli Notlar

1. **IP Adresi Değişebilir:** WiFi'ye her bağlandığınızda IP değişebilir
2. **Production:** Production'da gerçek domain kullanın
3. **HTTPS:** Production'da HTTPS kullanın
4. **CORS:** Backend'de CORS ayarlarını kontrol edin

## 🚀 Production için

Production'da `.env` dosyasını şöyle ayarlayın:

```env
EXPO_PUBLIC_API_URL=https://api.mykbs.com/api
```


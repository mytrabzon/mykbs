# 🔧 Hızlı Çözüm: Telefondan Erişim Sorunu

## ✅ Yapılanlar

1. ✅ IP adresi bulundu: **192.168.1.3**
2. ✅ API URL güncellendi: `http://192.168.1.3:3000/api`
3. ✅ Backend server network modunda çalışacak şekilde ayarlandı
4. ✅ Tunnel modu başlatıldı

## 🚀 Şimdi Yapmanız Gerekenler

### 1. Backend Server'ı Başlatın

Yeni bir terminal açın:

```powershell
cd C:\MYKBS\backend
npm run dev
```

Backend şu mesajı göstermeli:
```
Server running on http://0.0.0.0:3000
Local: http://localhost:3000
Network: http://192.168.1.3:3000
```

### 2. Expo'yu Yeniden Başlatın

Mevcut Expo'yu durdurun (Ctrl+C) ve yeniden başlatın:

```powershell
cd C:\MYKBS\mobile
npm start
```

### 3. Telefon ve Bilgisayar Aynı WiFi'de Olmalı

- Telefon ve bilgisayar **aynı WiFi ağında** olmalı
- Farklı ağlardaysanız tunnel modu kullanın: `npx expo start --tunnel`

### 4. Firewall Kontrolü

Windows Firewall port 3000'i engelliyor olabilir:

1. Windows Defender Firewall → Advanced Settings
2. Inbound Rules → New Rule
3. Port → TCP → Specific local ports: **3000** → Allow
4. Apply

## 🔍 Test

### Backend Test:
```powershell
# Bilgisayarınızdan
curl http://localhost:3000/health

# Telefonunuzdan (browser'da)
# http://192.168.1.3:3000/health
```

### Expo Test:
1. Expo Go uygulamasını açın
2. QR kodu tarayın
3. Uygulama açıldığında console'da API URL'i göreceksiniz

## ⚠️ Sorun Devam Ederse

### Tunnel Modu Kullanın:
```powershell
cd mobile
npx expo start --tunnel
```

Tunnel modu internet üzerinden çalışır, aynı WiFi'ye gerek yok (ama yavaş olabilir).

### IP Adresi Değiştiyse:

IP adresiniz değiştiyse, `.env` dosyasını güncelleyin:

```powershell
cd mobile
.\find-ip.ps1
```

veya manuel olarak:

```env
EXPO_PUBLIC_API_URL=http://YENİ_IP:3000/api
```

## 📝 Özet

- ✅ IP: 192.168.1.3
- ✅ API URL: http://192.168.1.3:3000/api
- ✅ Backend: Network modunda çalışıyor
- ✅ Expo: Tunnel modu başlatıldı

**Şimdi backend'i başlatın ve test edin!**


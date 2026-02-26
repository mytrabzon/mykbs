# 🔧 Backend Bağlantı Sorunları - Çözüm

## ❌ Sorun

Mobil uygulama backend'e bağlanamıyor:
- Network Error
- Backend offline
- Veritabanına erişilemiyor

## ✅ Çözüm Adımları

### 1. Backend'i Başlatın

```powershell
cd C:\MYKBS
.\start-backend-8080.ps1
```

### 2. Backend Durumunu Kontrol Edin

```powershell
cd C:\MYKBS
.\check-backend.ps1
```

### 3. Backend Çalışıyor mu Test Edin

Tarayıcıda açın:
```
http://localhost:8080/health
```

Başarılı yanıt:
```json
{
  "status": "ok",
  "timestamp": "2026-01-24T..."
}
```

## 🔍 Sorun Giderme

### Backend Başlamıyor

1. **Port 8080 kullanımda mı?**
```powershell
netstat -ano | findstr ":8080"
```

2. **Node.js çalışıyor mu?**
```powershell
node --version
```

3. **Bağımlılıklar yüklü mü?**
```powershell
cd C:\MYKBS\backend
npm install
```

4. **Prisma client oluşturulmuş mu?**
```powershell
cd C:\MYKBS\backend
npm run generate
```

### Backend Başlıyor ama Bağlanamıyor

1. **Firewall kontrolü**
   - Windows Firewall → Port 8080'i açın
   - Antivirus programı portu engelliyor olabilir

2. **IP adresi kontrolü**
   - Android Emulator: `10.0.2.2:8080`
   - Fiziksel cihaz: Bilgisayarınızın IP'si (örn: `192.168.2.181:8080`)

3. **Backend loglarını kontrol edin**
   - Backend terminal penceresinde hata var mı?
   - Veritabanı bağlantı hatası var mı?

## 📱 Mobil Uygulama İçin

### Android Emulator
- API URL: `http://10.0.2.2:8080/api` ✅ (Zaten ayarlı)

### Fiziksel Cihaz
- Bilgisayarınızın IP'sini bulun:
```powershell
cd C:\MYKBS
.\find-my-ip.ps1
```

- `mobile/src/config/api.ts` dosyasını güncelleyin:
```typescript
const androidHost = "192.168.2.181"; // Fiziksel cihaz için
```

## 🗄️ Veritabanı Bağlantısı

### SQLite Veritabanı
- Dosya: `backend/prisma/dev.db`
- Prisma otomatik olarak bağlanır
- Migration gerekirse:
```powershell
cd C:\MYKBS\backend
npm run migrate
```

## ✅ Kontrol Listesi

- [ ] Backend çalışıyor mu? (`http://localhost:8080/health`)
- [ ] Port 8080 dinleniyor mu?
- [ ] Node.js kurulu mu?
- [ ] Bağımlılıklar yüklü mü?
- [ ] Prisma client oluşturulmuş mu?
- [ ] Firewall portu engelliyor mu?
- [ ] IP adresi doğru mu? (Android emulator: 10.0.2.2)
- [ ] Mobil uygulama reload edildi mi?

## 🚀 Hızlı Çözüm

```powershell
# 1. Backend'i başlat
cd C:\MYKBS
.\start-backend-8080.ps1

# 2. Başka bir terminalde kontrol et
cd C:\MYKBS
.\check-backend.ps1

# 3. Mobil uygulamayı reload et
# Expo Go'da cihazı sallayın → Reload
```

## 📚 İlgili Dosyalar

- `start-backend-8080.ps1` - Backend başlatma scripti
- `check-backend.ps1` - Backend durum kontrolü
- `mobile/src/config/api.ts` - API URL yapılandırması
- `backend/src/server.js` - Backend sunucu

## 🎯 Sonuç

Backend başlatıldıktan sonra:
1. ✅ Health check başarılı olmalı
2. ✅ Mobil uygulama bağlanabilmeli
3. ✅ Veritabanı erişilebilir olmalı

Eğer hala sorun varsa, backend terminal loglarını kontrol edin.


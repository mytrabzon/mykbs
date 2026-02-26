# 🚀 Backend Başlatma Kılavuzu

## ⚡ Hızlı Başlatma

```powershell
cd C:\MYKBS
.\start-backend-8080.ps1
```

## 📋 Otomatik Kontroller

Script şunları otomatik olarak kontrol eder:

1. ✅ **Node.js** kurulu mu?
2. ✅ **node_modules** yüklü mü? (Değilse otomatik yükler)
3. ✅ **Prisma client** oluşturulmuş mu? (Değilse otomatik oluşturur)
4. ✅ **Port 8080** boş mu? (Değilse eski process'leri temizler)

## 🔧 Manuel Başlatma

Eğer script çalışmazsa:

```powershell
cd C:\MYKBS\backend

# Bağımlılıkları yükle
npm install

# Prisma client oluştur
npm run generate

# Veritabanı migration (ilk kurulum için)
npm run migrate

# Backend'i başlat
node src/server.js
```

## ✅ Başarı Kontrolü

Backend başladığında şu mesajları görmelisiniz:

```
Server running on http://0.0.0.0:8080
Local: http://localhost:8080
Network: http://YOUR_IP:8080
```

### Health Check Testi

Tarayıcıda şu adresi açın:
```
http://localhost:8080/health
```

Başarılı yanıt:
```json
{
  "status": "ok",
  "timestamp": "2024-..."
}
```

## 🐛 Sorun Giderme

### Port 8080 Kullanımda

```powershell
# Port'u kullanan process'i bul
netstat -ano | findstr ":8080"

# Process'i durdur (PID'yi değiştirin)
taskkill /PID <PID> /F
```

### Bağımlılık Hataları

```powershell
cd C:\MYKBS\backend
rm -r node_modules
npm install
npm run generate
```

### Veritabanı Hataları

```powershell
cd C:\MYKBS\backend
npm run migrate
```

## 📱 Mobile App Bağlantısı

- **Android Emulator**: `http://10.0.2.2:8080/api` (otomatik)
- **Fiziksel Cihaz**: `http://192.168.4.105:8080/api` (IP'nizi kontrol edin)

IP adresinizi öğrenmek için:
```powershell
ipconfig
```

## 🔄 Otomatik Yeniden Başlatma

Development için `nodemon` kullanın:

```powershell
cd C:\MYKBS\backend
npm run dev
```

Bu şekilde kod değişikliklerinde otomatik yeniden başlar.

## ⚠️ Önemli Notlar

1. **Backend çalışırken terminali kapatmayın**
2. **Backend durdurmak için**: `Ctrl+C`
3. **Firewall**: Port 8080'in açık olduğundan emin olun
4. **Aynı ağ**: Fiziksel cihaz kullanıyorsanız, telefon ve PC aynı WiFi'de olmalı


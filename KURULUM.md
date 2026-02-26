# MyKBS Kurulum Kılavuzu

## Gereksinimler

- Node.js 18+ 
- PostgreSQL 14+
- npm veya yarn

## 1. Backend Kurulumu

```bash
cd backend
npm install

# .env dosyası oluştur
cp .env.example .env
# .env dosyasını düzenle

# Veritabanı migration
npx prisma migrate dev
npx prisma generate

# Sunucuyu başlat
npm run dev
```

Backend `http://localhost:3000` adresinde çalışacaktır.

## 2. Mobil Uygulama Kurulumu

```bash
cd mobile
npm install

# Expo CLI kurulumu (gerekirse)
npm install -g expo-cli

# Uygulamayı başlat
npm start

# iOS için
npm run ios

# Android için
npm run android
```

**Not:** `mobile/.env` dosyası oluşturup `EXPO_PUBLIC_API_URL=http://localhost:3000/api` ekleyin.

## 3. Admin Panel Kurulumu

```bash
cd admin-panel
npm install

# .env.local dosyası oluştur
echo "NEXT_PUBLIC_API_URL=http://localhost:3000/api" > .env.local
echo "NEXT_PUBLIC_ADMIN_SECRET=admin-secret-key" >> .env.local

# Development sunucusunu başlat
npm run dev
```

Admin panel `http://localhost:3001` adresinde çalışacaktır.

## Veritabanı Yapılandırması

PostgreSQL veritabanı oluşturun:

```sql
CREATE DATABASE mykbs;
```

`.env` dosyasında `DATABASE_URL` değerini güncelleyin:

```
DATABASE_URL="postgresql://user:password@localhost:5432/mykbs?schema=public"
```

## Ortam Değişkenleri

### Backend (.env)

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://..."
JWT_SECRET=your-secret-key
JANDARMA_KBS_URL=https://...
POLIS_KBS_URL=https://...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
WHATSAPP_API_KEY=your-whatsapp-key
ADMIN_SECRET=admin-secret-key
```

### Mobile (.env)

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

### Admin Panel (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_ADMIN_SECRET=admin-secret-key
```

## KBS Entegrasyonu

Jandarma ve Polis KBS API URL'lerini `.env` dosyasına ekleyin. Gerçek KBS entegrasyonu için API dokümantasyonuna göre `backend/src/services/kbs/` dosyalarını güncelleyin.

## OCR ve NFC

- **OCR**: Tesseract.js kullanılıyor. Google Vision API için entegrasyon eklenebilir.
- **NFC**: React Native NFC Manager kullanılıyor. Gerçek kimlik okuma için passport.js gibi kütüphaneler gerekebilir.

## Ödeme Entegrasyonu

Apple ve Google abonelik yönetimi için RevenueCat veya benzeri bir servis entegre edilmelidir.

## Güvenlik Notları

1. Production'da güçlü JWT secret kullanın
2. HTTPS kullanın
3. Veritabanı bağlantı bilgilerini güvende tutun
4. Admin secret'ı güçlü bir değerle değiştirin
5. Rate limiting aktif
6. KVKK uyumluluğu için veri maskeleme kullanılıyor

## Sorun Giderme

### Veritabanı bağlantı hatası
- PostgreSQL servisinin çalıştığından emin olun
- DATABASE_URL'in doğru olduğunu kontrol edin

### Migration hataları
```bash
npx prisma migrate reset
npx prisma migrate dev
```

### Port çakışması
`.env` dosyasında PORT değerini değiştirin.

## Production Deployment

1. Environment variables'ı production değerleriyle güncelleyin
2. Database migration'ları çalıştırın
3. SSL sertifikası ekleyin
4. Backend'i PM2 veya benzeri ile çalıştırın
5. Admin panel'i build edin: `npm run build`
6. Mobile app'i App Store ve Google Play'e yükleyin


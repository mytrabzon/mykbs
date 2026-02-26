# MyKBS – Otel Kimlik Bildirim Otomasyonu

MyKBS, konaklama işletmelerinin misafir kimlik/pasaport bilgilerini kamera (OCR) ve NFC (çip okuma) ile alıp, bu bilgileri oda kayıtlarıyla ilişkilendirerek KBS (Jandarma / Polis – EMN) sistemine otomatik bildirim yapan, mobil uygulama + merkezi admin panelden oluşan B2B bir yazılımdır.

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Teknolojiler](#-teknolojiler)
- [Proje Yapısı](#-proje-yapısı)
- [Hızlı Başlangıç](#-hızlı-başlangıç)
- [API Endpoints](#-api-endpoints)
- [Güvenlik](#-güvenlik)
- [Kurulum Detayları](#-kurulum-detayları)

## ✨ Özellikler

### Temel Özellikler
- 📱 **iOS ve Android** mobil uygulama
- 🏨 **Otel/Oda yönetimi** - Oda ekleme, düzenleme, durum takibi
- 📸 **OCR ile kimlik okuma** - Kamera ile otomatik veri çıkarma
- 📡 **NFC ile çipli kimlik okuma** - Çipli kimliklerden doğrudan veri alma
- 🔗 **Jandarma ve Polis KBS entegrasyonu** - Otomatik bildirim sistemi
- 👥 **Admin panel** - Merkezi yönetim ve izleme
- 💳 **Abonelik sistemi** - Apple/Google abonelik desteği
- 📊 **Detaylı raporlama** - Loglama ve audit trail
- 🔒 **KVKK uyumlu** - Veri maskeleme ve güvenlik

## Kurulum

### Backend
```bash
cd backend
npm install
npm run dev
```

### Mobile App
```bash
cd mobile
npm install
# iOS
npm run ios
# Android
npm run android
```

### Admin Panel
```bash
cd admin-panel
npm install
npm run dev
```

## 🛠 Teknolojiler

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **ORM**: Prisma
- **Authentication**: JWT
- **Security**: Helmet.js, Rate Limiting

### Mobile
- **Framework**: React Native
- **Platform**: Expo
- **Navigation**: React Navigation
- **State Management**: React Context
- **NFC**: React Native NFC Manager
- **Camera**: Expo Camera

### Admin Panel
- **Framework**: Next.js 14
- **Language**: TypeScript
- **UI**: React 18
- **HTTP Client**: Axios

### Entegrasyonlar
- **OCR**: Tesseract.js (Google Vision API entegrasyonu hazır)
- **NFC**: React Native NFC Manager
- **Email**: Nodemailer
- **WhatsApp**: Twilio/WhatsApp Business API (skeleton hazır)
- **Payment**: RevenueCat (entegrasyon gerekli)

## 📦 Durum

### ✅ Tamamlanan

- ✅ Backend API (Express.js) - Tüm CRUD işlemleri
- ✅ Veritabanı şeması (Prisma) - İlişkisel veri modeli
- ✅ KBS entegrasyon servisleri (Jandarma/Polis) - Bağlantı testi dahil
- ✅ OCR ve NFC okuma servisleri - API endpoints hazır
- ✅ Mobil uygulama (React Native/Expo) - Tüm ekranlar
- ✅ Admin panel (Next.js) - Dashboard ve yönetim
- ✅ Authentication ve yetkilendirme - JWT + Rol bazlı
- ✅ KVKK uyumlu veri maskeleme - Otomatik maskeleme
- ✅ Loglama ve audit trail - Tüm işlemler kayıtlı
- ✅ Email servisi - Aktivasyon email'leri
- ✅ WhatsApp servisi - Skeleton hazır

### 🔄 Entegrasyon Gereken

- 🔄 Gerçek KBS API bağlantıları - URL'ler ve endpoint'ler yapılandırılmalı
- 🔄 Apple/Google abonelik yönetimi - RevenueCat entegrasyonu
- 🔄 WhatsApp Business API entegrasyonu - Twilio veya resmi API
- 🔄 Gelişmiş OCR (Google Vision API) - Daha yüksek doğruluk için
- 🔄 NFC passport okuma (passport.js) - Gerçek kimlik okuma

## Proje Yapısı

```
MYKBS/
├── backend/              # Node.js/Express API
│   ├── src/
│   │   ├── routes/      # API rotaları
│   │   ├── services/    # KBS, Email, WhatsApp servisleri
│   │   ├── middleware/  # Auth, validation
│   │   └── utils/       # Yardımcı fonksiyonlar
│   └── prisma/          # Veritabanı şeması
├── mobile/              # React Native/Expo App
│   └── src/
│       ├── screens/     # Uygulama ekranları
│       ├── context/     # Auth context
│       └── services/     # API servisleri
├── admin-panel/         # Next.js Admin Dashboard
│   └── src/
│       ├── app/         # Next.js pages
│       ├── components/  # React bileşenleri
│       └── services/     # API servisleri
└── docs/                # Dokümantasyon
```

## 🚀 Hızlı Başlangıç

> **Not**: Detaylı kurulum için [KURULUM.md](./KURULUM.md) dosyasına bakın.

### Gereksinimler

- Node.js 18+ 
- PostgreSQL 14+
- npm veya yarn
- iOS için: Xcode (Mac)
- Android için: Android Studio

### Kurulum Adımları

#### 1. Backend Kurulumu

```bash
cd backend
npm install
cp .env.example .env
# .env dosyasını düzenle (DATABASE_URL, JWT_SECRET, vb.)
npx prisma migrate dev
npx prisma generate
npm run dev
```

Backend `http://localhost:3000` adresinde çalışacaktır.

#### 2. Mobil Uygulama

```bash
cd mobile
npm install
# .env dosyası oluştur: EXPO_PUBLIC_API_URL=http://localhost:3000/api
npm start
# iOS için: npm run ios
# Android için: npm run android
```

#### 3. Admin Panel

```bash
cd admin-panel
npm install
# .env.local dosyası oluştur
echo "NEXT_PUBLIC_API_URL=http://localhost:3000/api" > .env.local
echo "NEXT_PUBLIC_ADMIN_SECRET=admin-secret-key" >> .env.local
npm run dev
```

Admin panel `http://localhost:3001` adresinde çalışacaktır.

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| POST | `/api/auth/basvuru` | Tesis başvurusu | ❌ |
| POST | `/api/auth/aktivasyon` | Aktivasyon ile giriş | ❌ |
| POST | `/api/auth/giris` | PIN ile giriş | ❌ |
| POST | `/api/auth/pin` | PIN belirleme | ✅ |
| GET | `/api/auth/me` | Kullanıcı bilgileri | ✅ |

### Tesis
| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| GET | `/api/tesis` | Tesis bilgileri ve özet | ✅ |
| GET | `/api/tesis/kbs` | KBS ayarları | ✅ |
| PUT | `/api/tesis/kbs` | KBS ayarlarını güncelle | ✅ |
| POST | `/api/tesis/kbs/test` | KBS bağlantı testi | ✅ |

### Oda
| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| GET | `/api/oda` | Oda listesi (filtreli) | ✅ |
| GET | `/api/oda/:id` | Oda detayı | ✅ |
| POST | `/api/oda` | Yeni oda ekle | ✅ |
| PUT | `/api/oda/:id` | Oda güncelle | ✅ |
| DELETE | `/api/oda/:id` | Oda sil | ✅ |

### Misafir
| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| POST | `/api/misafir/checkin` | Check-in işlemi | ✅ |
| POST | `/api/misafir/checkout/:id` | Check-out işlemi | ✅ |
| POST | `/api/misafir/oda-degistir/:id` | Oda değiştir | ✅ |
| PUT | `/api/misafir/:id` | Misafir bilgilerini güncelle | ✅ |

### Bildirim
| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| GET | `/api/bildirim` | Bildirim listesi | ✅ |
| POST | `/api/bildirim/:id/tekrar-dene` | Bildirimi tekrar dene | ✅ |

### OCR & NFC
| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| POST | `/api/ocr/okut` | OCR ile kimlik okuma | ✅ |
| POST | `/api/nfc/okut` | NFC ile kimlik okuma | ✅ |

### Admin
| Method | Endpoint | Açıklama | Auth |
|--------|----------|----------|------|
| GET | `/api/admin/dashboard` | Dashboard istatistikleri | 🔐 Admin |
| GET | `/api/admin/tesisler` | Tesis listesi | 🔐 Admin |
| GET | `/api/admin/tesis/:id` | Tesis detayı | 🔐 Admin |
| POST | `/api/admin/tesis/:id/onayla` | Tesis onayla | 🔐 Admin |
| POST | `/api/admin/tesis/:id/yeni-sifre` | Yeni aktivasyon şifresi | 🔐 Admin |
| PUT | `/api/admin/tesis/:id/paket` | Paket değiştir | 🔐 Admin |
| GET | `/api/admin/tesis/:id/loglar` | Tesis logları | 🔐 Admin |
| GET | `/api/admin/tesis/:id/hatalar` | Tesis hataları | 🔐 Admin |

**Not**: ✅ = JWT token gerekli, 🔐 = Admin yetkisi gerekli

## 🔒 Güvenlik

### Uygulanan Güvenlik Önlemleri

- **JWT Authentication** - Token tabanlı kimlik doğrulama
- **Rol Bazlı Yetkilendirme** - Sahip, Yönetici, Resepsiyon rolleri
- **KVKK Uyumluluğu** - Veri maskeleme (kimlik no, pasaport, ad-soyad)
- **Rate Limiting** - API isteklerinde sınırlama
- **Helmet.js** - Güvenlik başlıkları
- **Audit Trail** - Tüm işlemler loglanır
- **Veri Şifreleme** - Hassas veriler hash'lenir
- **CORS Koruması** - Cross-origin istek kontrolü

### Veri Maskeleme

Sistemdeki hassas veriler otomatik olarak maskelenir:
- **Kimlik No**: `123*****901`
- **Pasaport No**: `AB******12`
- **Ad Soyad**: `A*** Y****`
- **Telefon**: `555***45`

## 📚 Kurulum Detayları

Detaylı kurulum, yapılandırma ve sorun giderme için [KURULUM.md](./KURULUM.md) dosyasına bakın.

### Önemli Notlar

1. **Veritabanı**: PostgreSQL kurulumu ve migration'lar gerekli
2. **Environment Variables**: Her modül için `.env` dosyası yapılandırılmalı
3. **KBS Entegrasyonu**: Gerçek API URL'leri `.env` dosyasına eklenmeli
4. **Production**: HTTPS ve güçlü secret key'ler kullanılmalı

## 🔄 İş Akışı

1. **Tesis Başvurusu** → Admin onayı → Aktivasyon bilgileri (WhatsApp/Email)
2. **İlk Giriş** → Aktivasyon şifresi → PIN belirleme
3. **Oda Yönetimi** → Oda ekleme/düzenleme
4. **Check-in** → NFC/Kamera okuma → Bilgi onayı → KBS bildirimi
5. **Check-out** → Çıkış bildirimi → Oda boşaltma

## 📞 Destek

Sorularınız için:
- Detaylı dokümantasyon: [KURULUM.md](./KURULUM.md)
- API dokümantasyonu: Backend kod yorumları
- Sorun bildirimi: GitHub Issues (varsa)

## 📄 Lisans

Bu proje özel bir yazılımdır. Tüm hakları saklıdır.


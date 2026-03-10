# KBS Prime Sistem Analiz Raporu

Bu rapor proje yapısı, MRZ okuma, kamera, Supabase, Railway ve sorun/çözüm önerilerini kapsar.

---

## 1. PROJE YAPISI

### Framework / Dil
| Bileşen | Teknoloji |
|--------|-----------|
| **Root** | Monorepo (npm workspaces) |
| **Backend** | Node.js, Express 4.x |
| **Mobile** | React Native (Expo SDK 54), React 19 |
| **Admin Panel** | Next.js 14, React 18 |

### Klasör Yapısı (Özet)
```
MYKBS/
├── admin-panel/          # Next.js admin (dashboard, kullanıcılar, satışlar)
├── backend/              # Express API (auth, OCR, scan, misafir, KBS)
│   ├── prisma/           # Veritabanı şeması ve migrasyonlar
│   ├── scripts/          # deploy-railway.js
│   └── src/
│       ├── lib/vision/   # MRZ, OCR, preprocess (Tesseract, Jimp)
│       ├── routes/       # auth, ocr, scan, misafir, kyc, okutulanBelgeler...
│       └── server.js
├── mobile/               # Expo (React Native)
│   ├── src/
│   │   ├── features/     # kyc (MRZ), documentRead, scan
│   │   ├── lib/mrz/      # parseMrz, validateMrz (TD1/TD2/TD3)
│   │   ├── lib/supabase/ # supabase client
│   │   └── services/     # apiSupabase, backendHealth
│   └── patches/          # @corupta/react-native-mrz-reader patch
├── supabase/
│   ├── migrations/       # RLS, storage buckets, verification_* tabloları
│   └── functions/       # Edge functions (auth, checkin, document_scan...)
├── .env                  # SUPABASE_*, EXPO_PUBLIC_*, DATABASE_URL, RAILWAY
└── package.json          # Scripts: start, mobile, backend, admin, deploy
```

### Ana Bağımlılıklar

**Root `package.json`**
- Sadece workspace scriptleri (start, mobile, backend, admin, deploy).

**Backend `package.json`**
- `express`, `@prisma/client`, `prisma`, `@supabase/supabase-js`
- **OCR/MRZ:** `tesseract.js` (^5.0.4), `jimp` (^1.6.0)
- `multer`, `bcryptjs`, `jsonwebtoken`, `axios`, `helmet`, `cors`, `dotenv`

**Mobile `package.json`**
- **MRZ:** `@corupta/react-native-mrz-reader` (^0.1.6)
- **Kamera:** `expo-camera` (~17.0.0), `expo-image-picker` (~17.0.0)
- `@supabase/supabase-js`, `expo`, `react-navigation`, `react-native-nfc-manager`, `react-native-torch`

**Admin Panel `package.json`**
- `next` 14.0.4, `react` 18, `@tanstack/react-query`, `recharts`, `axios`

---

## 2. MRZ OKUMA SİSTEMİ

### Kullanılan OCR Kütüphanesi
- **Backend:** **Tesseract.js** (v5.0.4) — `backend/src/lib/vision/mrz.js`, `backend/src/routes/ocr.js`, `backend/src/lib/vision/documentOcr.js`, `tr_id.js`, `preprocess.js`
- Dil: `tur+eng`, `eng+ara+tur` (ön yüz OCR için).

### MRZ Parsing Kütüphaneleri
- **Backend:** Kendi implementasyonu — `backend/src/lib/vision/mrz.js` (extractMrzFromOcr, parseMrzRaw, TD1/TD2/TD3).
- **Mobile:** Kendi modülü — `mobile/src/lib/mrz/parseMrz.js` (TD1 kimlik 3×30, TD2 2×36, TD3 pasaport 2×44; check digit ICAO 9303).
- **Native tarama (iOS):** `@corupta/react-native-mrz-reader` — kamera canlı MRZ okuyor, ham MRZ string dönüyor; parse yine `mobile/src/lib/mrz/parseMrz.js` ile yapılıyor.

### MRZ Okuma Kodunun Bulunduğu Dosyalar
| Dosya | Amaç |
|-------|------|
| `mobile/src/lib/mrz/parseMrz.js` | TD1/TD2/TD3 parse, check digit, fixMrzOcrErrors, normalizeMrzLines |
| `mobile/src/lib/mrz/validateMrz.js` | MRZ payload doğrulama (süre, format) |
| `mobile/src/features/kyc/MrzScanScreen.js` | MRZ ekranı: native MrzReaderView (iOS) / CameraView + backend (Android), handleMRZRead, processMrzRaw |
| `backend/src/lib/vision/mrz.js` | OCR → extractMrzFromOcr → parseMrzRaw, runMrzPipeline (tek geçiş) |
| `backend/src/routes/ocr.js` | runMrzPipeline (multi-preprocess/PSM), /mrz, /document, /document-base64, parseMrzToPayload |
| `backend/src/routes/scan/mrzParse.js` | POST /api/scan/mrz/parse (JSON body image) |

### Sadece Pasaport MRZ’nin Okunup Kimlik Kartının Okunmamasının Teknik Nedenleri

1. **Platform davranışı**
   - **Android:** `USE_UNIFIED_AUTO_SCAN = true` → Ekranda **expo-camera** `CameraView` var; her ~2.5 saniyede bir `takePictureAsync` + `POST /api/ocr/document-base64` ile backend’e gidiyor. Backend hem TD1 (3×30 kimlik) hem TD3 (2×44 pasaport) destekliyor. Yani Android’de teoride kimlik de okunabilir; sorun genelde OCR kalitesi veya crop/ön işlemeden kaynaklanır.
   - **iOS:** `USE_UNIFIED_AUTO_SCAN = false` → Ekranda **sadece** `@corupta/react-native-mrz-reader` içindeki **MrzReaderView** kullanılıyor. Bu kütüphanenin iOS tarafında **sadece 2 satırlık (TD3 pasaport) MRZ** için optimize edilmiş veya ID_CARD modunda 3 satırlık MRZ’yi yeterince iyi üretmiyor olması muhtemel. Yani “sadece pasaport” davranışı büyük ölçüde **iOS’taki native MRZ okuyucunun kimlik (TD1) desteğinin zayıf/eksik olmasından** kaynaklanıyor.

2. **Backend MRZ çıkarımı (kimlik vs pasaport)**
   - `backend/src/lib/vision/mrz.js` içinde `extractMrzFromOcr` ve `normalizeMrzLines`:
     - TD1 (kimlik): 86–94 karakter, **88 hariç** (88 pasaport ile karışmasın diye).
     - TD3 (pasaport): 80–96 karakter (2×44).
   - OCR çıktısı bazen 3 satır yerine tek blok veya 2 satır verebiliyor; bu da kimlik MRZ’nin atlanmasına veya pasaport gibi yorumlanmasına yol açabilir.

3. **Varsayılan mod**
   - `MrzScanScreen.js`: `scanMode` varsayılanı `DocType.Passport`; yorumda “Tek sistem: her zaman Pasaport modu ile oku” geçiyor. `docTypeForReader` aslında `selectedDocType` ile veriliyor (zorla Pasaport değil), ancak iOS’ta kullanılan native reader Passport’a daha iyi çalışıyor.

**Özet:** Kimlik kartı (TD1) backend ve mobil parse tarafında destekleniyor; asıl sınırlama **iOS’ta sadece native MrzReaderView kullanılması** ve bu kütüphanenin **TD1 (3 satır) yerine TD3 (2 satır)** için tasarlanmış/optimize edilmiş olmasıdır. Android’de ise backend’e giden görüntüde MRZ net değilse veya crop/ön işleme kimlik bandını kesiyorsa kimlik okuma başarısız olur.

---

## 3. KAMERA / GÖRÜNTÜ MODÜLÜ

### Kamera Entegrasyonu
- **expo-camera:** `CameraView`, `useCameraPermissions` — `mobile/src/features/kyc/MrzScanScreen.js`, `FrontDocumentScanScreen.js`, `ScanCameraScreen.tsx`.
- **Native MRZ:** `@corupta/react-native-mrz-reader` içindeki `MrzReaderView` (iOS’ta asıl tarama bu).

### Fotoğraf Çekme / Yakalama Mekanizması
- **Unified (Android):** `MrzScanScreen.js` içinde `unifiedCameraRef` → `CameraView`; `useEffect` içinde `setInterval(runCapture, UNIFIED_CAPTURE_INTERVAL_MS)` (2500 ms). `runCapture`:
  - `unifiedCameraRef.current.takePictureAsync({ quality: 0.85, base64: true })`
  - Sonuç → `api.post('/ocr/document-base64', { imageBase64: photo.base64 })`
- **Ön yüz ekranı:** `frontCameraRef.current.takePictureAsync({ quality: 0.9, base64: false })` → `onFrontPhotoTaken(photo.uri)`.
- **Fallback manuel çekim:** `CameraFallbackView` içinde `cameraRef.current.takePictureAsync(...)`.

### “Resim Almıyor” Sorununun Olası Kaynakları
1. **Ref henüz hazır değil:** `unifiedCameraRef.current` ilk interval tetiklenirken `null` olabilir; `if (!cam?.takePictureAsync) return;` ile sessizce çıkılıyor, ekranda hata görünmez.
2. **onCameraReady gecikmesi:** `unifiedCameraReady` true olmadan interval çalışıyor olabilir; kod `unifiedCameraReady` true iken interval’i başlatıyor ama ilk çekim anında ref bazen hâlâ set edilmemiş olabilir.
3. **takePictureAsync API farkı:** Expo Camera’da `takePictureAsync` bazen `base64: true` ile büyük payload üretir; bazı cihazlarda timeout veya bellek hatası olabilir, hata yakalanıp sadece `logger.warn` ile loglanıyor.
4. **İzin / layout:** İzin verilmeden veya kamera bileşeni mount edilmeden (ör. `unifiedCameraMountReady` gecikmesi) çekim yapılmaya çalışılıyorsa başarısız olur.

### Görüntü İşleme Adımları (Backend)
- `backend/src/routes/ocr.js` içindeki yerel `runMrzPipeline(filePath)`:
  - Tam görüntü + alt/üst crop (bottomFractions, topFractions) + `cropMrzCandidates` + gerekirse döndürme (90, 180, 270) ile birden fazla deneme.
  - Her denemede Tesseract OCR + MRZ satır çıkarımı + parse + check digit; en yüksek skorlu sonuç dönülüyor.
- `backend/src/lib/vision/preprocess.js`: crop, kontrast, ters çevirme (faded MRZ için) vb.

---

## 4. SUPABASE ENTEGRASYONU

### Supabase Client Yapılandırması
- **Mobile:** `mobile/src/lib/supabase/supabase.ts` — `createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true } })`.
- **Backend (admin):** `backend/src/lib/supabaseAdmin.js` — `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` (env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- **Env:** Mobile için `mobile/src/lib/config/env.ts` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BACKEND_URL` (Expo extra veya process.env).

### Storage Bucket Konfigürasyonu
- `supabase/migrations/0025_storage_bucket_documents_private.sql`: `documents` bucket’ı **private** (`public: false`). Politikalar: INSERT/SELECT/UPDATE/DELETE sadece `authenticated` kullanıcılar.
- `supabase/migrations/0024_storage_buckets_avatars_community.sql`: `avatars`, `community` bucket’ları.

### MRZ / Belge Verilerinin Saklandığı Tablolar
- **Supabase:** KYC için `verification_sessions`, `verification_documents`, `verification_scans`, `verification_extracted_fields` (`0014_kyc_verification_tables.sql`). MRZ/NFC/OCR çıktıları `verification_extracted_fields` (fields_json_enc, mrz_raw_enc vb.).
- **Backend (Prisma):** Okutulan belgeler için ayrı bir API var: `POST/GET /api/okutulan-belgeler` — muhtemelen kendi tablosu (Prisma şeması projede mevcut).

### RLS (Row Level Security)
- `verification_*` tablolarında RLS açık; kullanıcı sadece kendi `user_id` ile eşleşen session ve ilgili document/scan/extracted kayıtlarına erişebilir.
- Storage `documents`: sadece authenticated; insert/select/update/delete politikaları bucket `documents` ile sınırlı.

---

## 5. RAILWAY DEPLOYMENT

### Railway’de Çalışan Servis
- Backend API: `backend/scripts/deploy-railway.js` → `railway up --service <serviceId>`.
- `backend/marvelous-generosity.json`: `railway.serviceId`, `railway.url` (örn. mykbs-production.up.railway.app). Kök `.env`’de artık sabit IP kullanılıyor: `EXPO_PUBLIC_BACKEND_URL=http://178.104.12.20`.

### Environment Variables (Özet)
- **Backend / Railway:** `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEBUG_MRZ` (opsiyonel). Deploy script için `RAILWAY_TOKEN` (backend veya kök `.env`).
- **Mobile (Expo):** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_BACKEND_URL`.
- **Kök .env:** Supabase token, Supabase URL/anon key, backend URL, `DATABASE_URL`, `ADMIN_KULLANICI_ID`, `SYNC_BRANCH_SECRET`.

### Build ve Deploy Konfigürasyonu
- Deploy: `npm run deploy` (root) → `backend/scripts/deploy-railway.js`; Railway CLI ile ilgili servise deploy.
- Backend: `npm start` → `node src/server.js`; `postinstall` → `prisma generate`.

---

## 6. SORUN TESPİTİ

### MRZ Okuma Fonksiyonunda Hata Ayıklama Logları
- **Backend:** `backend/src/routes/ocr.js` içinde `DEBUG_MRZ = process.env.DEBUG_MRZ !== '0' && process.env.DEBUG_MRZ !== 'false'`. Açıkken bölge/satır/payload logları yazılıyor. Ayrıca `[document-base64]`, `[document-front-back]` vb. prefix’li `console.log` / `console.warn` / `console.error` kullanılıyor (storage yazma, runMrzPipeline başlangıç/bitiş, Tesseract, hata mesajları).
- **Mobile:** `logger.info` / `logger.warn` (örn. `[MRZ]`, `[Unified scan]`, `[Galeri kimlik]`) — `mobile/src/utils/logger` üzerinden.

### Konsol Hatalarını Görmek İçin
- Backend: Sunucu stdout/stderr (Railway logları veya lokal terminal).
- Mobile: Metro/Expo konsolu ve cihaz logları; `__DEV__` ile debug metinleri (örn. MRZ ekranında isScreenFocused/isExiting).

### API Endpoint’leri (Özet) ve Çalışma Durumu
| Endpoint | Açıklama | Auth | Kontrol Önerisi |
|----------|----------|------|------------------|
| POST /api/ocr/mrz | Tek görsel MRZ | authenticateTesisOrSupabase | FormData image |
| POST /api/ocr/document | Tek görsel belge (MRZ+ön yüz) | authenticateTesisOrSupabase | FormData image |
| POST /api/ocr/document-base64 | Base64 tek görsel (unified Android) | authenticateTesisOrSupabase | JSON imageBase64 |
| POST /api/ocr/document-front-back | Ön + arka base64 | authenticateTesisOrSupabase | JSON frontBase64, backBase64 |
| POST /api/scan/mrz/parse | JSON body ile MRZ parse | authenticateTesisOrSupabase | JSON (görsel/base64) |
| POST /api/scan/doc/parse | Doküman parse | authenticateTesisOrSupabase | - |
| POST /api/okutulan-belgeler | Okutulan belge kaydı | - | JSON body |
| GET /api/auth/me | Me | authenticateTesisOrSupabase | - |

Çalışıp çalışmadığını doğrulamak için: Backend’e Authorization header ile istek atıp 200/400/500 ve cevap gövdesine bakın; document-base64 için base64’lü küçük bir test görseli gönderin.

---

## 7. ÇÖZÜM ÖNERİLERİ

### Kimlik Kartı MRZ Desteğini Güçlendirmek
1. **iOS:** `@corupta/react-native-mrz-reader` kütüphanesinin ID_CARD (TD1) modunda 3 satır MRZ üretip üretmediğini dokümantasyon ve testle kontrol edin. Destek yoksa:
   - Alternatif: iOS’ta da Android gibi **unified akış** (expo-camera + periyodik çekim + `/api/ocr/document-base64`) kullanılabilir; böylece backend’deki TD1 desteği iOS’ta da devreye girer.
2. **Backend:** `extractMrzFromOcr` / `normalizeMrzLines` içinde 3 satırlı (TD1) adayları daha agresif deneyin; örn. satır uzunlukları 28–32 olan 3 satırı her zaman TD1 olarak ele alıp parse edin, check digit hatalarında da “best effort” payload dönmeye devam edin.
3. **Mobil parse:** `parseMrz.js` zaten TD1 destekliyor; backend’den gelen veya galeriden giden kimlik MRZ’leri için aynı payload formatı kullanılmaya devam edilebilir.

### Fotoğraf Çekme Özelliğini Aktifleştirmek / Düzeltmek
1. **Ref ve hazırlık:** Unified akışta interval’i **yalnızca** `unifiedCameraReady === true` olduktan sonra başlatın; ilk çalıştırmada bir kez `unifiedCameraRef.current?.takePictureAsync` kontrolü yapıp yoksa 500–1000 ms sonra tekrar deneyin.
2. **Hata geri bildirimi:** `takePictureAsync` veya `api.post('/ocr/document-base64')` hata verirse kullanıcıya Toast ile “Fotoğraf alınamadı” / “Bağlantı hatası” gösterin; sadece `logger.warn` bırakmayın.
3. **base64 boyutu:** Büyük görsellerde timeout veya 413 önlemek için kaliteyi (örn. 0.7) veya çözünürlüğü düşürün; gerekirse backend’de limit’i kontrol edin (şu an 8mb).
4. **İzin ve mount:** Kamera izni ve `unifiedCameraMountReady` (ve varsa layout) tamamlanmadan interval’i başlatmayın; gerekirse “Kamera hazır” göstergesi kullanın.

### Genel Kod İyileştirmeleri
- **DEBUG_MRZ:** Production’da kapalı; geliştirme/debug için Railway’de geçici açılabilir, loglar izlenir.
- **MRZ failure reason:** Backend’deki `buildMrzFailureReason` zaten kullanıcıya anlamlı mesaj veriyor; mobil tarafta bu mesajı her zaman gösterin.
- **Tekil sorumluluk:** OCR route’taki yerel `runMrzPipeline` ile `lib/vision/mrz.js` içindeki `runMrzPipeline` imzası/return formatı farklı; tek bir pipeline (ör. lib’deki gelişmiş multi-attempt) kullanıp route’un sadece onu çağırması okunabilirliği artırır.
- **API testi:** `/api/ocr/document-base64` ve `/api/ocr/mrz` için Postman/curl ile sabit bir test görseli ile 200 + mrz/mrzPayload dönüşünü doğrulayın.

---

## Özet Kontrol Listesi

- [ ] Android: Unified kamera ref’i `onCameraReady` sonrası set ediliyor mu, ilk çekimde ref null mı kontrol et.
- [ ] iOS: Kimlik okuma için ya MrzReaderView TD1 desteği test edilsin ya da iOS’ta unified (CameraView + document-base64) akışı açılsın.
- [ ] Backend: TD1 (3×30) MRZ çıkarımı için OCR satır filtrelemesi ve normalizeMrzLines davranışı gözden geçirilsin.
- [ ] Hata mesajları: takePictureAsync ve document-base64 hatalarında kullanıcıya Toast gösterilsin.
- [ ] DEBUG_MRZ: Gerekirse staging’de açılıp MRZ pipeline logları izlensin.

Bu rapor, mevcut kod tabanına (klasör yapısı, package.json, MRZ/kamera/Supabase/Railway ile ilgili dosyalar) dayanarak hazırlanmıştır.

---

## B2B DÖNÜŞÜM UYGULAMA ÖZETİ (KBS Prime)

Aşağıdaki adımlar uygulandı; hangi dosyaların değiştiği ve yeni dosyalar listelenmiştir.

### 1. Multi-tenant veritabanı

| Nerede | Ne yapıldı |
|--------|------------|
| **Supabase** | `supabase/migrations/0027_multi_tenant_b2b.sql`: `tenants`, `tenant_kullanicilar` tabloları; `verification_sessions` ve `verification_documents` tablolarına `tenant_id` sütunu eklendi. |
| **Prisma** | `backend/prisma/schema.prisma`: `Tenant` modeli; `Tesis.tenantId` (opsiyonel); `OkutulanBelge.tenantId` (opsiyonel). |
| **Prisma migration** | `backend/prisma/migrations/20260310100000_multi_tenant_b2b/migration.sql`: `tenants` tablosu, `Tesis.tenant_id`, `OkutulanBelge.tenant_id` ve FK. |

**Çalıştırma:** Supabase için `supabase db push` veya migration’ları uygula; backend için `npx prisma migrate deploy` (veya `prisma migrate dev`).

### 2. Backend tenant middleware

| Dosya | Değişiklik |
|-------|------------|
| **Yeni** | `backend/src/middleware/tenant.js`: `tenantMiddleware`, `getTenantIdForRecord`. Header `X-Tenant-ID` veya JWT `tenantId`; yoksa `req.tesis?.id` / `req.branchId` kullanılır. |
| `backend/src/routes/ocr.js` | `document-base64` route’una `tenantMiddleware` eklendi. |
| `backend/src/routes/okutulanBelgeler.js` | `router.use(tenantMiddleware)` ve create’te `tenantId: getTenantIdForRecord(req)` kullanımı. |

### 3. iOS MRZ unified akış + otomatik çekim + hata toast

| Dosya | Değişiklik |
|-------|------------|
| `mobile/src/features/kyc/MrzScanScreen.js` | `USE_UNIFIED_AUTO_SCAN = true` (iOS da unified kullanıyor). Otomatik çekimde `cam?.takePictureAsync` ref kontrolü sıkılaştırıldı; catch’te `Toast.show({ type: 'error', text1: 'Okuma hatası', text2 })` eklendi. |

### 4. Merkez panel (senin panelin)

| Dosya | Açıklama |
|-------|----------|
| `admin-panel/src/app/(dashboard)/musteriler/page.tsx` | Müşteri listesi (tenant API bağlanacak). |
| `admin-panel/src/app/(dashboard)/musteriler/yeni/page.tsx` | Yeni müşteri formu. |
| `admin-panel/src/app/(dashboard)/musteriler/[id]/page.tsx` | Müşteri detay. |
| `admin-panel/src/app/(dashboard)/musteriler/[id]/duzenle/page.tsx` | Müşteri düzenle. |
| `admin-panel/src/app/(dashboard)/musteriler/[id]/raporlar/page.tsx` | Müşteri raporları. |
| `admin-panel/src/app/(dashboard)/lisanslar/page.tsx` | Lisans yönetimi ana sayfa. |
| `admin-panel/src/app/(dashboard)/lisanslar/paketler/page.tsx` | Paket tanımları. |
| `admin-panel/src/app/(dashboard)/lisanslar/odemeler/page.tsx` | Ödeme takibi. |
| `admin-panel/src/app/(dashboard)/destek/page.tsx` | Destek talepleri. |
| `admin-panel/src/app/(dashboard)/destek/ticket/[id]/page.tsx` | Ticket detay. |
| `admin-panel/src/components/AdminSidebar.tsx` | Menüye Müşteriler (B2B), Lisanslar, Destek linkleri eklendi. |

### 5. Müşteri paneli (tema + dashboard + belge)

| Dosya | Açıklama |
|-------|----------|
| `mobile/src/theme/colors.js` | B2B paleti: `COLORS` (primary turkuaz, secondary mor, roomAvailable/roomOccupied/roomCleaning/roomMaintenance). |
| `mobile/src/features/dashboard/components/RoomGrid.jsx` | Büyük oda kartları, durum renkleri, MRZ/İşlem butonları. |
| `mobile/src/features/dashboard/components/StatsCards.jsx` | Doluluk, bugün check-in, okutulan belge istatistik kartları. |
| `mobile/src/features/documents/utils/documentFilter.js` | `filterDocumentsBySearch`, `groupDocumentsByRoom`, `sortRoomKeys` (oda bazlı gruplama ve arama). |

**Sonraki adımlar (isteğe bağlı):** Merkez panelde tenant CRUD API (GET/POST/PATCH `/api/admin/tenants`); mobil ana sayfada `StatsCards` + `RoomGrid` entegrasyonu; belgeler ekranında oda bazlı gruplama ve `documentFilter` kullanımı.

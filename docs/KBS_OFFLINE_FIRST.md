# KBS Offline-First ve Senkronizasyon

## Amaç

Resepsiyonist 100 pasaport okuttuğunda internet giderse kayıtlar kaybolmasın; her okuma önce cihazda saklansın, internet gelince otomatik veya manuel senkronize edilsin.

## Akış

1. **Okuma anında:** Her check-in önce cihazdaki SQLite tablosuna (`kbs_queue`) yazılır.
2. **İnternet varken:** Aynı anda veya hemen sonra backend'e tek istek (`POST /api/checkin` veya `/api/misafir/checkin`) atılır; başarılıysa kuyruktan silinir.
3. **İnternet yoksa:** Kayıt sadece kuyrukta kalır; kullanıcıya "Kayıt bekleyecek, internet gelince gönderilecek" mesajı verilir.
4. **Sync worker:** Uygulama açıkken her 30 saniyede bir bekleyen kuyruk alınır, en fazla 50'şer kayıt `POST /api/checkin/batch` ile gönderilir. Başarılı olanlar kuyruktan silinir, başarısızlar `retry_count` artırılır; 10 denemeden sonra `error` işaretlenir.
5. **Receptionist panel:** "Daha Fazla" → "KBS Senkronizasyon" ekranından bekleyen/başarısız sayıları, manuel "Senkronize et" ve "Başarısızları tekrar dene" kullanılır.

## Dosyalar

| Bölüm | Dosya |
|--------|--------|
| Mobil kuyruk | `mobile/src/services/offlineKbsDB.js` (expo-sqlite) |
| Sync worker | `mobile/src/services/kbsSyncWorker.js` |
| Backend batch | `backend/src/routes/api/checkin.js` → `POST /api/checkin/batch` |
| Check-in entegrasyonu | `mobile/src/screens/CheckInScreen.js` (saveToQueue + API + delete on success) |
| Resepsiyon paneli | `mobile/src/screens/ReceptionistPanelScreen.js` |
| Menü | `mobile/src/screens/DahaFazlaScreen.js` → "KBS Senkronizasyon" |

## Backend batch API

- **URL:** `POST /api/checkin/batch`
- **Auth:** Aynı token (Bearer); `branchId` token'dan alınır.
- **Body:** `{ "notifications": [ { "local_id", "ad", "soyad", "kimlikNo?", "pasaportNo?", "dogumTarihi", "uyruk", "room_number" }, ... ] }`
- **Limit:** En fazla 100 kayıt.
- **Yanıt:** `{ "processed", "success", "failed", "details": { "success": [ { "local_id", "guest_id" } ], "failed": [ { "local_id", "error" } ] } }`

Her kayıt için: Supabase `guests` insert + `kbs_outbox` insert; KBS worker arka planda Jandarma/Polis'e gönderir.

## Kuyruk tablosu (SQLite)

- `id` (TEXT PK), `branch_id`, `misafir_data` (JSON string), `oda_no`, `created_at`, `sync_status` ('pending'|'error'), `retry_count`, `last_error`.

## Sonraki adımlar (isteğe bağlı)

- **Ses / titreşim:** Başarı/hata için bildirim sesi ve titreşim (expo-av, expo-haptics).
- **Push bildirim:** Toplu sync bittiğinde push (Firebase/Notifee).
- **Admin dashboard:** Tesis bazlı bekleyen/başarısız sayıları ve oda haritası (backend'de branch bazlı kuyruk istatistiği API'si gerekir).

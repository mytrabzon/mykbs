# Polis / Jandarma Kimlik Bildirimi (KBS) – Mevcut Durum

## Kısa cevap

**Hayır.** Şu anki yapıda **sadece Supabase + mobil uygulama** ile çalışıyorsanız, kimlik bilgileri **polise veya jandarmaya otomatik bildirilmiyor**. Veriler yalnızca kendi Supabase veritabanınızda tutuluyor.

Yasal açıdan “polis/jandarmaya bildirim” için, resmi KBS web servislerine (Emniyet / Jandarma) **tesis kodu ve şifre ile** bağlanıp bildirim göndermeniz gerekir. Bu entegrasyon şu an **sadece Node backend** tarafında var; Supabase/Edge Functions tarafında **yok**.

---

## Projede ne var?

### 1. Node backend (Express) – KBS kodu var

- **Konum:** `backend/src/services/kbs/`
- **Dosyalar:** `polis.js`, `jandarma.js`
- **Ne yapıyor:** Tesis kodu + web servis şifresi ile Polis veya Jandarma KBS API’sine HTTP isteği atıyor (giriş/çıkış/oda değişikliği bildirimi).
- **Gereken env:** `POLIS_KBS_URL` veya `JANDARMA_KBS_URL` (resmi API adresi), tesis kodu ve şifre ise tesis ayarlarında.

**Önemli:** Siz şu an backend’i kullanmıyorsunuz; tüm istekler Supabase Edge Functions’a gidiyor. Bu yüzden bu KBS kodu **şu an çalışmıyor**.

### 2. Supabase + mobil uygulama – KBS gönderimi yok

- **Check-in:** `checkin_create` Edge Function sadece `guests` ve `audit_logs` tablolarına yazıyor. Polis/jandarma’ya **hiçbir istek atılmıyor**.
- **notification_dispatch:** `notifications` tablosundaki kayıtları `KBS_INSTITUTION_ENDPOINT` adresine POST ediyor. Ama:
  - Check-in akışı bu tabloya **KBS bildirimi için kayıt eklemiyor**.
  - Resmi Polis/Jandarma API formatı (tesis kodu, şifre, alanlar) burada **tanımlı değil**.
- **Sonuç:** Supabase tarafında “resmi makamlara kimlik bildirimi” akışı **yok**.

### 3. Mobil uygulama

- Ayarlar’da “KBS türü” (Polis / Jandarma), tesis kodu, web servis şifresi alanları var.
- Bu ayarlar `settings_get` / `settings_update` ile okunup yazılıyor; ama **Supabase tarafında bu ayarları kullanıp KBS’e istek atan bir fonksiyon yok**.

---

## Polis/Jandarma’ya bildirim için ne gerekir?

1. **Resmi başvuru:** İl Emniyet Müdürlüğü veya Jandarma’dan **tesis kodu** ve **web servis şifresi** (ve gerekirse API dokümanı/adresi) alınması.
2. **Teknik entegrasyon:** Bu bilgilerle resmi KBS API’sine (giriş/çıkış/oda değişikliği) istek atan bir katman.

Bu katman şu an yalnızca **Node backend**’te var; Supabase-only kullandığınız için **devre dışı**.

---

## Seçenekler

| Seçenek | Açıklama |
|--------|-----------|
| **A) Node backend’i kullanmak** | Backend’i ayağa kaldırıp mobil istekleri oraya yönlendirirsiniz. Check-in vb. backend’e gider, backend KBS servislerini (`polis.js` / `jandarma.js`) kullanarak polis/jandarma’ya bildirir. |
| **B) Supabase’e KBS entegrasyonu eklemek** | Check-in (ve gerekirse çıkış/oda değişikliği) sonrası, Edge Function içinde tesis KBS ayarlarını okuyup resmi Polis/Jandarma API’sine istek atan bir akış yazılır. Tesis kodu ve şifre Supabase’de (örn. branch ayarları veya secrets) tutulur. |
| **C) Sadece kayıt, bildirim yok** | Veriler yalnızca Supabase’de kalır; polis/jandarma’ya otomatik bildirim yapılmaz. Yasal zorunluluk varsa bu **yeterli olmaz**. |

---

## Özet

- **Şu an:** Supabase + uygulama = veri **sadece sizin veritabanınızda**. Polis/jandarma’ya **otomatik bildirim yok**.
- **Polis/jandarma’ya bildirim için:** Resmi KBS API’si ile entegrasyon şart. Bu ya backend’i kullanarak (mevcut kod) ya da Supabase Edge Functions’a aynı mantığı ekleyerek yapılabilir.

---

## Seçenek A uygulandı (KBS Node backend)

- **Backend:** `backend/` — Express, Supabase service_role, `/api/checkin`, `/api/checkout`, `/api/room-change`, `/health`. KBS outbox worker 1 dk’da bir pending kayıtları Polis/Jandarma’ya (veya mock’a) gönderir.
- **Supabase:** `branches.kbs_turu`, `kbs_tesis_kodu`, `kbs_web_servis_sifre` — Ayarlar ekranından otel tesis kodu/şifre bağlanır. `kbs_outbox` tablosu retry kuyruğu.
- **Mobil:** `EXPO_PUBLIC_BACKEND_URL` tanımlıysa health ve check-in/checkout istekleri backend’e gider; yoksa Supabase Edge Functions.
- **Deploy:** Railway/Render; `backend/DEPLOY.md` ve `backend/Dockerfile`.

Bu dosya, “Polis/jandarma’ya bildirim şu an var mı?” sorusunun cevabını ve seçenekleri özetlemek için yazıldı.

# Sistem Özeti: KBS, Tesis Kodu, Şifre ve Jandarma Bildirim Akışı

Bu dokümanda kurulu sistemin tamamı — otel tesis kodu ve şifre ekleme, KBS testi ve Jandarma bildirim akışı — adım adım anlatılmaktadır.

---

## 1. Genel Mimari

```
[Mobil Uygulama]  ←→  [Backend API]  ←→  [Jandarma/Polis KBS]
       │                     │
       │                     ├── Veritabanı (Supabase branches / Prisma Tesis)
       │                     └── Ortam değişkeni: JANDARMA_KBS_URL
```

- **Mobil:** Kullanıcı Ayarlar ekranında KBS türü, tesis kodu ve web servis şifresini girer; Kaydet ve Test yapar.
- **Backend:** Bu bilgileri veritabanında saklar; KBS testi ve bildirim isteklerini Jandarma/Polis servisine **JSON body** ile gönderir (şifre asla URL’de değil).
- **KBS:** Jandarma veya Polis tarafındaki resmi Kimlik Bildirim Sistemi; backend’in sunucu IP’si (egress) KBS whitelist’inde olmalıdır.

---

## 2. Tesis Kodu ve Şifre Nerede Saklanıyor?

### 2.1 Veritabanı

| Ortam | Tablo / Kaynak | Kolonlar | Tip |
|--------|-----------------|----------|-----|
| **Supabase (mobil kullanıcı)** | `branches` | `kbs_turu`, `kbs_tesis_kodu`, `kbs_web_servis_sifre` | TEXT (şifre daima TEXT) |
| **Prisma (legacy/backend tesis)** | `Tesis` | `kbsTuru`, `kbsTesisKodu`, `kbsWebServisSifre` | String (TEXT) |

- **Kural:** Şifre alanı her zaman **TEXT** (veya varchar). Sayı (bigint/int) olmaz; `Cn$V?9Pk` gibi özel karakterli şifreler güvenle saklanır.
- Tesis kodu da **TEXT** olarak saklanır (başında 0 olan kodlar bozulmasın diye).

### 2.2 Backend’e Nasıl Gidiyor?

- **Kaydetme:** `PUT /api/tesis/kbs` — Body’de `kbsTuru`, `kbsTesisKodu`, `kbsWebServisSifre` (JSON). URL veya query parametresinde şifre **yok**.
- **Test:** `POST /api/tesis/kbs/test` — Body’de aynı alanlar (JSON). Şifre sadece JSON içinde, encode/kaçış sorunu olmaz.

---

## 3. Mobil Tarafta: Tesis Kodu ve Şifre Ekleme

### 3.1 Ekran

**Ayarlar → “KBS Ayarları (Tesis Bilgileri)”** bölümü:

1. **KBS Türü:** Jandarma KBS / Polis (EMN) KBS seçimi.
2. **KBS Tesis Kodu:** KBS’den alınan tesis kodu (örn. 255579).
3. **Web servis şifresi:** KBS’den alınan şifre (örn. `Cn$V?9Pk` — özel karakterler kabul edilir).
4. İsteğe bağlı: IP kısıtı aç/kapa.

### 3.2 Akış

1. Kullanıcı alanları doldurur.
2. **Kaydet:** `PUT /tesis/kbs` çağrılır; body’de `kbsTuru`, `kbsTesisKodu`, `kbsWebServisSifre` gider. Backend bunu Supabase `branches` (veya Prisma `Tesis`) tablosuna yazar.
3. **Bağlantı testi:** Kullanıcı “Test” butonuna basar → `POST /tesis/kbs/test` çağrılır; body’de yine aynı alanlar (veya zaten kayıtlı branch/tesis bilgisi kullanılır). Backend `createKBSService()` ile Jandarma veya Polis servisini oluşturup `testBaglanti()` çağırır.

### 3.3 Test İsteği Örneği (Backend’e Giden)

```json
POST /api/tesis/kbs/test
Content-Type: application/json

{
  "kbsTuru": "jandarma",
  "kbsTesisKodu": "255579",
  "kbsWebServisSifre": "Cn$V?9Pk"
}
```

Şifre ve tesis kodu **sadece JSON body’de**; URL’de yok.

---

## 4. Backend’de KBS Testi (Jandarma)

1. **Route:** `backend/src/routes/tesis.js` → `POST /kbs/test`.
2. İstek body’den veya oturumdaki branch/tesis kaydından `kbsTuru`, `kbsTesisKodu`, `kbsWebServisSifre` alınır.
3. **Servis:** `createKBSService(tesisLike)` → `backend/src/services/kbs/index.js`:
   - `jandarma` → `JandarmaKBS(tesisKodu, webServisSifre, ipAdresleri)`.
   - `polis` → `PolisKBS(...)`.
4. **Jandarma servisi:** `backend/src/services/kbs/jandarma.js`:
   - `baseURL` = `process.env.JANDARMA_KBS_URL` (boşsa artık example.com kullanılmaz; net hata: “JANDARMA_KBS_URL ortam değişkeni tanımlı değil”).
   - `testBaglanti()`: `baseURL` boşsa hemen bu mesajla döner; doluysa KBS’ye bağlantı denemesi yapar (mevcut kod REST POST ile; resmi Jandarma SOAP/WCF ise ileride SOAP client gerekebilir).

Test başarılı/başarısız cevabı mobilde toast ile gösterilir.

---

## 5. Jandarma’ya Bildirim (Check-in) Akışı

### 5.1 Ne Zaman Tetiklenir?

- **Check-in:** Misafir odaya giriş yapıldığında (misafir + oda seçimi kaydedilince).
- **Toplu bildirim:** Kullanıcı listeden misafir seçip “Toplu bildirim gönder” dediğinde.

### 5.2 Check-in Adımları (Özet)

1. Mobil veya API ile **check-in** isteği gelir (misafir bilgileri + oda).
2. Backend misafiri ve odayı kaydeder; bir **Bildirim** kaydı oluşturur (durum: beklemede).
3. Tesis/branch için KBS bilgisi doluysa (`kbs_turu`, `kbs_tesis_kodu`, `kbs_web_servis_sifre`):
   - **setImmediate** ile arka planda:
     - `createKBSService(tesisSnapshot)` ile Jandarma/Polis servisi oluşturulur.
     - `kbsService.bildirimGonder({ ad, soyad, kimlikNo, pasaportNo, dogumTarihi, uyruk, misafirTipi, girisTarihi, odaNumarasi, ... })` çağrılır.
   - Sonuç Bildirim kaydında güncellenir (durum: basarili / hatali, hataMesaji, kbsYanit).
4. Kullanıcıya hemen “Kayıt alındı / Bildirim arka planda gönderiliyor” benzeri yanıt döner.

### 5.3 Çıkış (Check-out)

- Check-out yapıldığında, KBS bilgisi doluysa arka planda `kbsService.cikisBildir({ kimlikNo, pasaportNo, cikisTarihi })` çağrılır.

### 5.4 Bildirim İçeriği (Jandarma’ya Giden)

Jandarma servisi `bildirimGonder` içinde şu yapıda **JSON body** ile istek atar (şifre URL’de değil):

- `tesisKodu`, `webServisSifre`, `misafir: { ad, ad2, soyad, kimlikNo, pasaportNo, dogumTarihi, uyruk, misafirTipi, girisTarihi, odaNumarasi }`.

---

## 6. Ortam Değişkeni (KBS URL) — Çok Önemli

- **JANDARMA_KBS_URL:** Backend’in Jandarma KBS’ye istek atacağı base URL. Örnek: `https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc`.
- Bu değişken **boş/eksikse** artık “example.com” kullanılmıyor; kullanıcı “JANDARMA_KBS_URL ortam değişkeni tanımlı değil” benzeri net bir mesaj görür (ENOTFOUND önlenir).
- **Nerede tanımlanır:** Backend’in çalıştığı yerde (VPS, Railway, local) `.env` veya sunucu ortam değişkenleri. Doküman: `docs/KBS_BAGLANTI_GEREKSINIMLERI.md`, `backend/.env.example`.

---

## 7. Özet Tablo

| Konu | Açıklama |
|------|----------|
| **Tesis kodu / şifre nerede?** | Supabase `branches` veya Prisma `Tesis`; kolonlar TEXT. |
| **Nasıl girilir?** | Mobil: Ayarlar → KBS → alanları doldur → Kaydet. |
| **Nasıl test edilir?** | Aynı ekranda “Test” → Backend `POST /tesis/kbs/test` → Jandarma/Polis servisine bağlantı denemesi. |
| **Şifre nereye gidiyor?** | Sadece JSON body (PUT /tesis/kbs, POST /tesis/kbs/test, bildirim istekleri). URL/query’de yok. |
| **Bildirim ne zaman gider?** | Check-in ve (opsiyonel) toplu bildirim; check-out’ta çıkış bildirimi. |
| **ENOTFOUND / “yanıt vermiyor”** | JANDARMA_KBS_URL gerçek KBS adresi ile set edilmeli; boşsa artık net “tanımlı değil” mesajı döner. |

---

## 8. İlgili Dosyalar

| Bölüm | Dosya |
|--------|--------|
| KBS ayarları (GET/PUT), test, import | `backend/src/routes/tesis.js` |
| Jandarma KBS istekleri | `backend/src/services/kbs/jandarma.js` |
| Polis KBS istekleri | `backend/src/services/kbs/polis.js` |
| Servis seçimi (jandarma/polis) | `backend/src/services/kbs/index.js` |
| Check-in + bildirim tetikleme | `backend/src/routes/misafir.js` |
| Toplu bildirim | `backend/src/routes/bildirim.js` |
| Mobil KBS ekranı | `mobile/src/screens/AyarlarScreen.js` |
| Bağlantı gereksinimleri | `docs/KBS_BAGLANTI_GEREKSINIMLERI.md` |

Bu yapı ile sistem: tesis kodu ve şifre ekleme → kaydetme (TEXT, JSON body) → KBS testi → check-in/check-out ile Jandarma’ya bildirim akışını uçtan uca kapsar.

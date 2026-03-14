# KBS'ye Gönderilen Alanlar – Kontrol Listesi

Bu dokümanda Jandarma/Polis KBS’nin beklediği alanlar ile uygulamanın gönderdiği alanlar karşılaştırılmıştır.

---

## Jandarma KBS (SOAP – MisafirGiris)

| Alan | KBS'de zorunlu | Bizim gönderim | Format / not |
|------|----------------|----------------|----------------|
| TesisKodu | Evet | Evet (tesis/branch ayarı) | 6 haneli |
| Sifre | Evet | Evet (tesis/branch ayarı) | Web servis şifresi |
| Ad | Evet | Evet | Gönderilmeden önce boşsa hata |
| Ad2 | Hayır | Evet (boş string olabilir) | İkinci ad |
| Soyad | Evet | Evet | Gönderilmeden önce boşsa hata |
| TcKimlikNo | TC için | Evet (boş string olabilir) | En az biri dolu olmalı |
| PasaportNo | Yabancı için | Evet (boş string olabilir) | En az biri dolu olmalı |
| DogumTarihi | Evet | Evet | **DD.MM.YYYY** (backend’de Date → bu formata çevriliyor) |
| Uyruk | Evet | Evet | Varsayılan: TÜRK |
| GirisTarihi | Evet | Evet | **DD.MM.YYYY HH:mm** (backend’de Date → bu formata çevriliyor) |
| OdaNo | Evet | Evet | Boşsa "0" gönderiliyor |

**Backend’de yapılan kontroller (Jandarma):**

- Ad ve soyad boşsa → `"Jandarma KBS için ad ve soyad zorunludur."`
- Hem TC kimlik no hem pasaport no boşsa → `"Jandarma KBS için TC kimlik no veya pasaport no zorunludur (en az biri)."`
- Doğum tarihi yoksa → `"Jandarma KBS için doğum tarihi zorunludur."`
- Giriş tarihi yoksa → `"Jandarma KBS için giriş tarihi zorunludur."`

**Tarih formatı:** Prisma’dan gelen `DateTime` değerleri Jandarma SOAP’a gönderilmeden önce şu formata çevrilir:

- Doğum tarihi: `formatDateForKbs` → **DD.MM.YYYY**
- Giriş/çıkış tarihi: `formatDateTimeForKbs` → **DD.MM.YYYY HH:mm**

---

## Polis KBS (REST/JSON – bildirim)

| Alan | Bizim gönderim | Not |
|------|----------------|-----|
| tesisKodu, webServisSifre | Evet | Branch/tesis ayarı |
| ad, ad2, soyad | Evet | |
| kimlikNo, pasaportNo | Evet | |
| dogumTarihi, girisTarihi | Evet | ISO veya uyumlu string (Polis API’ye göre) |
| uyruk, misafirTipi | Evet | |
| odaNumarasi | Evet | |

Polis tarafında zorunlu alan listesi ve tarih formatı, kullandığınız Polis KBS API dokümantasyonuna göre doğrulanmalıdır.

---

## Verinin Toplandığı Yerler

KBS’ye giden misafir verisi şu route’lardan toplanıyor:

- **okutulanBelgeler.js** – Belge okutulup odaya atandıktan sonra bildirim
- **bildirim.js** – Toplu bildirim, tekrar dene
- **misafir.js** – Check-in / çıkış / oda değişikliği

Hepsi aynı `createKBSService(tesis).bildirimGonder(misafirData)` çağrısını kullanır; `misafirData` içinde `ad`, `soyad`, `kimlikNo`, `pasaportNo`, `dogumTarihi`, `girisTarihi`, `uyruk`, `odaNumarasi` vb. alanlar Prisma’daki `Misafir` ve `Oda` kayıtlarından doldurulur.

**Eksik veri:** Misafir kaydında ad, soyad, doğum tarihi, giriş tarihi veya hem TC hem pasaport boşsa Jandarma KBS hatası alınabilir. Yukarıdaki zorunlu alan kontrolleri bu durumda anlamlı hata mesajı döndürür.

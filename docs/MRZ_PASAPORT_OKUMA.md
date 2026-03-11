# MRZ Pasaport Okuma – Bazı Pasaportlarda Neden Okumuyor?

**Tarih:** 2026-03-11

---

## Olası Nedenler

| Neden | Açıklama |
|-------|----------|
| **Kontrol hanesi (check digit) hatası** | MRZ’de belge no, doğum ve son kullanma tarihlerinin sonunda ICAO 9303 kontrol hanesi var. OCR bir karakteri yanlış okursa (örn. 0/O, 1/I, 5/S) kontrol hatalı sayılır. |
| **Satır bölme** | OCR bazen 2 satırlı pasaport MRZ’ını tek satır veya yanlış yerden bölerek verir (örn. 20+64 karakter). Parser beklediği satır uzunluğunu bulamaz. |
| **Farklı satır uzunluğu** | Çoğu pasaport 2×44 karakter (TD3); bazıları 2×42 veya 2×36 (TD2) kullanır. Yanlış bölme “format tanınmadı” hatasına yol açar. |
| **Işık / netlik** | Soluk, yansıma veya bulanık MRZ bölgesi OCR hatalarını artırır. |
| **Ülke / baskı farkı** | Bazı ülkeler MRZ’de ek boşluk veya farklı karakter kullanır. |

---

## Yapılan İyileştirmeler (Kod)

1. **Satır bölme:** OCR iki satır verip birini kısa bıraktığında (toplam 66–100 karakter) metin birleştirilip 44 veya 42 karakterlik bölme noktaları deneniyor.
2. **Tek satır MRZ:** Tek blok halinde gelen 66–100 karakter için bölme noktaları genişletildi (44, 42, 43, 45, 46, 41, 40, 39). Bazı pasaportlar 42+42 kullanıyor.
3. **Check digit hatalı olsa bile veri:** Doğru bölme bulunup belge no + (doğum veya son kullanma) çıkarılabiliyorsa sonuç yine döndürülüyor; kontrol hanesi hatalı işaretleniyor, uygulama “kontrol edin” ile kabul edebiliyor (`ACCEPT_ON_CHECK_FAIL`).
4. **OCR düzeltme:** `fixMrzOcrErrors` iki geçiş çalışıyor; belge no ve tarih alanlarında G→6, C→6, J→1 gibi yaygın karışıklıklar düzeltiliyor.

---

## Kullanıcı Tarafında Öneriler

- MRZ bölgesini (pasaportta kimlik sayfasının altındaki 2 satır) **net, düz ve yansımasız** çekin.
- **Yeterli ışık** kullanın; parlak noktalar MRZ üzerinde olmasın.
- Okumazsa **“Manuel giriş”** veya **“Tekrar tara”** (galeri/kamera) ile devam edilebilir; uygulama check digit hatalı olsa bile yeterli veri varsa “Okundu – lütfen kontrol edin” diyerek kabul ediyor.

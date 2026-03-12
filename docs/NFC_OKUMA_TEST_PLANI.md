# KBS Prime – NFC Okuma Test Planı

Bu dokümanda Türk kimlik ve pasaport için NFC akışının nasıl test edileceği adım adım anlatılır.

---

## Ön koşullar

- **Cihaz:** NFC destekleyen Android veya iOS telefon (gerçek cihaz; emülatörde NFC yok).
- **Uygulama:** Development veya production build (`npx expo run:android` / `expo run:ios` veya EAS build).
- **Ortam:** Backend çalışıyor ve mobil uygulama API’ye bağlı (giriş yapılmış olmalı).

---

## Test 1: Türk kimlik kartı (default BAC key’lerle)

### Adımlar

1. Uygulamada **Ayarlar** → “NFC ile okumayı kullan” **açık** olsun.
2. Ana menüden **Hızlı NFC Okuma** ekranına gir (veya Odalar → Hızlı NFC).
3. **Türk kimlik kartını** telefonun arkasına (NFC antenine) yapıştır; kartı **sabit tut**.
4. Ekranda sırayla şunları görmelisin:
   - “Kartı telefonun arkasına yaklaştırın...”
   - “BAC anahtarı deneniyor (1/19)...”, (2/19), ... (default key’ler deneniyor).
5. Çip varsayılan anahtarlardan biriyle açılırsa:
   - **Toast:** “Okundu & kaydedildi” + ad soyad.
   - **Liste:** Yeni satır hemen eklenir; **fotoğraf** (çipten gelen) küçük resimde görünür.
6. Listede ilgili satıra tıkla → detayda **ad, soyad, TC no, doğum tarihi, uyruk** ve **büyük fotoğraf** görünmeli.

### Beklenen sonuçlar

| Madde | Beklenti |
|-------|----------|
| 1 | Kimlik NFC’ye yaklaştırıldığında okuma başlar. |
| 2 | BAC, default key listesiyle (Türk kimlik + pasaport) sırayla denenir. |
| 3 | DG1’den: ad, soyad, TC no, doğum, uyruk gelir. |
| 4 | DG2’den fotoğraf gelir; listede ve detayda **hemen** gösterilir. |
| 5 | Kayıt “Okutulanlar” listesine **fotoğraflı** (portrait) kaydedilir. |

### Olmazsa

- “Kart okunamadı. MRZ ile önce belge no / doğum / son kullanma kaydedin...” → Bu kartın BAC’i default key’lerle eşleşmiyor. **MRZ ekranından** pasaport/kimlik MRZ’ini okut, sonra aynı ekranda tekrar NFC’ye yaklaştır (önce kaydedilen MRZ ile açılır).
- Kartı 5–10 saniye sabit tutun; “BAC anahtarı deneniyor (X/19)...” ilerlemesini izleyin.

---

## Test 2: Pasaport (aynı akış)

### Adımlar

1. Aynı **Hızlı NFC Okuma** ekranında **e-pasaportu** telefonun arkasına yapıştırıp sabit tutun.
2. Yine “BAC anahtarı deneniyor (1/19)...” mesajları gelmeli (pasaport default key’leri de listede).
3. Çip açılırsa:
   - **Toast:** “Okundu & kaydedildi” + ad soyad.
   - Listede **pasaport no** (TC değil), ad, soyad, doğum, uyruk ve **fotoğraf** görünmeli.
4. Kayda tıklayınca detayda tüm alanlar ve **fotoğraf** olmalı.

### Beklenen sonuçlar

| Madde | Beklenti |
|-------|----------|
| 6 | Pasaport için de aynı akış: default BAC key’ler → DG1 (ad, soyad, pasaport no, doğum, uyruk) + DG2 (foto) → listede fotoğraflı kayıt. |

### Olmazsa

- Çoğu pasaportta BAC için **o pasaportun MRZ’i** gerekir. Önce **MRZ oku** (kamera), sonra aynı ekranda pasaportu NFC’ye yaklaştır; kaydedilen MRZ ile çip açılır.

---

## Test 3: MRZ sonrası NFC (fotoğraflı kayıt)

Bu test, “önce MRZ okutup sonra NFC” yolunda da fotoğrafın gelip kaydedildiğini doğrular.

1. **MRZ tarama** ekranına gir; kimlik/pasaport MRZ’ini kamerayla okuyup kaydet.
2. **Hızlı NFC Okuma** ekranına geç; aynı belgeyi NFC’ye yaklaştır.
3. İlk denemede “son okunan MRZ” ile BAC yapılır; çip açılırsa **fotoğraf da** gelmeli ve listede **fotoğraflı** görünmeli.

---

## Kontrol listesi (özet)

- [ ] Türk kimlik NFC’ye yaklaştırıldığında okuma başlıyor.
- [ ] BAC default key’lerle sırayla deniyor (ekranda X/19 mesajı).
- [ ] DG1’den ad, soyad, TC no (veya pasaport no), doğum, uyruk geliyor.
- [ ] DG2’den fotoğraf geliyor ve listede/detayda hemen görünüyor.
- [ ] Okutulanlar listesine kayıt **fotoğraflı** (portrait) düşüyor.
- [ ] Pasaport için de aynı akış çalışıyor (pasaport no + fotoğraflı kayıt).

---

## Teknik notlar

- **BAC:** ICAO 9303; anahtar = belge no + doğum tarihi + son kullanma (MRZ’den). Default key’ler sadece bu üçlünün bilinen/test değerleri.
- **DG1:** MRZ verisi (ad, soyad, belge no, doğum, uyruk, cinsiyet, son kullanma).
- **DG2:** Yüz fotoğrafı (JPEG, base64). `includeImages: true` ile alınır.
- **Kayıt:** `POST /api/okutulan-belgeler` ile `portraitPhotoBase64` gönderilir; backend Storage’a yazar, listede signed URL veya data URL ile gösterilir.

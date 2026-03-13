# Terminal çıktısı özeti (NFC + FABHalfSheet)

## 1. NFC akışı – neden bilgi gelmiyor?

Loglara göre sıra şöyle:

| Adım | Log | Anlamı |
|------|-----|--------|
| 1 | `NfcPassportReader yok` | **Native modül yüklü değil.** `react-native-nfc-passport-reader` bu build’de devreye girmiyor (Expo dev client / link sorunu olabilir). |
| 2 | `readAllDataWhenCardNear başarısız: NFC pasaport okuyucu kullanılamıyor` | BAC (default key’ler) hiç denenemedi, çünkü BAC’i yapan kütüphane yok. |
| 3 | `requestTechnology` → `Kart algılandı` | Kart algılandı, **IsoDep** ile bağlanıldı. |
| 4 | `Belge tipi: id_card` | Çip T.C. kimlik (eID) olarak tanındı. |
| 5 | `DG1 okundu {"length": 0}` | **DG1 (MRZ verisi) 0 byte döndü.** Çip, BAC yapılmadan DG1 vermiyor (ICAO 9303 davranışı). |
| 6 | `DG1 parse edildi {"ad": "", "soyad": "", "kimlikNo": null}` | Veri olmadığı için tüm alanlar boş. |
| 7 | `readIDCard – ad: soyad: kimlikNo: null pasaportNo: null foto: false` | Özet: Hiç alan dolu değil. |
| 8 | `HATA: Veri geldi ama ad/soyad/kimlikNo/pasaportNo boş` | Uygulama “veri geldi” diyor ama anlamlı alan yok; backend’e "—" ile kayıt gidiyor. |

**Sonuç:**  
- **BAC yapılamıyor** çünkü `NfcPassportReader` (native) yok.  
- **BAC olmadan** çip DG1/DG2 vermiyor, bu yüzden ad, soyad, TC no, foto gelmiyor.

**Ne yapılabilir?**  
1. **Native modülü düzgün linkleyin:** `npx expo prebuild --clean` ve tekrar `npx expo run:android` (veya iOS) ile **development build** alın; `react-native-nfc-passport-reader`’ın native kodu bu build’e girsin.  
2. **MRZ ile BAC:** Önce MRZ ekranından kimliği okutun; uygulama BAC anahtarını kaydeder. Sonra aynı kartı NFC’ye yaklaştırdığınızda, **eğer native modül bu build’de yüklüyse** BAC çalışır ve DG1/DG2 gelir.

---

## 2. ID kartı NFC neden okunmuyor?

T.C. kimlik (e-Kimlik) ve e-pasaport çipleri **BAC (Basic Access Control)** ile korunur. Çipi açmak için MRZ’den türetilen üç bilgi gerekir:

- **Belge / seri numarası** (kimlikte seri no, pasaportta pasaport no)
- **Doğum tarihi**
- **Son kullanma tarihi**

Bu üçü olmadan çip hiçbir veri (ad, soyad, TC no, foto) vermez.

**Uygulama ne yapıyor?**

1. Önce **kayıtlı MRZ** kullanılır (`getLastMrzForBac`). Daha önce MRZ okuttuysanız bu anahtar denenir.
2. Kayıtlı MRZ yoksa **varsayılan anahtarlar** denenir (1234…, 0000…, A1B2…, IDTURK… vb. – bunlar test amaçlı, gerçek kartla eşleşmez).
3. Loglarda gördüğünüz “BAC denemesi 1/17 … 17/17” bu varsayılan denemelerdir; gerçek kimlikte hepsi başarısız olur.

**Çözüm (ID kartı okutmak için):**

1. **Önce MRZ okutun:** Kimlik/pasaport MRZ alanını (kartın arkasındaki 2 satırlık metin/barkod) kamerayla okutun (KYC / MRZ ekranı veya Check-in’de “MRZ oku”).
2. Uygulama bu veriyi BAC için kaydeder.
3. **Sonra** aynı kartı telefonun arkasına NFC’ye yaklaştırın; bu sefer doğru anahtar kullanılır ve çip okunur.

Kısaca: **ID kartı NFC’si “MRZ olmadan” okunmaz; önce MRZ, sonra NFC.**

---

## 3. FABHalfSheet hatası

```
ERROR  [ReferenceError: Property 'FABHalfSheet' doesn't exist]
...
OdalarScreen (src\screens\OdalarScreen.js)
```

- Hata **OdalarScreen** render edilirken oluşuyor.  
- Bir yerde `FABHalfSheet` kullanılıyor veya bir obje üzerinden `FABHalfSheet` property’si okunuyor; o obje üzerinde bu property yok.  
- `FABHalfSheet` bileşeni `src/components/home/FABHalfSheet.js` içinde var ve `components/home/index.js` içinden export ediliyor; fakat **OdalarScreen** içinde `FABHalfSheet` import edilmiyor ve ekranda kullanılmıyor.  
- Muhtemel neden: Başka bir bileşen (ör. home’dan import edilen) `FABHalfSheet`’i bekliyor ama OdalarScreen home’dan import ederken `FABHalfSheet`’i almıyor; ya da modül çözümlemesi / export sırası yüzünden `FABHalfSheet` undefined kalıyor.

**Ne yapılabilir?**  
- OdalarScreen’de `FABHalfSheet`’i açıkça import edip, FAB menüsü açıldığında (`showFabMenu === true`) render edin.  
- Örnek:  
  `import { ..., FABHalfSheet } from '../components/home';`  
  ve  
  `{ showFabMenu && <FABHalfSheet visible onClose={...} onSelect={...} isAdmin={...} /> }`  
- Böylece hem kullanım hem de import tutarlı olur; "Property 'FABHalfSheet' doesn't exist" hatasının kaynağı netleşir veya düzelir.

---

## Özet

| Konu | Durum | Sebep |
|------|--------|--------|
| NFC’de bilgi yok | BAC yok → DG1/DG2 0 byte | `NfcPassportReader` native modülü bu build’de yok. |
| **ID kartı okunmuyor** | BAC başarısız (17 deneme) | Kayıtlı MRZ yok; varsayılan anahtarlar gerçek kartla eşleşmez. **Önce MRZ okutun, sonra NFC.** |
| FABHalfSheet hatası | ReferenceError | OdalarScreen (veya kullandığı bir bileşen) `FABHalfSheet`’e erişmeye çalışıyor ama property tanımlı değil; import/kullanım eksik veya yanlış. |

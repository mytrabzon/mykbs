# Backend adresi (178.104.12.20) nereye yazılır?

Backend artık **Railway’de değil**, kendi sunucunuzda (VPS) çalışıyor: **http://178.104.12.20**

Bu adresi aşağıdaki yerlerde tanımlamanız gerekir. Eksik kalırsa mobil uygulama veya EAS build’leri eski Railway adresine gider veya “Backend adresi tanımlı değil” hatası alırsınız.

---

## 1) Proje kökündeki `.env` (isteğe bağlı, tek merkez)

**Dosya:** `MYKBS/.env` (proje kökü, `mobile` klasörünün dışında)

Burada zaten var:

```env
EXPO_PUBLIC_BACKEND_URL=http://178.104.12.20
```

- Bu dosya **mobil uygulama tarafından otomatik okunmaz** (Expo config sadece `mobile/.env` okuyor).
- İsterseniz burayı “tek doğru adres” olarak kullanıp, aşağıdaki yerleri buna göre tutun.

---

## 2) Mobil uygulama için `.env` (yerel çalıştırma – önemli)

**Dosya:** `MYKBS/mobile/.env`

- **Yoksa oluşturun**, varsa içine şu satırı ekleyin veya güncelleyin:

```env
EXPO_PUBLIC_BACKEND_URL=http://178.104.12.20
```

- `npx expo start` ile çalıştırdığınızda backend adresi **buradan** okunur.
- `mobile/.env` yoksa veya bu satır yoksa, yerel çalışmada “Backend adresi tanımlı değil” çıkabilir.

**Özet:** Yerel test için mutlaka **mobile/.env** içinde `EXPO_PUBLIC_BACKEND_URL=http://178.104.12.20` olsun.

---

## 3) EAS Build (APK / IPA) – `eas.json`

**Dosya:** `MYKBS/mobile/eas.json`

Burada üç profilde de backend adresi vardı: **development**, **preview**, **production**.

Hepsi VPS adresine güncellendi:

- `"EXPO_PUBLIC_BACKEND_URL": "http://178.104.12.20"`

Yani:

- **development** → `http://178.104.12.20`
- **preview** → `http://178.104.12.20`
- **production** → `http://178.104.12.20`

EAS ile yeni build aldığınızda (APK/IPA) uygulama doğrudan bu adrese gidecek. **Railway adresi artık kullanılmıyor.**

---

## 4) Railway’de bir şey yazmanız gerekmiyor

- **178.104.12.20** sizin VPS’inizin IP’si; **Railway’de böyle bir adres yok**.
- Backend’i Railway’e geri taşımadığınız sürece Railway dashboard’da backend URL’i değiştirmenize gerek yok.
- Eski adres: `https://mykbs-production.up.railway.app` → Artık kullanılmıyor.

---

## Kontrol listesi

| Nerede | Ne yazacaksınız | Amaç |
|--------|------------------|------|
| **mobile/.env** | `EXPO_PUBLIC_BACKEND_URL=http://178.104.12.20` | Yerel `expo start` ile doğru backend |
| **MYKBS/.env** (kökte) | Aynı satır (isterseniz) | Tek merkez; mobil bunu otomatik okumaz |
| **mobile/eas.json** | Zaten `http://178.104.12.20` yapıldı | EAS build’lerinde doğru backend |
| **Railway** | Hiçbir şey | Backend artık orada değil |

---

## Port kullanıyorsanız

Backend’iniz örneğin **8080** portunda çalışıyorsa:

```env
EXPO_PUBLIC_BACKEND_URL=http://178.104.12.20:8080
```

Port 80 ise:

```env
EXPO_PUBLIC_BACKEND_URL=http://178.104.12.20
```

Bu değeri hem **mobile/.env** hem de **eas.json** içindeki ilgili profillerde aynı yapın.

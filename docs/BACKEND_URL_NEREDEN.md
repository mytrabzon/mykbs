# Backend URL nereden alınır?

`EXPO_PUBLIC_BACKEND_URL` = Node.js backend’inizin (Express) çalıştığı adres. Kayıt, giriş, checkin, branch sync bu adrese istek atar.

---

## 1) Bilgisayarında çalıştırıyorsan (yerel geliştirme)

Backend’in **port** numarası **backend klasöründeki `.env`** dosyasında:

- Dosya: `backend/.env`
- Satır: `PORT=8080` (varsayılan 8080)

**Backend URL’i** = `http://ADRES:PORT` (örn. `http://localhost:8080`).

Hangi adresi yazacağın **nerede test ettiğine** bağlı:

| Nerede test ediyorsun? | EXPO_PUBLIC_BACKEND_URL (mobile/.env) |
|------------------------|----------------------------------------|
| **Android emülatör**   | `http://10.0.2.2:8080`                 |
| **iOS simülatör**      | `http://localhost:8080`                |
| **Fiziksel telefon** (aynı Wi‑Fi) | `http://BILGISAYAR_IP:8080`   |

**Bilgisayar IP’sini bulma:**

- **Windows:** CMD veya PowerShell’de `ipconfig` → “IPv4 Address” (örn. 192.168.1.45)
- **Mac:** Terminal’de `ifconfig` veya Sistem Tercihleri → Ağ

Örnek: IP 192.168.1.45 ise → `EXPO_PUBLIC_BACKEND_URL=http://192.168.1.45:8080`

**Yapman gerekenler:**

1. Backend’i çalıştır: `cd backend` → `npm run dev` (veya `node src/server.js`).
2. `mobile/.env` içinde `EXPO_PUBLIC_BACKEND_URL` satırını yukarıdaki tabloya göre düzenle.
3. Expo’yu yeniden başlat: `npx expo start --clear`.

---

## 2) Railway’e deploy ettiysen (canlı / production)

Backend’i Railway’e deploy ettikten sonra URL’i **Railway panelinden** alırsın:

1. [railway.app](https://railway.app) → Giriş yap → Projeni seç.
2. Backend servisini (MyKBS backend) seç.
3. **Settings** → **Networking** / **Public Networking** → **Generate domain** veya mevcut domain.
4. Verilen adres şuna benzer: `https://mykbs-production.up.railway.app` (sonunda **/ olmadan** kullan).

**mobile/.env (production build için):**

```env
EXPO_PUBLIC_BACKEND_URL=https://mykbs-production.up.railway.app
```

Bu URL’i sadece **gerçekten deploy ettiğin** ve çalışan backend’in adresi ise kullan. Rastgele yazarsan uygulama bağlanamaz.

---

## Özet

- **Port:** `backend/.env` → `PORT=8080`.
- **Yerel adres:** Emülatör/simülatör/fiziksel cihaz için yukarıdaki tablodaki gibi.
- **Canlı adres:** Railway (veya kullandığın hosting) panelinden verilen domain.

Şu an `mobile/.env` içinde `http://10.0.2.2:8080` var; **Android emülatörde** test ediyorsan bu yeterli. Backend’i çalıştırıp Expo’yu yeniden başlatman gerekir.

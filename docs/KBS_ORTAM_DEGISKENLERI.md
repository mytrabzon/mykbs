# Jandarma KBS ortam değişkeni tanımlı değil

Bu hata, backend'in Jandarma KBS servisine istek atabilmesi için **JANDARMA_KBS_URL** ortam değişkeninin tanımlı olmamasından kaynaklanır.

## Çözüm

### 1. Ortam değişkeni

**Ad:** `JANDARMA_KBS_URL`  
**Değer (resmi Jandarma KBS SOAP servisi):**
```
https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc
```

> Jandarma ile KBS sözleşmenizde farklı bir adres verildiyse onu kullanın.

### 2. Nereye yazılacak?

- **Yerel (bilgisayarınızda):** `backend/.env` dosyasına ekleyin.
  ```bash
  # backend/.env
  JANDARMA_KBS_URL=https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc
  ```
  Backend’i yeniden başlatın (`npm run dev` veya `node src/server.js`).

- **Railway:** Proje → Backend servisi → **Variables** → **New Variable**  
  - Name: `JANDARMA_KBS_URL`  
  - Value: `https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc`  
  Deploy sonrası otomatik yeniden başlar.

- **VPS (178.104.12.20 vb.):** Backend’in çalıştığı kullanıcı ortamında bu değişkeni tanımlayın (systemd, `.env` veya `export`). Örnek:
  ```bash
  export JANDARMA_KBS_URL="https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc"
  ```
  veya `backend/.env` içine aynı satırı ekleyip backend’i yeniden başlatın.

### 3. Kontrol

Backend çalışırken ortam değişkeninin yüklendiğini görmek için (yerelde):

```bash
cd backend
node -e "require('dotenv').config(); console.log('JANDARMA_KBS_URL:', process.env.JANDARMA_KBS_URL ? 'tanımlı' : 'YOK');"
```

### 4. Diğer KBS ayarları

- Tesis kodu ve web servis şifresi: Uygulama içinde (Ayarlar / KBS) girilir; ortam değişkeni değildir.
- Jandarma KBS, sunucunuzun çıkış IP’sini whitelist’te ister. VPS kullanıyorsanız `GET /debug/egress-ip` ile IP’yi öğrenip Jandarma’ya bildirin.

## Polis KBS

Polis KBS kullanıyorsanız ayrıca:

- **Ad:** `POLIS_KBS_URL`  
- **Değer:** Polis KBS sözleşmesinde verilen servis URL’si (Jandarma adresiyle aynı değildir).

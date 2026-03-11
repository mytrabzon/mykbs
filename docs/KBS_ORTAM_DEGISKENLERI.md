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

---

## Giriş bildirimi: Sadece TC mi, tüm bilgiler mi?

**Şu anki davranış (backend):** Jandarma KBS’ye **MisafirGiris** SOAP isteğiyle şu alanlar gönderiliyor: Ad, Ad2 (baba adı), Soyad, TcKimlikNo, PasaportNo, DogumTarihi, Uyruk, GirisTarihi, OdaNo. Yani **tüm bilgiler** gönderiliyor.

**Çıkış bildirimi:** **MisafirCikis** ile sadece TcKimlikNo (veya PasaportNo) + CikisTarihi gönderiliyor. Çıkışta TC/pasaport yeterli.

**“KBS’ye TC yazınca otomatik çıkıyor”:** Bazı sistemlerde KBS tarafında TC ile MERNIS’ten ad-soyad–doğum vb. otomatik dolduruluyor olabilir. Resmi Jandarma dokümantasyonunda “girişte sadece TC yeterli” ifadesi net değil; bazı kaynaklarda TC vatandaşları için **MusteriKimlikNoGiris** (TC odaklı) ayrı bir operasyon olarak geçiyor. Bizim kullandığımız servis (**SrvShsYtkTml** / **MisafirGiris**) ise tüm alanları içeren SOAP ile çalışıyor.

**Sonuç / öneri:**
- **Şimdilik:** Giriş bildiriminde **tüm bilgileri (ad, soyad, baba adı, ana adı, doğum, uyruk, TC, oda, giriş tarihi)** göndermeye devam ediyoruz; KBS’nin bu serviste sadece TC ile kabul edip etmediği resmi dokümana veya Jandarma’ya sorularak netleştirilebilir.
- **Sadece TC ile denemek isterseniz:** Jandarma’dan veya entegrasyon dokümanından “MisafirGiris’te sadece TcKimlikNo + OdaNo + GirisTarihi yeterli mi?” onayı alındıktan sonra, manuel bildirim formunda diğer alanları opsiyonel yapıp boş göndermek test edilebilir. Boş alanlar servis tarafından reddedilirse yine tüm bilgiler zorunlu demektir.

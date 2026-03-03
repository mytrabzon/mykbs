# "KBS yanıt vermiyor" – Neden ve Ne Yapılır

## 1. Kısa cevap

Resmi **Jandarma KBS** adresi (`https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc`) bir **SOAP/WCF** web servisidir. Backend’deki mevcut kod **REST** (JSON POST ile `/test`, `/bildirim` vb.) kullanıyor. Servis REST endpoint’i sunmadığı için istekler 404/405 döner veya “yanıt vermiyor” gibi görünür.

---

## 2. Ne yapıldı (kod tarafı)

- **Hata mesajları netleştirildi:** Timeout, 404, 405, ECONNREFUSED, DNS için ayrı mesajlar (örn. “Servis SOAP/WCF ise REST yerine SOAP client gerekir”).
- **Gerçek bağlantı testi (SOAP):** "KBS Bağlantı testi" artık Jandarma SOAP servisine **ParametreListele** ile istek atar; IP + tesis kodu + şifre doğrulanır.
- **Debug:** `GET /debug/kbs-ping`, `GET /debug/egress-ip` (whitelist IP).

---

## 3. Sizin yapmanız gerekenler

### A) Bağlantı ve env kontrolü

1. **Backend’in çalıştığı yerde** (VPS vb.) env’de şu tanımlı olsun:
   ```bash
   JANDARMA_KBS_URL=https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc
   ```
2. **Egress IP:**  
   `curl https://BACKEND_URL/debug/egress-ip`  
   Dönen IP’yi Jandarma KBS tarafında **whitelist**’e yazdırın. Whitelist’te değilse KBS “yanıt vermiyor” veya bağlantı hatası verebilir.
3. **KBS erişim testi:**  
   `curl https://BACKEND_URL/debug/kbs-ping`  
   - `ok: true` ve HTTP 200 → Sunucuya erişim var; sorun büyük ihtimalle **REST vs SOAP** (aşağıdaki B).  
   - `ok: false`, timeout / connection refused → Ağ, firewall veya **IP whitelist** (yukarıdaki 2) kontrol edin.

### B) Gerçek bildirim için: SOAP entegrasyonu

Mevcut REST client, Jandarma’nın .svc servisiyle **doğrudan uyumlu değil**. Gerçek bildirim için:

- Jandarma’dan **resmi entegrasyon dokümanı / WSDL kullanım bilgisi** alın.
- WSDL: `https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc?wsdl`  
  Bu adresten SOAP operasyonları ve parametreler görülebilir.
- Backend’de bu WSDL’e uygun **SOAP client** (Node’ta örn. `strong-soap`, `axios` ile SOAP envelope) yazılmalı; tesis kodu/şifre ve bildirim alanları SOAP formatında gönderilmeli.

Özet: “KBS yanıt vermiyor” hem **bağlantı/IP** hem de **protokol (REST yerine SOAP)** kaynaklı olabilir. Önce `/debug/egress-ip` ve `/debug/kbs-ping` ile bağlantıyı ve env’i doğrulayın; kalıcı çözüm için SOAP client ve resmi doküman gerekir.

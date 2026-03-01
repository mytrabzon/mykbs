# KBS (Kimlik Bildirim Sistemi) – Bağlantının Başarılı Olması İçin Gerekenler

Uygulama **dünya genelinde** kullanılıyor; her otel sahibi **tesis kodu** ve **şifre** bilgisini **KBS’den** (ilgili kurumun portalı/sistemi) alıp uygulamada girer. **Karakollar IP bildirimi talep etmez.**

---

## B2B modeli (çoklu otel)

- **Her otel kendi bilgisini girer:** Tesis kodu ve web servis şifresini **KBS’den** alır; Ayarlar → KBS bölümüne girip kaydeder.
- **Hemen başlar:** Kayıttan sonra kimlik bildirimleri check-in ile otomatik gider.
- Tesis kodu ve şifre **KBS’den alınır**; uygulama bu bilgileri saklar ve KBS’ye istek atar.

---

## 1. KBS’den alınan bilgiler

Otel sahibi ilgili kurumun **KBS portalından / sisteminden** şunları alır:

- **Tesis kodu** (örn. 6 haneli)
- **Web servis şifresi**

Bu bilgileri uygulamada Ayarlar → KBS alanlarına girer; bağlantı testi ile doğrular.

---

## 2. Uygulama tarafı (Ayarlar → KBS)

Her tesis için girilen alanlar:

| Alan | Açıklama |
|------|----------|
| **KBS türü** | İlgili kurum (örn. Jandarma / Polis vb.). |
| **Tesis kodu** | KBS’den alınan tesis kodu. |
| **Web servis şifresi** | KBS’den alınan şifre. |

---

## 3. Backend ortam değişkenleri

Gerçek KBS API’ye istek için backend’de ilgili URL’ler tanımlı olmalı:

| Değişken | Açıklama |
|----------|----------|
| **JANDARMA_KBS_URL** | Jandarma KBS web servis base URL’i. Örnek: `https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc`. Boşsa mock kullanılır. |
| **POLIS_KBS_URL** | Polis (EGM) KBS web servis base URL’i. Boşsa mock kullanılır. |

Her iki URL de boşsa tüm KBS istekleri mock’tan döner. **KBS tarafı çoğu zaman sunucu IP kısıtlaması (whitelist) uygular;** backend’in dışarı çıkış IP’sini (egress) KBS’ye beyan etmeniz gerekir. Egress IP’yi doğrulamak için: `GET https://BACKEND_URL/debug/egress-ip` (VPS kullanıyorsanız bkz. `docs/VPS_KBS_SABIT_IP.md`). "KBS yanıt vermiyor" için: `GET BACKEND_URL/debug/kbs-ping` ve `docs/KBS_YANIT_VERMIYOR.md`.

---

## 4. Hata kodları

| HTTP / Durum | Anlamı | Yapılacak |
|--------------|--------|-----------|
| **401** | Web servis şifresi hatalı | KBS’den aldığınız şifre ile uygulamadaki şifreyi kontrol edin. |
| **403** | Bu IP yetkili değil | Teknik destek veya servis sağlayıcı ile görüşün. |
| **503 / ECONNREFUSED** | KBS servisi yanıt vermiyor | URL ve servis erişimini kontrol edin. |

---

## 5. Kullanıcı akışı (özet)

1. **KBS’den alın:** Tesis kodu ve web servis şifresi.
2. **Uygulamada girin:** Ayarlar → KBS → tür, tesis kodu, şifre → Kaydet.
3. Uygulamada **Bağlantı testi** yapın; başarılıysa check-in’lerde bildirimler otomatik gider.

---

## 6. Projede ilgili dosyalar

- **Backend:** `backend/src/services/kbs/jandarma.js`, `polis.js`, `kbsAdapter.js`, `index.js`
- **Tesis KBS alanları:** Prisma `Tesis` (kbsTuru, kbsTesisKodu, kbsWebServisSifre, ipKisitAktif, ipAdresleri); Supabase branch ayarları.
- **Sunucu IP (teknik):** `GET /api/tesis/kbs/server-ip` – yalnızca teknik destek / hata ayıklama için.

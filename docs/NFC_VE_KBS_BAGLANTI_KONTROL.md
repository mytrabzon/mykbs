# NFC ve KBS Test Bağlantı Kontrol Listesi

## NFC çalışmıyor

| Kontrol | Açıklama |
|--------|----------|
| **Development build** | Expo Go'da NFC çalışmaz. `npx expo run:android` veya EAS build ile dev client kullanın. |
| **NFC açık mı** | Android: Ayarlar → Bağlantılar / NFC ve ödeme → NFC açık. Uygulama ilk açılışta "NFC kapalı" uyarısı gösterebilir. |
| **İzin** | İlk "NFC ile Okut" veya kimlik ekranında NFC izni istenir; reddetmeyin. |
| **Cihaz** | Telefonun NFC donanımı olmalı (çoğu Android'de var; iPhone 7+). |

Kod tarafı: `CheckInScreen` içinde `NfcManager.isSupported()`, `NfcManager.start()` ve (Android) `NfcManager.isEnabled()` kontrol edilir. Destek yoksa "Kamera ile Okut" kullanılır.

---

## KBS testi – "bağlantı sorunu" / "KBS iletilmiyor"

| Kontrol | Açıklama |
|--------|----------|
| **EXPO_PUBLIC_BACKEND_URL** | Mobilde (`.env` veya `app.config.js` extra) backend adresi tanımlı olmalı. Örn. `http://178.104.12.20` veya `https://...railway.app`. Yoksa "Backend adresi tanımlı değil" hatası alırsınız. |
| **Giriş yapılmış mı** | KBS testi için oturum (token) gerekir. Giriş yapmadan test edemezsiniz. |
| **Backend erişilebilir mi** | Telefondan veya bilgisayardan `curl BACKEND_URL/health` deneyin. Yanıt gelmiyorsa: sunucu kapalı, firewall veya ağ sorunu. |
| **Backend → KBS** | Backend, Jandarma KBS'ye SOAP ile bağlanır (mevcut kod REST deniyor; gerçek entegrasyon SOAP client ister). Backend'de `GET /debug/kbs-ping` ile KBS sunucusuna erişim test edilebilir. |

Hata mesajları (yapılan iyileştirmeler):
- Ağ/backend erişilemezse: "Backend'e ulaşılamadı. EXPO_PUBLIC_BACKEND_URL ve interneti kontrol edin."
- Backend cevap verip KBS başarısızsa: Backend'den dönen mesaj (örn. "KBS servisi yanıt vermiyor", "Bu IP yetkili değil") gösterilir.

---

## Hızlı kontrol

1. **Backend URL:** Uygulama içi Ayarlar veya debug ekranında backend adresi görünüyor mu?
2. **Health:** Tarayıcıdan `https://SIZIN_BACKEND/health` açılıyor mu?
3. **KBS test:** Ayarlar → KBS → Test: Hata mesajı ne? (Bağlantı hatası / Backend'e ulaşılamadı / KBS yanıt vermiyor / vb.)
4. **NFC:** Development build + NFC açık + izin verildi mi?

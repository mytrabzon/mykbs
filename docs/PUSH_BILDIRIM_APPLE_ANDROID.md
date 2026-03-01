# Push Bildirim Sistemi – Apple (iOS) ve Android

Bu dokümanda uygulamanın push bildirim altyapısı ve **Apple’da bildirimlerin iletilmesi** için yapılması gerekenler özetlenir.

---

## 1. Mevcut akış

- **Uygulama:** Giriş sonrası `registerPushToken(getBackendToken)` çağrılır → **Expo Push Token** alınır → **Backend** `POST /api/push/register` ile token + platform (ios/android) gönderilir.
- **Backend:** Token’ları **Supabase** tablosu **`push_registrations`** içine yazar (`user_identifier`, `expo_push_token`, `platform`).
- **Gönderim:** Supabase Edge fonksiyonu **`push_dispatch`**, **`notification_outbox`** kuyruğundaki kayıtları işler ve **Expo Push API** (`https://exp.host/--/api/v2/push/send`) ile gönderir. **`push_dispatch`** token’ları **`user_push_tokens`** tablosundan okur (Supabase `user_id` + token).

---

## 2. Apple (iOS) için tamamlanması gerekenler

Bildirimlerin **iPhone’lara düşmesi** için aşağıdakiler gerekir.

### 2.1 Uygulama tarafı (zaten var)

- `expo-notifications` kullanılıyor.
- Token backend’e `platform: 'ios'` ile kaydediliyor.
- EAS Build ile iOS build alındığında **Push Notifications** capability’si genelde otomatik eklenir (expo-notifications sayesinde).

### 2.2 Apple tarafında sizin yapacaklarınız

1. **Apple Developer Portal**
   - **Identifiers** → `com.litxtech.mykbs` (App ID) → **Push Notifications** capability’si **Enabled** olmalı.
   - **Keys** bölümünden **Apple Push Notifications service (APNs)** için bir **Key** (.p8) oluşturun (Key ID, Team ID, Bundle ID ile).

2. **EAS / Expo**
   - İlk iOS build’de EAS, push credentials sorabilir. **Credentials**’a Apple Push key’i (.p8) ekleyin:
     - `eas credentials` → iOS → Push Notifications → Upload **APNs Auth Key** (.p8) veya mevcut key’i seçin.
   - Böylece **Expo Push servisi**, Apple’a (APNs) sizin uygulamanız adına bildirim gönderebilir.

3. **Test**
   - iOS cihazda uygulamayı açın, giriş yapın (token’ın `push_registrations` veya `user_push_tokens`’a yazıldığından emin olun).
   - Admin panel veya kuyruk üzerinden test bildirimi gönderin; iPhone’da bildirimin gelmesi gerekir.

**Özet:** Apple bildirimleri için **App ID’de Push Notifications açık** ve **EAS’ta APNs key yüklü** olmalı. Bunlar tamamsa iOS’ta bildirimler iletilir.

---

## 3. Admin / herhangi bildirimlerin iletilmesi – önemli uyumsuzluk

Şu an iki farklı token kaynağı var:

| Nerede kayıt? | Tablo | Kim kullanıyor? |
|---------------|--------|------------------|
| Uygulama (backend JWT ile) | **push_registrations** | Backend kaydediyor; **push_dispatch kullanmıyor.** |
| Supabase auth ile (Edge `push_register_token`) | **user_push_tokens** | **push_dispatch** sadece bu tablodan token okuyor. |

Uygulama şu an **sadece backend’e** token gönderiyor (`POST /api/push/register` → `push_registrations`). **push_dispatch** ise sadece **user_push_tokens**’a bakıyor. Bu yüzden:

- Admin (veya herhangi bir sistem) **notification_outbox**’a kayıt eklese bile,
- **push_dispatch** çalışsa bile,
- Sadece **user_push_tokens**’ta kayıtlı cihazlara (Supabase kullanıcıları) bildirim gider.
- **Sadece backend ile giriş yapıp token’ı push_registrations’a yazan** kullanıcılara **şu anki push_dispatch ile bildirim gitmez.**

### Çözüm seçenekleri

**A) push_dispatch’i push_registrations’ı da kullanacak şekilde genişletmek**  
- `notification_outbox`’a hedef olarak “backend user_identifier” veya eşleşen bir ID eklenir.
- `push_dispatch` hem `user_push_tokens` hem `push_registrations`’dan token toplar ve Expo’ya gönderir.  
→ Böylece backend ile giriş yapan tüm kullanıcılar (iOS ve Android) admin bildirimlerini alır.

**B) Uygulamanın token’ı aynı zamanda Supabase’e de yazması**  
- Backend ile giriş yapan kullanıcının bir Supabase `user_id`’si varsa, uygulama aynı Expo token’ı `push_register_token` Edge’i ile **user_push_tokens**’a da yazar.
- Admin bildirimleri `target_user_ids` ile bu Supabase kullanıcılarına gider.  
→ Sadece “Supabase hesabı da olan” kullanıcılar için çalışır; tam backend-only kullanıcılar yine dışarıda kalır.

**C) Backend’de ayrı bir “push gönder” endpoint’i**  
- Backend, `push_registrations` tablosundan token’ları okuyup doğrudan Expo Push API’yi çağırır (belirli user_identifier veya tüm tesis kullanıcıları için).  
→ Admin panel veya başka sistemler bu endpoint’i kullanır; push_dispatch’e bağlı kalmaz.

Pratik ve kapsayıcı çözüm: **A** (push_dispatch’in push_registrations’ı da kullanması ve outbox’ın hedefinin buna göre tanımlanması).

---

## 4. Kontrol listesi – Apple bildirimleri

- [ ] Apple Developer: App ID `com.litxtech.mykbs` için **Push Notifications** açık.
- [ ] APNs Key (.p8) oluşturuldu; **EAS Credentials**’a yüklendi (veya EAS’ın oluşturduğu key kullanılıyor).
- [ ] iOS development/production build EAS ile alındı; uygulama cihazda token’ı kaydettiriyor.
- [ ] **push_dispatch** ile token kaynağı uyumlu: Ya `user_push_tokens` kullanılıyor ve uygulama bu tabloya da yazıyor, ya da **push_dispatch** `push_registrations`’ı da okuyacak şekilde güncellendi.
- [ ] Test: notification_outbox’a bir kayıt eklenip push_dispatch tetiklenince iPhone’da bildirim görünüyor.

Bu adımlar tamamlandığında **Apple’da bildirim sistemi tamam** olur ve admin (veya herhangi bir kaynak) bildirimleri iOS’a iletilir.

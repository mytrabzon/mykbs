# MyKBS — Kullanıcı Onay Akışı ve Test Planı

## Mevcut politika: Hesap onayı zorunlu değil

**Kayıt olan her kullanıcı (pending / approved / rejected) giriş yaptıktan sonra tüm uygulama özelliklerini kullanabilir.**  
Edge (`requireAuth`) ve backend (`authenticateTesisOrSupabase) artık `approval_status` kontrolü yapmıyor; sadece **profil var mı** ve **hesap devre dışı mı** (`is_disabled`) kontrol edilir.

- **Bildirimler, topluluk, misafirler, profil ayarları, odalar, rapor** vb. — hepsi hesap onayı olmadan kullanılabilir.
- **Devre dışı bırakılan** hesaplar (`is_disabled = true`) yine 403 DISABLED alır.

---

## Akış: Kayıt → Giriş → Tüm özellikler kullanılabilir

1. **Kayıt**  
   Kullanıcı telefon/e-posta ile kayıt olur.  
   - Supabase’te `user_profiles` satırı oluşturulur; `approval_status` default `pending` (sadece bilgi amaçlı, erişimi engellemez).

2. **Giriş**  
   Kullanıcı giriş yapar (Supabase JWT alır).

3. **Tüm işlemler**  
   - Edge: `requireAuth()` → JWT + profil + `is_disabled` kontrolü (onay kontrolü yok).  
   - Backend: `authenticateTesisOrSupabase` → aynı şekilde onay kontrolü yok.  
   - Pending/rejected kullanıcılar da bildirim, topluluk, odalar, misafirler, profil, rapor kullanabilir.

4. **Admin panel (opsiyonel)**  
   - **Onay Bekleyenler** sayfası hâlâ listeleme / Onayla / Reddet / Devre dışı bırak sunar.  
   - Onaylama/reddetme sadece durumu günceller; uygulama erişimini kısıtlamaz.  
   - **Devre dışı bırak** → `is_disabled = true` → kullanıcı 403 DISABLED alır, erişim engellenir.

---

## Güvenlik özeti

| Katman        | Kontrol                                                                 |
|---------------|-------------------------------------------------------------------------|
| **Edge**      | `requireAuth()`: profil yok → 403 NO_PROFILE; is_disabled → 403 DISABLED. **approval_status kontrolü yok.** |
| **Backend**   | `authenticateTesisOrSupabase`: aynı mantık; onay zorunlu değil. Admin endpoint’leri `requireAdminPanelUser` ile korunur. |
| **Veritabanı**| `user_profiles.approval_status` bilgi amaçlı kalabilir; `is_disabled` erişimi kısıtlar. |

- **401:** Token yok veya geçersiz.  
- **403:** Profil yok (NO_PROFILE), hesap devre dışı (DISABLED) veya şube atanmamış (BRANCH_NOT_ASSIGNED). APPROVAL_REQUIRED artık dönmez.

---

## Test senaryoları (güncel)

### 1) Yeni kayıt (pending) → tüm özellikler 200
- Yeni kullanıcı kayıt olur; `approval_status = 'pending'`.
- Aynı JWT ile `upload_community_image`, `me`, `rooms_list`, backend odalar/misafirler/bildirim/rapor çağrılır.
- **Beklenen:** HTTP **200** (onay beklenmeden çalışır).

### 2) Rejected kullanıcı → yine tüm özellikler 200
- `approval_status = 'rejected'` olan kullanıcı ile aynı istekler.
- **Beklenen:** HTTP **200**.

### 3) Disabled kullanıcı → 403 DISABLED
- `is_disabled = true` yapılan kullanıcı ile istek.
- **Beklenen:** 403, `code: "DISABLED"`.

### 4) Admin approve endpoint’i
- Admin olmayan kullanıcı `POST /api/app-admin/users/:id/approve` çağırırsa **403** (admin yetkisi gerekli).

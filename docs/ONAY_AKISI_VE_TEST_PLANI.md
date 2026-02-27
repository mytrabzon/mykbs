# MyKBS — Kullanıcı Onay Akışı ve Test Planı

## Akış: Kayıt → Pending → Admin Onay → Aktif

1. **Kayıt**  
   Kullanıcı telefon/e-posta ile kayıt olur (Supabase Auth + backend veya doğrudan Supabase).  
   - Backend/sync: `sync_branch_profile` veya kayıt sonrası sync ile Supabase’te `user_profiles` satırı oluşturulur.  
   - Yeni satırda `approval_status` default **`pending`**.

2. **Giriş**  
   Kullanıcı giriş yapabilir (Supabase JWT alır).  
   - Token geçerli; ancak `approval_status !== 'approved'` ise kritik işlemler **403 APPROVAL_REQUIRED** döner.

3. **Kritik işlemler (Edge)**  
   - `upload_community_image`, `upload_community_video`, `community_post_create`, `profile_update`, `me`, `rooms_list`, `facilities_list` vb.  
   - Hepsi `_shared/auth.ts` → `requireAuth()` kullanır.  
   - `requireAuth()`: JWT doğrula → `user_profiles` oku → `is_disabled` ise 403 → **`approval_status !== 'approved'` ise 403 APPROVAL_REQUIRED**.

4. **Admin onay**  
   - Admin panel: **Onay Bekleyenler** sayfasından kullanıcıyı görür.  
   - **Onayla** → `POST /api/app-admin/users/:id/approve` → `user_profiles.approval_status = 'approved'`, `approved_at`, `approved_by` güncellenir.  
   - **Reddet** → `POST /api/app-admin/users/:id/reject` → `approval_status = 'rejected'`, `rejected_reason` (opsiyonel).  
   - **Devre dışı bırak** → `POST /api/app-admin/users/:id/disable` → Auth ban + `user_profiles.is_disabled = true`.

5. **Onay sonrası**  
   Aynı kullanıcı tekrar kritik işlem yaptığında `approval_status === 'approved'` olduğu için 200 döner.

---

## Güvenlik: Tek Kaynak Otorite

| Katman        | Kontrol                                                                 |
|---------------|-------------------------------------------------------------------------|
| **Veritabanı**| `user_profiles.approval_status`, `user_profiles.is_disabled`            |
| **Edge**      | `requireAuth()`: profil yok → 403 NO_PROFILE; is_disabled → 403 DISABLED; approval_status !== 'approved' → 403 APPROVAL_REQUIRED |
| **Backend**   | Admin endpoint’leri `requireAdminPanelUser` ile korunur; onay işlemleri Supabase `user_profiles` günceller. |
| **RLS**       | Storage/community RLS, gerekirse `user_profiles` ile sınırlanabilir; Edge service_role ile upload yaptığı için şu an karar Edge’de. |

- **401:** Sadece auth yok / geçersiz token (Authorization header eksik veya JWT geçersiz).  
- **403:** Yetki yok — profil yok, devre dışı veya onaylı değil (APPROVAL_REQUIRED).

---

## Test Senaryoları (5 adet)

### 1) Yeni kayıt → pending: upload_community_image 403 (mesaj: approval required)
- **Hazırlık:** Yeni bir kullanıcı kayıt olur; `user_profiles` satırı `approval_status = 'pending'` (veya hiç onaylanmamış).
- **Adım:** Bu kullanıcının Supabase JWT’i ile `POST /functions/v1/upload_community_image` çağrılır (branch_id = kullanıcının branch_id).
- **Beklenen:** HTTP **403**, body’de `code: "APPROVAL_REQUIRED"`, mesaj “Hesabiniz henuz onaylanmadi…” veya benzeri.

### 2) Admin onay → aynı kullanıcı upload 200
- **Hazırlık:** Aynı kullanıcı admin panelden **Onayla** ile onaylanır (`approval_status = 'approved'`).
- **Adım:** Aynı JWT ile tekrar `upload_community_image` çağrılır.
- **Beklenen:** HTTP **200**, `{ url, path }` döner.

### 3) Rejected kullanıcı → giriş olur ama kritik işlemler 403
- **Hazırlık:** Bir kullanıcı **Reddet** ile `approval_status = 'rejected'` yapılır.
- **Adım:** Bu kullanıcı giriş yapar (Supabase JWT alır); ardından `upload_community_image` veya `community_post_create` çağrılır.
- **Beklenen:** Giriş başarılı; Edge 403, `code: "APPROVAL_REQUIRED"`, mesaj “Hesabiniz onaylanmadi…” veya benzeri.

### 4) Disabled kullanıcı → tüm kritik endpoint’ler 403 + (opsiyonel) logout
- **Hazırlık:** Bir kullanıcı **Devre dışı bırak** ile Auth ban + `user_profiles.is_disabled = true` yapılır.
- **Adım:** Eski JWT ile (veya yeni giriş denemesi) `upload_community_image` veya `me` çağrılır.
- **Beklenen:** Edge 403, `code: "DISABLED"`, mesaj “Hesabiniz devre disi birakildi”.  
- **Ban kaldır:** Admin **Kullanıcıyı tekrar etkinleştir** (Enable) ile `users/:id/enable` çağrılır; sonra aynı kullanıcı 200 alabilmeli.

### 5) Admin rolü olmayan kullanıcı approve endpoint’ine 403
- **Hazırlık:** `user_profiles.role !== 'admin'` olan bir kullanıcının Supabase JWT’i (veya backend JWT’i, admin değilse).
- **Adım:** `POST /api/app-admin/users/:hedef_user_id/approve` bu token ile çağrılır.
- **Beklenen:** HTTP **403**, “Bu alan sadece admin yetkili hesaplar için kullanılabilir”.

---

## Özet

- **Kuralın kaynağı:** `user_profiles.approval_status` ve `user_profiles.is_disabled`; Edge `_shared/auth.ts` → `requireAuth()`.
- **Admin panel:** **Onay Bekleyenler** sayfası: listeleme, **Onayla / Reddet / Devre dışı bırak**; backend: **approve**, **reject**, **disable**, **enable**.
- **401 vs 403:** 401 = token yok/geçersiz; 403 = yetki yok (onaysız, reddedilmiş, devre dışı).

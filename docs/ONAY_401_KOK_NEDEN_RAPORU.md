# MyKBS — 401 / Admin Onay Kök Neden Raporu (Delilli)

## ADIM 0 — 401 Hatasının Kaynağı (Delil)

### Edge Function loglarda beklenen davranış
- **POST /functions/v1/upload_community_image** 401 döndüğünde:
  - **Eksik header:** `Authorization: Bearer <token>` yok → `_shared/auth.ts` satır 55-57: `errorResponse("Yetkilendirme gerekli", 401, "UNAUTHORIZED")`.
  - **Token geçersiz / süresi dolmuş:** `supabase.auth.getUser(token)` hata veriyor → satır 78-82: `errorResponse("Gecersiz veya suresi dolmus oturum. Edge Function icin Supabase Auth JWT gerekir (backend JWT degil).", 401, "INVALID_TOKEN")`.
- Edge Function **hiçbir yerde** "Not approved" veya "pending" mesajı üretmiyor; onay kontrolü yok.

### Kritik bulgu (kod delili)
- **mobile/src/context/AuthContext.js** satır 188: *"Edge me/upload_community_image vb. sadece Supabase Auth JWT ile çalışır; backend JWT 401 (INVALID_TOKEN) döner."*
- Yeni kayıt sonrası giriş **backend** üzerinden yapılıyorsa ve yanıtta **sadece backend JWT** dönüyorsa, mobil `SUPABASE_TOKEN` olarak backend JWT yazıyor; Edge’e bu token gidince `getUser(backendJWT)` başarısız → **401 INVALID_TOKEN**.
- Alternatif: Kullanıcı için **user_profiles** satırı yoksa Edge **403** "Kullanici profili bulunamadi" döner (401 değil).

**Sonuç:** 401’in birincil nedeni büyük olasılıkla **Edge’e Supabase Auth JWT yerine backend JWT veya eksik token gönderilmesi**. İkincil: profil yoksa 403.

---

## ADIM 1 — Codebase’de “Onay / Approval” İşaretleri (Gruplu)

### 1) Backend (Railway) — Prisma / Kullanici
| Dosya | Satır | Kod / Yorum |
|-------|--------|-------------|
| `backend/prisma/schema.prisma` | 101-104 | `girisOnaylandi Boolean @default(false)`, `girisTalepAt DateTime?` — Tesis kodu + PIN girişi için admin onayı |
| `backend/src/routes/auth.js` | 1006-1016 | `if (!kullanici.girisOnaylandi)` → token verilmez, `pendingApproval: true` dönülür (sadece PIN girişi) |
| `backend/src/routes/auth.js` | 573-579 | `girisOnaylandi` sütunu yoksa 503 DB_MIGRATION_REQUIRED |

**Gate:** Sadece **Tesis kodu + PIN** girişinde; token yok, onay bekleniyor mesajı.

### 2) Backend — KBS / Branch onayı (tesis KBS bilgisi)
| Dosya | Satır | Kod / Yorum |
|-------|--------|-------------|
| `backend/src/routes/api/checkin.js` | 24-26 | `branch.kbs_configured && !branch.kbs_approved` → 409 APPROVAL_REQUIRED "KBS bilgileriniz admin onayından sonra aktif olacaktır." |
| `backend/src/routes/appAdmin.js` | 247-260 | KBS talebi onaylanınca `branches.kbs_approved = true`, `kbs_approved_at` güncellenir |
| `supabase/migrations/0017_branches_kbs_approved.sql` | 1-5 | `branches.kbs_approved`, `kbs_approved_at` kolonları |

**Gate:** Check-in/KBS gönderimi; **kullanıcı onayı değil**, **tesis KBS bilgisi onayı**.

### 3) Supabase Edge — user_profiles
| Dosya | Satır | Kod / Yorum |
|-------|--------|-------------|
| `supabase/functions/_shared/auth.ts` | 85-98 | `user_profiles`’tan `is_disabled` okunur; **approval_status yok**. Profil yok → 403 NO_PROFILE; `is_disabled` → 403 DISABLED |

**Gate:** Edge’de **kullanıcı “onaylı mı” kontrolü yok**; sadece profil var mı ve devre dışı mı.

### 4) HTTP 401/403 üreten yerler (özet)
- **401:** Token yok / geçersiz (Edge auth, backend auth middleware, login hataları).
- **403:** Tesis aktif değil, profil yok, hesap devre dışı, branch/tesis yetkisi yok, admin değil.

---

## ADIM 2 — Edge Function: upload_community_image — Auth/Approval Karar Ağacı

```
1. OPTIONS → 200 ok
2. Method !== POST → 405
3. requireAuth(req):
   a. Authorization header / Bearer token yok → 401 "Yetkilendirme gerekli" (UNAUTHORIZED)
   b. supabase.auth.getUser(token) hata / user yok → 401 "Gecersiz veya suresi dolmus oturum..." (INVALID_TOKEN)
   c. user_profiles'tan user_id ile satır yok → 403 "Kullanici profili bulunamadi" (NO_PROFILE)
   d. profile.is_disabled === true → 403 "Hesabiniz devre disi birakildi" (DISABLED)
   e. Geçti → userId, profile, supabase döner
4. body.branch_id !== auth.profile.branch_id → 403 "Bu tesis icin yetkiniz yok"
5. Storage upload → 200 { url, path } veya 500
```

**Onay (approval) ile ilgili adım yok.** 401’in nedeni 3a veya 3b.

---

## ADIM 3 — Backend (Railway) Ortak Auth Middleware

| Dosya | Ne yapıyor | Approval / disabled kontrolü |
|-------|------------|------------------------------|
| `backend/src/middleware/authSupabase.js` | Bearer token → Supabase getUser; user_profiles + branches (kbs_approved dahil) | Yok |
| `backend/src/middleware/authTesisOrSupabase.js` | Legacy JWT veya Supabase token; user_profiles, branches | Yok (girisOnaylandi sadece PIN girişinde route içinde) |
| `backend/src/middleware/auth.js` | Legacy JWT; admin için rol kontrolü | Admin yetkisi (403); kullanıcı onayı yok |
| `backend/src/routes/appAdmin.js` | Token + user_profiles.role = 'admin' veya profiles.is_admin | Sadece admin gate |

**Sonuç:** Backend’de “kullanıcı onaylı mı” diye ortak bir middleware yok. Onay sadece **Kullanici.girisOnaylandi** ile PIN girişi akışında kullanılıyor.

---

## ADIM 4 — Veritabanı Şeması (Mevcut Durum)

### Prisma (backend)
- **Kullanici:** `girisOnaylandi`, `girisTalepAt` var (PIN girişi onayı).
- **Tesis:** `durum` (incelemede, onaylandi, aktif, pasif).
- **user_profiles (Supabase):** Prisma şemasında yok; Supabase tarafında.

### Supabase (migrations)
- **user_profiles:** `user_id`, `branch_id`, `role`, `display_name`, `title`, `avatar_url`, `is_disabled` (0004). **approval_status / approved_at yok.**
- **branches:** `kbs_approved`, `kbs_approved_at` (0017) — KBS tesis onayı.

**Eksik:** Supabase `user_profiles` tablosunda kullanıcı bazlı **kayıt onayı** (pending/approved/rejected) alanları yok.

---

## ADIM 5 — Karar: Tek Kaynak Otorite (Approval Modeli)

- **Tablo:** `user_profiles` (Supabase). Sebep: Edge ve backend auth zaten bu tabloyu kullanıyor; RLS ve Edge tek yerden okuyacak.
- **Alanlar:**
  - `approval_status`: `'pending' | 'approved' | 'rejected'` (default `'pending'`)
  - `approved_at`: `timestamptz` (nullable)
  - `approved_by`: `uuid` (auth.users.id, nullable)
  - `rejected_reason`: `text` (nullable)
- **Admin rolü:** Mevcut `user_profiles.role = 'admin'` (veya appAdmin’deki is_admin) ile aynı kalacak.

Bu raporun devamı uygulama adımlarında (migration, RLS, Edge, backend, admin panel, test planı) aşağıda ve ilgili dosyalarda yer alacaktır.

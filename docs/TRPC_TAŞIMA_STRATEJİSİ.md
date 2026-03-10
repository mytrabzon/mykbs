# tRPC’ye Taşıma Stratejisi — Nasıl Yapalım?

Bu belge, Edge Functions → tRPC geçişinde **bizim proje için en mantıklı yol**u tanımlar: hibrit model + kademeli geçiş.

---

## 1. Öneri: Hibrit + Kademeli

- **Hepsini bir anda taşımıyoruz.** Hem risk hem iş yükü yüksek.
- **Okuma + basit mutation’lar** tRPC’ye taşınır; **upload / harici tetikleyiciler** Edge Function kalır.
- **Client** kademeli güncellenir: yeni procedure’lar tRPC ile, eskiler `callFn` ile çalışmaya devam eder.

---

## 2. Ne tRPC’de, Ne Edge’de Kalsın?

| tRPC’ye taşı (öncelikli) | Edge Function olarak kalsın |
|--------------------------|-----------------------------|
| `me`, `rooms_list`, `room_get`, `facilities_list` | `upload_avatar`, `upload_community_image`, `document_scan` (büyük body/base64) |
| `settings_get`, `settings_update`, `settings_kbs_test` | `send-sms` (backend tetikler) |
| `in_app_notifications_list`, `in_app_notifications_mark_read` | `sync_branch_profile` (backend tetikler) |
| `profile_update` (küçük JSON) | `kbs_status_notify`, `notification_dispatch`, `push_dispatch` (entegrasyon) |
| `community_post_list`, `community_post_comments_list`, `community_post_create`, `community_post_react`, `community_post_delete`, `community_post_restore`, `community_post_comment`, `community_comment_delete`, `community_announcement_create` | İsterseniz bunları da tRPC’de toplayabilirsiniz; mantık aynı. |
| `checkin_create`, `checkout` | |
| `admin_*` (panel tarafı, token ile) | |

**Özet:** Okuma + standart mutation’lar tRPC; **büyük binary** ve **backend’den URL ile tetiklenen** işler Edge’de kalsın.

---

## 3. tRPC Context / Auth Nasıl Olmalı?

Şu an tRPC `createContext` **service role** client kullanıyor; Edge’deki `me`, `rooms_list` vb. ise **requireAuth** ile token doğrulayıp yine service role ile çalışıyor. Yani RLS değil, uygulama tarafında `user_id` / `branch_id` ile filtre var.

**Öneri:** tRPC context’i mevcut Edge davranışına getir.

1. **createContext(req):**
   - `Authorization: Bearer <token>` al.
   - Token yoksa: `{ supabase, user: null }` dön (public procedure’lar çalışsın).
   - Token varsa: `supabase.auth.getUser(token)` ile kullanıcı doğrula, `profiles` ile branch/role al (aynı `requireAuth` mantığı).
   - Dönüş: `{ supabase (service role), user: { id, profile } }` veya `user: null`.

2. **Procedure tipleri:**
   - `publicProcedure`: Token zorunlu değil (örn. health).
   - `protectedProcedure`: `ctx.user` zorunlu; yoksa `UNAUTHORIZED` fırlat.

Böylece `me`, `rooms_list` gibi procedure’lar `protectedProcedure` kullanır; kod tarafında davranış Edge ile aynı olur.

---

## 4. Kademeli Yapılacaklar (Fazlar)

### Faz 1 — Altyapı (1–2 gün)
- tRPC **context**’i güncelle: token doğrula, `user` + `profile` ekle.
- `protectedProcedure` ekle (_shared/trpc.ts).
- Router’ı grupla: `auth`, `rooms`, `facilities`, `settings`, `community`, `checkin`, `admin` (alt router’lar).
- **İlk procedure’lar:** `me`, `health` (me protected, health public). Mobile’da sadece `me` için tRPC client dene; `callFn('me')` yedekte kalsın.

### Faz 2 — Okuma + Sık Kullanılan (2–3 gün)
- `rooms_list`, `room_get`, `facilities_list`, `settings_get`, `in_app_notifications_list` → tRPC’ye taşı.
- Mobile’da bu çağrıları tRPC’ye geçir (tek tek veya batching ile).
- Eski Edge Function’ları **henüz silme**; aynı anda hem Edge hem tRPC cevap verebilir (geçiş süresi).

### Faz 3 — Mutation’lar (2–3 gün)
- `settings_update`, `profile_update`, `checkin_create`, `checkout`, `in_app_notifications_mark_read`.
- Community: `community_post_list`, `community_post_create`, `community_post_comment`, vb.
- Admin: `admin_user_list`, `admin_dashboard_stats`, vb. (panel token ile).

### Faz 4 — Temizlik (isteğe bağlı)
- Taşınan procedure’lar için Edge Function’ları kaldır veya deprecated işaretle.
- `callFn` / `callEdgeFunction` kullanımını sadece tRPC’de olmayan (upload, harici) endpoint’lere indir.

---

## 5. Upload ve Harici Çağrılar

- **upload_avatar, upload_community_image, document_scan:**  
  Body büyük (base64). **Seçenekler:**  
  - (A) Olduğu gibi Edge Function kalsın; client `callFn('upload_avatar', body)` kullanmaya devam etsin.  
  - (B) İleride: tRPC’de `storage.getUploadUrl` gibi procedure ile signed URL al, client doğrudan Storage’a yüklesin; Edge sadece metadata yazsın.  
  Önce (A) yeterli.

- **Backend’den çağrılanlar (sync_branch_profile, send-sms, vb.):**  
  Backend’in tek endpoint’e POST atması yeterli. tRPC’ye taşırsanız bile backend aynı URL’e `POST /functions/v1/trpc` + procedure adı/body ile istek atar; ek olarak tRPC client kullanması şart değil.

---

## 6. Client Tarafı (Mobile + Admin)

- **Tek seferde refactor yok.** Önce tRPC client kur (Supabase Functions URL + fetch/links).
- Yeni procedure’lar eklendikçe ilgili ekranlarda `callFn('x')` → `trpc.x.query()` veya `trpc.x.mutation()` yap.
- Batching: `trpc.me.query()` + `trpc.rooms_list.query({ ... })` aynı istekte birleştirilebilir (tRPC batch link ile).
- Admin panel: Aynı mantık; `callEdgeFunction` yerine tRPC client kullanımı kademeli.

---

## 7. Soğuk Başlangıç / Timeout

- Tek Edge Function’da tüm router yükleneceği için soğuk başlangıç tek seferde olur. Supabase’te genelde kabul edilebilir.
- Çok ağır procedure (örn. büyük rapor) olursa: o işi ayrı Edge Function’da tutmak veya timeout’u artırmak gerekebilir. Şimdilik okuma/mutation’lar için tek function yeterli.

---

## 8. Sonuç: “En İyisi Bizim İçin Ne?”

| Karar | Açıklama |
|-------|----------|
| **Hibrit** | Okuma + standart mutation tRPC; upload + harici tetikleyiciler Edge. |
| **Kademeli** | Önce context + 1–2 procedure (me, rooms_list), sonra okumalar, sonra mutation’lar. |
| **Context** | tRPC context = token doğrula + user/profile (requireAuth ile uyumlu). |
| **Client** | callFn/callEdgeFunction’ı yer yer tRPC ile değiştir; hepsini aynı anda değiştirme. |
| **Upload / backend** | Upload ve backend-tetiklemeli fonksiyonlar şimdilik Edge’de kalsın. |

Bu plan hem riski azaltır hem de tip güvenliği, batching ve tek deploy avantajlarını kademeli almanızı sağlar.

---

## 9. Yapılan Uygulama (Faz 1 tamamlandı)

- **Context** (`supabase/functions/_shared/context.ts`): Async `createContext(req)` — JWT doğrulama, `user_profiles` yükleme, `user: null` veya `{ id, profile }`. `requireAuth` ile aynı mantık.
- **trpc.ts**: `publicProcedure`, `protectedProcedure` (ctx.user yoksa `TRPCError` UNAUTHORIZED).
- **Routers**: `routers/auth.ts` (me), `routers/rooms.ts` (list, get), `routers/facilities.ts` (list), `routers/settings.ts` (get). Zod ile input validasyonu (rooms.list, rooms.get).
- **Ana router** (`trpc/index.ts`): `auth`, `rooms`, `facilities`, `settings` merge; CORS; OPTIONS; GET /health; async createContext; onError log.
- **Mobile client** (`mobile/src/lib/trpc/`): `@trpc/client@10`, `createTRPCProxyClient` + `httpLink`, Supabase base URL + `/functions/v1/trpc`, header’da `supabase.auth.getSession()` token. Export: `trpc`, types (MeResult, RoomsListResult, …).

**Kullanım (mobil):**

```ts
import { trpc } from '@/lib/trpc';

// Tek istek
const me = await trpc.auth.me.query();
const rooms = await trpc.rooms.list.query({ filtre: 'tumu' });
const facility = await trpc.facilities.list.query();
const settings = await trpc.settings.get.query();
const room = await trpc.rooms.get.query({ id: '...' });
```

Eski `callFn('me')` vb. çalışmaya devam eder; yeni kodda isterseniz `trpc.auth.me.query()` kullanılabilir.

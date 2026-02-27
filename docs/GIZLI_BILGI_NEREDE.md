# Gizli Bilgiler Nerede Tutulur?

## Kural: Kod nerede çalışıyorsa, gizliler orada tanımlanır

| Nerede çalışıyor?        | Gizliler nerede?                    | Neden? |
|--------------------------|--------------------------------------|--------|
| **Supabase Edge Functions** | Supabase Dashboard → **Edge Functions → Secrets** (veya Project Settings) | Edge kodu Supabase sunucularında çalışır; sadece Supabase’in kendi secret’larına erişir. |
| **Backend (Node, Railway)** | **Railway Variables** (canlı) / **backend/.env** (yerel) | Backend Supabase’te değil, Railway’de çalışır; Supabase secret’larına erişemez. Kendi env’i gerekir. |
| **Mobil uygulama**       | **EAS / app.config / .env** sadece “gizli olmayan” ayarlar (URL, anon key) | Service role, DB şifresi asla mobilde olmaz. Sadece backend URL ve Supabase anon key. |

## Özet

- **Supabase Secrets** → Sadece **Supabase’in çalıştırdığı** şeyler için: Edge Functions, Supabase’in kendi servisleri.  
  Edge’de `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` gibi kullanırsın; bu değer Supabase’e senin eklediğin secret’tan gelir.

- **Backend (.env / Railway)** → **Senin backend’in** (Node, Railway’de) Supabase’in sunucularında çalışmıyor. Bu yüzden Supabase’in “Edge secret” bölümüne eklediğin değerlere **erişemez**. Backend’in kendi ortam değişkenleri gerekir: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET` vb. Bunları ya yerelde `backend/.env` ya da canlıda **Railway Variables** ile verirsin.

- **Mobil** → Gizli bilgi (service_role, DB şifresi) **hiç** konulmaz. Sadece backend URL ve anon key gibi client-safe ayarlar .env / EAS / app.config’te olur.

Yani: Supabase secret’ları **Edge + Supabase tarafı** için; backend’in gizlileri **backend’in çalıştığı yer** (Railway / .env) için. İkisi farklı ortam olduğu için iki yerde de tanımlamak zorundasın.

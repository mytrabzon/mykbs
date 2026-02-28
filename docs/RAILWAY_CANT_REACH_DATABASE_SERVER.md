# Railway: "Can't reach database server at db.xxx.supabase.co:5432"

## Sorun

Backend Railway’de ayağa kalkıyor, ancak ilk API veya `/health/db` isteğinde:

- **Hata:** `Can't reach database server at db.iuxnpxszfvyrdifchwvr.supabase.co:5432`
- **Sonuç:** `/health/db` → 500, API’ler → 500

**Neden:** Supabase direct (5432) varsayılan olarak **IPv6** kullanır; Railway outbound **IPv6 desteklemez**.

---

## Çözüm 1: Direct kalsın — Supabase IPv4 add-on (önerilen)

**Direct connection** kullanmaya devam etmek istiyorsan, Supabase projesine **IPv4 add-on** ekle. Böylece aynı `DATABASE_URL` (direct, port 5432) Railway’den de çalışır; pooler’a geçmene gerek kalmaz.

1. [Supabase Dashboard](https://supabase.com/dashboard) → projen → **Project Settings** (sol altta) → **Add-ons**.
2. **IPv4 Address** add-on’unu bul, **Enable** et.
3. Ücret: ~$4/ay ([detay](https://supabase.com/docs/guides/platform/ipv4-address)).
4. Railway’de **DATABASE_URL**’i değiştirme; mevcut direct URI aynen kalsın. Add-on açıldıktan sonra bağlantı IPv4 üzerinden gider.

Downtime yok; sadece yeni bağlantılar IPv4 kullanır.

---

## Çözüm 2: Add-on istemiyorsan — Pooler (Session mode)

IPv4 add-on kullanmak istemiyorsan, Railway’de **DATABASE_URL**’i Supabase **Session mode** (pooler) URI ile değiştir:

1. Supabase → **Connect** / **Database** → Connection string → **Session mode** → URI kopyala.
2. Railway → **Variables** → **DATABASE_URL** = bu URI + sonda `&pgbouncer=true`.
3. Redeploy.

Detay: [RAILWAY_DATABASE_SESSION_MODE.md](./RAILWAY_DATABASE_SESSION_MODE.md).

---

## Özet

| Tercih | Yapılacak |
|--------|------------|
| **Direct kalsın** | Supabase → Add-ons → IPv4 Address → Enable |
| **Pooler kullanayım** | DATABASE_URL = Session mode URI + `&pgbouncer=true` |

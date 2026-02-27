# Railway Deploy – Production (mykbs-production.up.railway.app)

**Hedef URL:** `https://mykbs-production.up.railway.app` (marvelous-generosity / production servisi)

**Tek seferlik:** `backend/.env` dosyasına **Railway proje token** ekleyin:
- Railway Dashboard → **mykbs-production** projesini aç → **Settings** → **Tokens** → **Generate Project Token**
- `backend/.env` içine: `RAILWAY_TOKEN=<yapıştır>`

Bundan sonra `npm run deploy` (backend klasöründen) doğrudan bu servise deploy eder.

## Yanlış servise bağlıysanız

Önce bağlantıyı kaldırın, sonra doğru projeye bağlanın:

```bash
cd backend
railway unlink
railway link
```

## Doğru servise bağlama

1. **`railway link`** çalıştırın.

2. Açılan menüde **mutlaka** şu servise bağlanın:
   - **Workspace:** Kendi workspace’iniz (örn. mytrabzon's Projects)
   - **Project:** **mykbs-production** (veya bu URL’in olduğu proje)
   - **Service:** Adresi `https://mykbs-production.up.railway.app` olan backend servisi

   Railway Dashboard’da: Proje → servis → **Settings** → **Networking** / **Domains** kısmında `mykbs-production.up.railway.app` yazan servisi seçin.

3. Bağlandıktan sonra deploy:

```bash
railway up
```

Bundan sonra `railway up` her zaman **mykbs-production** servisine deploy eder.

---

## Servis ID ile deploy (mykbs-production)

**Production servis ID:** `19c28945-a250-4eb2-b1aa-6432585a9124`

Önce bu servisin olduğu **projeye** bağlanın (`railway link` → mykbs-production projesini seçin). Sonra:

```bash
cd backend
railway up --service 19c28945-a250-4eb2-b1aa-6432585a9124
```

GitHub Actions için: **Settings → Secrets → RAILWAY_SERVICE_ID** = `19c28945-a250-4eb2-b1aa-6432585a9124` olarak ayarlayın; böylece `main` push’larında deploy bu servise gider.

# VPS (Hetzner) ile Sabit IP ve KBS Bağlantısı

Amaç: KBS’ye giden tüm istekler **tek sabit IP**’den çıksın (örn. Hetzner VPS `178.104.12.20`), böylece Jandarma/Polis IP whitelist’e tek adres yazılsın; Railway vb. “random egress IP” sorunu ortadan kalksın.

---

## 1. Özet akış

- **Mobil** → `EXPO_PUBLIC_BACKEND_URL` = VPS adresi (örn. `http://178.104.12.20` veya domain + HTTPS)
- **Backend** → VPS’te (Node + PM2 + Nginx) çalışır; tüm dış istekler (KBS, SMS, vb.) bu sunucunun IP’sinden çıkar
- **KBS** → Jandarma/Polis tarafında sadece bu IP’nin whitelist’te olması yeterli

---

## 2. Backend ortam değişkenleri (VPS’te)

VPS’te backend’in `.env` veya `pm2 env` içinde mutlaka:

```bash
# KBS Jandarma (resmi servis)
JANDARMA_KBS_URL=https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc

# Diğerleri (Supabase, JWT, SMS, vb.) projede ne varsa aynen
NODE_ENV=production
PORT=8080
DATABASE_URL=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
```

Backend kodu zaten `process.env.JANDARMA_KBS_URL` kullanıyor (`backend/src/services/kbs/jandarma.js`). Hardcode URL yok.

---

## 3. Egress IP doğrulama

Backend’e eklenen debug endpoint:

```http
GET /debug/egress-ip
```

- Auth gerekmez.
- Backend, `https://api.ipify.org?format=json` ile kendi çıkış IP’sini alır ve döner.

**Beklenen (VPS’te):** `{ "ok": true, "ip": "178.104.12.20" }`  
Eğer farklı bir IP dönüyorsa istek o ortamdan çıkmıyordur (ör. hâlâ Railway veya başka bir host).

Örnek:

```bash
curl -s http://178.104.12.20/debug/egress-ip
```

---

## 4. VPS hazırlık (kısa özet)

- Ubuntu 24.04, güncelleme, UFW (22, 80, 443 açık)
- Node 20, PM2, Nginx
- Repo/backend `/opt/mykbs` (veya benzeri)
- `.env` / `.env.production` ile env’leri set et
- `npm ci --omit=dev` → `pm2 start ... --name mykbs-backend` → `pm2 save` / `pm2 startup`
- Nginx: `proxy_pass http://127.0.0.1:8080`
- Dış test: `curl http://178.104.12.20/health` ve `curl http://178.104.12.20/debug/egress-ip`

---

## 5. Mobil uygulama

- Backend artık VPS’teyse: `EXPO_PUBLIC_BACKEND_URL=http://178.104.12.20` (veya domain + HTTPS)
- Giriş/kayıt/tesis/rapor/KBS tüm istekler bu URL’e gider.

---

## 6. KBS “çıkış” / session temizliği

- KBS servislerinde çoğu zaman ayrı bir “logout” endpoint’i yok; istekler tesis kodu + şifre ile yapılır, sunucu tarafında oturum tutulmaz.
- **Yapılacak (güvenli temizlik):**
  - **Mobil:** Kullanıcı çıkış yapınca tesis kodu / PIN (SecureStore vb.) temizlenir.
  - **Backend:** KBS için ayrı bir “kbs_session” veya “kbs_token” tutulmuyor; varsa logout/çıkış akışında silinir. Şu anki yapıda ekstra backend logout endpoint’i zorunlu değil; client tarafı temizlik yeterli.

---

## 7. KBS URL / bağlantı hataları

- **JANDARMA_KBS_URL** set mi: `printenv | grep JANDARMA` (SSH), veya `pm2 env mykbs-backend`
- Backend log: `pm2 logs mykbs-backend --lines 200`
- “URL yanlış” / bağlantı hatası genelde: endpoint yanlış, TLS/SNI, SOAP action uyumsuzluğu veya sunucu saat/DNS.
- DNS: `nslookup vatandas.jandarma.gov.tr`
- TLS: `curl -I https://vatandas.jandarma.gov.tr`

---

## İlgili dosyalar

| Ne | Nerede |
|----|--------|
| KBS URL (env) | `backend/src/services/kbs/jandarma.js` → `process.env.JANDARMA_KBS_URL` |
| Egress IP endpoint | `backend/src/routes/debug.js` → `GET /debug/egress-ip` |
| Env örnek | `backend/.env.example` |
| KBS bağlantı genel | `docs/KBS_BAGLANTI_GEREKSINIMLERI.md` |

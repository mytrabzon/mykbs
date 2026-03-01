# Backend deploy (Railway) – TOKEN_EXPIRED 401 düzeltmesi

**Sorun:** Giriş/kayıt sonrası backend JWT ile gelen istekler 401 "Oturum süresi doldu" alıyor.  
**Sebep:** Auth middleware önce token'ı Supabase ile doğruluyor; backend JWT "signature is invalid" veriyor. Eski kod bunu "expired" sayıp 401 dönüyordu.  
**Düzeltme:** `src/middleware/authTesisOrSupabase.js` içinde sadece gerçekten **expired** mesajı gelince 401 dönülüyor; "signature is invalid" gelince **legacy (backend) JWT** doğrulamasına geçiliyor.

## Yapman gereken

Railway’in bağlı olduğu repoya backend değişikliklerini push et; Railway yeni commit’i deploy etsin.

```bash
# Backend klasöründeyken veya repo kökündeyken
git add backend/src/middleware/authTesisOrSupabase.js
git commit -m "fix(auth): backend JWT için 401 dönme, legacy JWT'ye düş"
git push
```

Railway otomatik deploy kullanmıyorsa: Railway dashboard → bu servis → **Deploy** / **Redeploy** ile son commit’i deploy et.

Deploy bittikten sonra aynı backend JWT ile `/api/tesis`, `/api/rapor` istekleri 200 dönmeli.

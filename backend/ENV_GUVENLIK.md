# .env ve Gizli Bilgiler — Güvenlik

## Kurallar

1. **`.env` asla commit edilmez.**  
   Zaten `backend/.gitignore` ve proje `.gitignore` içinde. Kontrol: `git check-ignore backend/.env` → "backend/.env" döner.

2. **Gerçek şifre/key sadece `.env` içinde.**  
   `.env.example` sadece placeholder içerir (`[YOUR-PASSWORD]`, `<anon_key>` vb.). Örnek dosyayı kopyalayıp `.env` yap, değerleri kendin doldur.

3. **GitHub’a .env gitti mi?**  
   - Hiç commit edilmediyse → bir şey yapma.  
   - **Bir ara commit edildiyse:**  
     - Tüm şifreleri ve API key’leri değiştir (Supabase database password reset, SUPABASE_SERVICE_ROLE_KEY yenile, JWT_SECRET değiştir, Railway token yenile).  
     - Repo’dan .env’i geçmişten kaldırmak için: `git filter-repo` veya BFG Repo-Cleaner kullan (dikkatli, backup al).

4. **Railway / sunucu:**  
   Gizli değerleri sadece Railway Variables (veya ilgili platformun env) üzerinden ver. Kod içine veya repo’ya yazma.

## Hızlı kontrol

```bash
# .env takip ediliyor mu? (Boş çıkmali)
git ls-files backend/.env

# .env ignore ediliyor mu?
git check-ignore -v backend/.env
```

# Railway deploy kontrol listesi

- **Veritabanı:** Railway’da `DATABASE_URL` tanımlıysa (SQLite veya Postgres), deploy sonrası mutlaka çalıştırın:
  ```bash
  npx prisma migrate deploy
  ```
  Aksi halde `girisOnaylandi` sütunu eksik hatası alırsınız; giriş 503 döner.

- **Supabase:** Backend’in Supabase JWT doğrulayabilmesi için `SUPABASE_SERVICE_ROLE_KEY` (ve `SUPABASE_URL`) tanımlı olmalı. Yoksa OTP ile giriş sonrası “Geçersiz token” alınabilir.

- **Push / KBS:** `POST /api/push/register` ve `GET/POST /api/kbs/credentials/*` route’ları bu repo ile gelir. 404 alıyorsanız en güncel backend’in deploy edildiğinden emin olun.

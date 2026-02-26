# Giriş Bilgileri

## Admin Hesap Bilgileri

### Tesis Kodu ve PIN ile Giriş

**Tesis Kodu:** `1`  
**PIN (Şifre):** `611633`

### Giriş Yapma

1. Mobile uygulamayı açın
2. Giriş ekranında:
   - **Tesis Kodu:** `1` yazın
   - **PIN:** `611633` yazın
3. "Giriş Yap" butonuna tıklayın

### Hesap Oluşturma

Eğer veritabanında admin hesabı yoksa, SQL script'ini çalıştırın:

1. Supabase SQL Editor'e gidin:
   ```
   https://supabase.com/dashboard/project/iuxnpxszfvyrdifchwvr/sql/new
   ```

2. `backend/scripts/create-admin-sql.sql` veya `backend/scripts/create-all-tables-and-admin.sql` dosyasındaki SQL'i çalıştırın

3. Script çalıştıktan sonra yukarıdaki bilgilerle giriş yapabilirsiniz

### Önemli Notlar

- **Telefon numarası artık istenmiyor** - Sadece Tesis Kodu + PIN ile giriş yapılır
- PIN ile eşleşen kullanıcı otomatik olarak bulunur
- Admin hesabı "sahip" rolüne sahiptir
- Tesis durumu "aktif" olmalıdır

### Sorun Giderme

Eğer giriş yapamıyorsanız:

1. **Backend çalışıyor mu?** Kontrol edin: `http://localhost:3000/health`
2. **Veritabanında hesap var mı?** Supabase Dashboard'dan kontrol edin
3. **PIN doğru mu?** PIN: `611633` (6 haneli)
4. **Tesis durumu aktif mi?** Veritabanında `durum = 'aktif'` olmalı

### Test Hesabı

Test modunda hızlı test hesabı oluşturmak için:

1. Mobile uygulamada "Tesis Başvurusu Yap" ekranına gidin
2. "Test Hesabı Oluştur" butonuna tıklayın
3. Otomatik oluşturulan Tesis Kodu ve PIN ile giriş yapın

**Not:** Test hesabı bir cihazdan sadece bir kere oluşturulabilir ve 1 saat sonra otomatik kapanır.


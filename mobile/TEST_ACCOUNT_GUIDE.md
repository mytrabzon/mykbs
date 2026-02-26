# 🧪 Test Hesabı ve Başvuru Sistemi

## ✅ Tamamlanan Özellikler

### 1. Test Hesabı Sistemi
- ✅ Bir cihazdan sadece bir kere test hesabı oluşturulabilir
- ✅ Test hesabı 1 saat sonra otomatik kapanır
- ✅ Cihaz bazlı kontrol (aynı cihazdan tekrar oluşturulamaz)
- ✅ Süre dolunca otomatik temizleme

### 2. Başvuru Ekranı Düzeltmeleri
- ✅ Test hesabı oluşturma butonu eklendi
- ✅ Test hesabı bilgileri gösterimi
- ✅ Test hesabı ile direkt giriş yapma
- ✅ Tüm işlemlere loglar eklendi
- ✅ Try-catch blokları ile hata yakalama

### 3. Login Ekranı İyileştirmeleri
- ✅ Her input için açıklayıcı label ve hint eklendi
- ✅ Placeholder'lar güncellendi
- ✅ Test hesabı bilgileri otomatik doldurma
- ✅ Hangi bilgilerin girileceği açıkça belirtildi

## 📱 Kullanım

### Test Hesabı Oluşturma

1. **Başvuru Ekranına Git**
   - Login ekranından "Tesis Başvurusu Yap" butonuna tıkla

2. **Test Hesabı Oluştur**
   - Başvuru ekranının üst kısmında "Test Hesabı Oluştur" butonuna tıkla
   - Otomatik olarak test hesabı bilgileri oluşturulur:
     - Tesis Kodu: `TEST123456` (rastgele)
     - Telefon: `5550000000`
     - PIN: `123456`

3. **Test Hesabı Bilgileri**
   - Oluşturulan test hesabı bilgileri ekranda gösterilir
   - "Bu Bilgilerle Giriş Yap" butonuna tıklayarak direkt giriş yapabilirsiniz
   - Veya bilgileri manuel olarak login ekranına girebilirsiniz

### Test Hesabı Özellikleri

- **Tek Kullanım**: Bir cihazdan sadece bir kere oluşturulabilir
- **Süre**: 1 saat geçerli
- **Otomatik Temizleme**: Süre dolunca otomatik olarak temizlenir
- **Cihaz Kontrolü**: Aynı cihazdan tekrar oluşturulamaz

### Login Ekranı Bilgileri

#### Tesis Kodu
- **Açıklama**: Başvuru sonrası size verilen tesis kodunu giriniz
- **Örnek**: `ABC123` veya `TEST123456`
- **Format**: Büyük/küçük harf duyarlı değil

#### Telefon
- **Açıklama**: Başvuruda belirttiğiniz WhatsApp telefon numaranızı giriniz
- **Örnek**: `5551234567` (10 haneli)
- **Format**: Sadece rakamlar, başında 0 yok

#### PIN
- **Açıklama**: Başvuru sonrası size verilen 6 haneli PIN kodunu giriniz
- **Örnek**: `123456` (6 haneli)
- **Format**: Sadece rakamlar, 6 karakter

## 🔧 Teknik Detaylar

### Test Hesabı Yönetimi
- **Dosya**: `src/utils/testAccount.js`
- **Storage Keys**:
  - `test_account_data`: Test hesabı bilgileri
  - `test_account_expiry`: Son kullanma tarihi
  - `test_account_device`: Cihaz ID'si
  - `device_unique_id`: Cihaz benzersiz ID'si

### API Endpoints
- **Başvuru**: `POST /auth/basvuru`
- **Giriş**: `POST /auth/giris`

### Loglar
Tüm işlemler test modunda loglanır:
- Test hesabı oluşturma
- Test hesabı kontrolü
- Başvuru gönderme
- Login işlemleri

## 📝 Örnek Kullanım Senaryosu

1. **İlk Kullanım**:
   ```
   Başvuru Ekranı → Test Hesabı Oluştur → Bilgileri Kopyala → Login → Giriş Yap
   ```

2. **Test Hesabı ile Direkt Giriş**:
   ```
   Başvuru Ekranı → Test Hesabı Oluştur → "Bu Bilgilerle Giriş Yap" → Otomatik Giriş
   ```

3. **Süre Dolduktan Sonra**:
   ```
   Test hesabı otomatik temizlenir → Yeni test hesabı oluşturulamaz (aynı cihazdan)
   ```

## ⚠️ Notlar

- Test hesabı sadece test amaçlıdır
- Gerçek başvuru için formu doldurup göndermeniz gerekir
- Test hesabı 1 saat sonra otomatik kapanır
- Aynı cihazdan tekrar test hesabı oluşturulamaz


# Supabase Proje Bağlantı Sorunu Çözümü

## 🔍 Sorun

Terminal'de görünen proje listesinde **iuxnpxszfvyrdifchwvr** projesi görünmüyor. 
Şu anda bağlı olan proje: **xcvcplwimicylaxghiak** (sonertoprak97@gmail.com's Project)

Ama çalışmak istediğiniz proje: **iuxnpxszfvyrdifchwvr** (developerlitxtech@gmail.com's Project)

## ✅ Çözüm Adımları

### Yöntem 1: Doğru Hesaba Login Olun (Önerilen)

```powershell
# 1. Mevcut login'i kontrol et
supabase projects list

# 2. Eğer yanlış hesaptaysanız, logout yapın
supabase logout

# 3. Doğru hesaba login olun (developerlitxtech@gmail.com)
supabase login

# 4. Projeleri tekrar listeleyin
supabase projects list
# Artık iuxnpxszfvyrdifchwvr projesi görünmeli

# 5. Projeye bağlanın
cd supabase
supabase link --project-ref iuxnpxszfvyrdifchwvr
```

### Yöntem 2: Access Token ile Bağlanın

Eğer login sorunu varsa, access token kullanabilirsiniz:

1. **Supabase Dashboard'a gidin:**
   - https://app.supabase.com
   - **developerlitxtech@gmail.com** hesabıyla giriş yapın
   - Projenize gidin: **iuxnpxszfvyrdifchwvr**

2. **Access Token oluşturun:**
   - Settings → Access Tokens
   - "Generate new token" butonuna tıklayın
   - Token'ı kopyalayın

3. **Terminal'de bağlanın:**
```powershell
cd supabase
supabase link --project-ref iuxnpxszfvyrdifchwvr --password <your-access-token>
```

### Yöntem 3: Script Kullanın

```powershell
.\supabase\link-project.ps1
```

## 🚀 Deploy

Bağlantı başarılı olduktan sonra:

```powershell
cd supabase
supabase functions deploy trpc --no-verify-jwt
```

## 🔍 Kontrol

Bağlantının doğru olduğunu kontrol edin:

```powershell
supabase status
```

Çıktıda şunları görmelisiniz:
- Project ID: iuxnpxszfvyrdifchwvr
- API URL: https://iuxnpxszfvyrdifchwvr.supabase.co

## ⚠️ Önemli Notlar

1. **Farklı hesaplar:** Eğer iki farklı Supabase hesabınız varsa, her proje için doğru hesaba login olmanız gerekir.

2. **Organizasyon:** Proje farklı bir organizasyonda olabilir. O zaman organizasyon seçmeniz gerekebilir.

3. **Access Token:** Access token kullanırsanız, token'ı güvenli tutun ve `.gitignore`'a ekleyin.

## 📝 Hızlı Komutlar

```powershell
# Logout
supabase logout

# Login
supabase login

# Projeleri listele
supabase projects list

# Projeye bağlan
cd supabase
supabase link --project-ref iuxnpxszfvyrdifchwvr

# Durum kontrol
supabase status

# Deploy
supabase functions deploy trpc --no-verify-jwt
```


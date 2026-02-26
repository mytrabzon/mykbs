# Supabase Bağlantı Sorunu Çözümü

## 🔧 Sorun: TOML Parse Hatası ve Yetki Hatası

### Çözüm Adımları

#### 1. Supabase'e Login Olun

```powershell
supabase login
```

Bu komut browser'da Supabase login sayfasını açar. Login olduktan sonra terminal'e dönün.

#### 2. Projeleri Listeleyin

```powershell
supabase projects list
```

Bu komut erişiminiz olan tüm projeleri gösterir. `iuxnpxszfvyrdifchwvr` projesinin listede olduğundan emin olun.

#### 3. Projeye Bağlanın

```powershell
cd supabase
supabase link --project-ref iuxnpxszfvyrdifchwvr
```

Eğer hala hata alıyorsanız:

#### 4. Alternatif: Access Token ile Bağlanın

```powershell
# Supabase Dashboard'dan access token alın
# Settings → Access Tokens → Generate new token

# Token ile bağlanın
supabase link --project-ref iuxnpxszfvyrdifchwvr --password <your-access-token>
```

#### 5. Manuel Config (Son Çare)

Eğer `supabase link` çalışmazsa, config dosyasını manuel oluşturabilirsiniz:

1. Supabase Dashboard → Projeniz → Settings → API
2. `project_ref` değerini alın (genellikle URL'deki subdomain)
3. `.supabase/config.toml` dosyasını oluşturun (bu dosya `supabase link` komutu tarafından otomatik oluşturulur)

### Config Dosyası Formatı

`supabase/config.toml` dosyası şu şekilde olmalı:

```toml
[functions.trpc]
verify_jwt = false
```

Proje bağlantısı `.supabase/` klasöründe saklanır (bu klasör `.gitignore`'da olmalı).

### Deploy İçin

Bağlantı başarılı olduktan sonra:

```powershell
supabase functions deploy trpc --no-verify-jwt
```

### Sorun Devam Ederse

1. **Supabase CLI versiyonunu kontrol edin:**
   ```powershell
   supabase --version
   ```

2. **CLI'yi güncelleyin:**
   ```powershell
   npm install -g supabase
   ```

3. **Debug modunda çalıştırın:**
   ```powershell
   supabase link --project-ref iuxnpxszfvyrdifchwvr --debug
   ```

4. **Supabase Dashboard'dan manuel deploy:**
   - Dashboard → Edge Functions → Create Function
   - Function adı: `trpc`
   - `supabase/functions/trpc/index.ts` içeriğini kopyalayın


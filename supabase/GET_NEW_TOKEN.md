# Supabase Access Token Oluşturma Rehberi

## Sorun
Access token geçersiz veya süresi dolmuş. Yeni bir token oluşturmanız gerekiyor.

## Adımlar

### 1. Supabase Dashboard'a Gidin
https://supabase.com/dashboard

### 2. Projeyi Seçin
- Project: `iuxnpxszfvyrdifchwvr`
- Email: `developerlitxtech@gmail.com` ile giriş yapın

### 3. Access Token Oluşturun

**Yöntem A: Account Settings'ten**
1. Sağ üstteki profil ikonuna tıklayın
2. "Account Settings" veya "Access Tokens" seçeneğine gidin
3. "Generate new token" butonuna tıklayın
4. Token'a bir isim verin (örn: `mykbs-cli`)
5. Scope: `all` veya en azından `projects:read` ve `functions:write` seçin
6. "Generate token" butonuna tıklayın
7. **Token'ı kopyalayın** (sadece bir kere gösterilir!)

**Yöntem B: Project Settings'ten**
1. Projenizi açın
2. Sol menüden "Settings" > "Access Tokens" seçin
3. "Create new token" butonuna tıklayın
4. Token'a bir isim verin
5. Scope seçin ve token'ı oluşturun

### 4. Token'ı Kullanın

Token'ı aldıktan sonra:

```powershell
# Token ile projeyi link edin
supabase link --password <YENİ_TOKEN> --project-ref iuxnpxszfvyrdifchwvr

# Deploy edin
supabase functions deploy trpc
```

### 5. Alternatif: Environment Variable

Token'ı environment variable olarak da ayarlayabilirsiniz:

```powershell
# PowerShell
$env:SUPABASE_ACCESS_TOKEN = "<YENİ_TOKEN>"
supabase link --project-ref iuxnpxszfvyrdifchwvr
supabase functions deploy trpc
```

## Önemli Notlar

- ⚠️ Token sadece bir kere gösterilir, mutlaka kopyalayın!
- ⚠️ Token'ı güvenli bir yerde saklayın
- ⚠️ Token'ı public repository'lere commit etmeyin
- ⚠️ Eski token'ları silin veya iptal edin

## Token Süresi

- Personal Access Token'lar genellikle süresizdir (manuel olarak silinene kadar)
- Otomatik oluşturulan token'ların belirli bir süresi olabilir
- Token süresi dolduğunda yeni bir token oluşturmanız gerekir

## Yardım

Eğer hala sorun yaşıyorsanız:
1. Supabase CLI'yi güncelleyin: `npm update -g supabase`
2. Supabase desteğine başvurun: https://supabase.com/docs/support
3. Community forumunu ziyaret edin: https://github.com/supabase/supabase/discussions


# Access Token Kullanımı

## ⚠️ Güvenlik Uyarısı

Access token'ınızı **ASLA** commit etmeyin! Bu dosya `.gitignore`'da olmalı.

## 🔑 Token Bilgisi

Token: `sbp_a7bdedcd499f716d4fbbfb277b79ecb15a687d1f`

## 🔧 Kullanım

### Yöntem 1: Environment Variable

```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_a7bdedcd499f716d4fbbfb277b79ecb15a687d1f"
supabase link --project-ref iuxnpxszfvyrdifchwvr
```

### Yöntem 2: Password Parametresi

```powershell
supabase link --project-ref iuxnpxszfvyrdifchwvr --password sbp_a7bdedcd499f716d4fbbfb277b79ecb15a687d1f
```

### Yöntem 3: Script Kullan

```powershell
.\supabase\link-with-token.ps1
```

## ❌ Sorun: Yetki Hatası

Eğer "necessary privileges" hatası alıyorsanız:

1. **Token Scope Kontrolü:**
   - Supabase Dashboard → Settings → Access Tokens
   - Token'ın "project" scope'una sahip olduğundan emin olun
   - Yeni bir token oluşturun (tüm scope'ları seçin)

2. **Alternatif: Browser Login:**
   ```powershell
   supabase logout
   supabase login
   # developerlitxtech@gmail.com ile login olun
   supabase link --project-ref iuxnpxszfvyrdifchwvr
   ```

3. **Token'ı Yenileyin:**
   - Eski token'ı silin
   - Yeni token oluşturun
   - Tüm izinleri verin

## 📝 Not

Token'ı `.env` dosyasına ekleyebilirsiniz (ama commit etmeyin):

```env
SUPABASE_ACCESS_TOKEN=sbp_a7bdedcd499f716d4fbbfb277b79ecb15a687d1f
```

Sonra PowerShell'de:
```powershell
Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
```


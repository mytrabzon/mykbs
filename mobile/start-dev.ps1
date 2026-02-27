# MyKBS Mobile Development Start Script

Write-Host "🚀 MyKBS Mobile Development Başlatılıyor..." -ForegroundColor Green

# .env dosyası kontrolü
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env dosyası bulunamadı. Oluşturuluyor..." -ForegroundColor Yellow
    
    @"
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:3000/api

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
"@ | Out-File -FilePath ".env" -Encoding utf8
    
    Write-Host "✅ .env dosyası oluşturuldu" -ForegroundColor Green
}

# Environment variables'ı yükle
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        Write-Host "  ✓ $key" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "📦 Paketler kontrol ediliyor..." -ForegroundColor Cyan

# Expo başlat (development mode)
Write-Host ""
Write-Host "🎯 Expo Development Server başlatılıyor..." -ForegroundColor Green
Write-Host ""

npm start


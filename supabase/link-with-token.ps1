# Access Token ile Supabase Projesine Bağlanma
# Token root .env dosyasindan okunur (SUPABASE_ACCESS_TOKEN)

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $root ".env"
$accessToken = $env:SUPABASE_ACCESS_TOKEN
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*SUPABASE_ACCESS_TOKEN=(.*)$') {
            $accessToken = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
$projectRef = "iuxnpxszfvyrdifchwvr"
if (-not $accessToken) {
    Write-Host "Hata: .env icinde SUPABASE_ACCESS_TOKEN tanimlayin." -ForegroundColor Red
    exit 1
}
$env:SUPABASE_ACCESS_TOKEN = $accessToken

Write-Host "🔗 Access Token ile projeye bağlanılıyor..." -ForegroundColor Green
Write-Host "Proje: $projectRef" -ForegroundColor Cyan
Write-Host ""

# Environment variable olarak ayarla
$env:SUPABASE_ACCESS_TOKEN = $accessToken

# Önce mevcut bağlantıyı kaldır
Write-Host "📤 Mevcut bağlantı kontrol ediliyor..." -ForegroundColor Yellow
$status = supabase status 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "⚠️  Mevcut bağlantı kaldırılıyor..." -ForegroundColor Yellow
    supabase unlink
}

# Projeye bağlan
Write-Host ""
Write-Host "🔗 Projeye bağlanılıyor..." -ForegroundColor Cyan
supabase link --project-ref $projectRef

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Bağlantı başarılı!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Proje Durumu:" -ForegroundColor Cyan
    supabase status
} else {
    Write-Host ""
    Write-Host "❌ Bağlantı başarısız!" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Alternatif Çözüm:" -ForegroundColor Yellow
    Write-Host "1. Supabase Dashboard'dan yeni bir access token oluşturun" -ForegroundColor White
    Write-Host "2. Token'ın 'project' scope'una sahip olduğundan emin olun" -ForegroundColor White
    Write-Host "3. Veya browser ile login olun: supabase login" -ForegroundColor White
}


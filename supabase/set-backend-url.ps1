# Opsiyonel: Node backend kullanacaksaniz BACKEND_URL secret'ini Supabase'e ekler.
# SMS giris artik sadece Supabase ile calisiyor; bu script yalnizca backend proxy kullanacaksaniz gerekli.
# Kullanim: Proje kokunden: .\supabase\set-backend-url.ps1
# veya: supabase secrets set BACKEND_URL=https://your-backend.com

$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) { $envFile = Join-Path $root "..\.env" }
if (-not (Test-Path $envFile)) {
  Write-Host "Hata: .env bulunamadi. Proje kokunde .env olusturup BACKEND_URL=... ekleyin." -ForegroundColor Red
  exit 1
}
$line = Get-Content $envFile -Raw | Select-String -Pattern "BACKEND_URL=(.+)" -AllMatches
if (-not $line -or -not $line.Matches.Groups[1].Value) {
  Write-Host ".env icinde BACKEND_URL=... satiri yok. Ornek: BACKEND_URL=https://api.example.com" -ForegroundColor Yellow
  $url = Read-Host "BACKEND_URL degerini girin (ornek https://mykbs-backend.railway.app)"
  if ([string]::IsNullOrWhiteSpace($url)) { exit 1 }
} else {
  $url = $line.Matches.Groups[1].Value.Trim()
}
Write-Host "Supabase secret ayarlaniyor: BACKEND_URL=$url" -ForegroundColor Cyan
Push-Location $root
supabase secrets set "BACKEND_URL=$url"
Pop-Location
if ($LASTEXITCODE -eq 0) { Write-Host "Tamam. Edge Function'lar artik bu backend'e istek atacak." -ForegroundColor Green }

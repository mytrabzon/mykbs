# Expo Başlatma Scripti - Doğru Dizin Kontrolü

Write-Host "=== EXPO BAŞLATMA ===" -ForegroundColor Cyan
Write-Host ""

# Dizin kontrolü
$currentDir = Get-Location
Write-Host "Mevcut dizin: $currentDir" -ForegroundColor Yellow

if ($currentDir.Path -notlike "*mobile*") {
    Write-Host "❌ YANLIŞ DİZİN!" -ForegroundColor Red
    Write-Host "mobile klasörüne gidin:" -ForegroundColor Yellow
    Write-Host "cd C:\MYKBS\mobile" -ForegroundColor White
    Write-Host ""
    Write-Host "Otomatik olarak mobile klasörüne geçiliyor..." -ForegroundColor Yellow
    Set-Location "C:\MYKBS\mobile"
    Start-Sleep -Seconds 1
}

# package.json kontrolü
if (-not (Test-Path "package.json")) {
    Write-Host "❌ package.json bulunamadı!" -ForegroundColor Red
    Write-Host "Doğru dizinde olduğunuzdan emin olun: C:\MYKBS\mobile" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Doğru dizin: $(Get-Location)" -ForegroundColor Green
Write-Host "✅ package.json bulundu" -ForegroundColor Green
Write-Host ""

# Port kontrolü
Write-Host "Port kontrolü yapılıyor..." -ForegroundColor Yellow
$port8081 = netstat -ano | findstr ":8081.*LISTENING"
if ($port8081) {
    Write-Host "⚠️  Port 8081 kullanılıyor, temizleniyor..." -ForegroundColor Yellow
    $pid = ($port8081 -split '\s+')[-1]
    if ($pid) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# Expo başlat
Write-Host "🚀 Expo başlatılıyor..." -ForegroundColor Green
Write-Host ""

npx expo start --clear


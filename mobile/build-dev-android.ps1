# Expo Development Build - Android
# Kullanım: .\build-dev-android.ps1

Write-Host "=== EXPO DEVELOPMENT BUILD (ANDROID) ===" -ForegroundColor Green
Write-Host ""

cd C:\MYKBS\mobile

# EAS CLI kontrolü
Write-Host "🔍 EAS CLI kontrol ediliyor..." -ForegroundColor Cyan
if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
    Write-Host "❌ EAS CLI bulunamadı!" -ForegroundColor Red
    Write-Host "📦 EAS CLI kuruluyor..." -ForegroundColor Yellow
    npm install -g eas-cli
    Write-Host ""
}

Write-Host "✅ EAS CLI hazır" -ForegroundColor Green
Write-Host ""

# EAS Login kontrolü
Write-Host "🔐 Expo hesabı kontrol ediliyor..." -ForegroundColor Cyan
$easAccount = eas whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Expo hesabına giriş yapılmamış" -ForegroundColor Yellow
    Write-Host "🔑 Expo hesabına giriş yapılıyor..." -ForegroundColor Cyan
    eas login
    Write-Host ""
}

Write-Host "✅ Giriş yapıldı" -ForegroundColor Green
Write-Host ""

# Build başlat
Write-Host "🚀 Development build başlatılıyor..." -ForegroundColor Green
Write-Host "📋 Profil: development" -ForegroundColor Cyan
Write-Host "📱 Platform: android" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Build süreci birkaç dakika sürebilir..." -ForegroundColor Yellow
Write-Host ""

eas build --profile development --platform android

Write-Host ""
Write-Host "✅ Build tamamlandı!" -ForegroundColor Green
Write-Host "📱 APK dosyası indirilecek ve cihazınıza yüklenebilir" -ForegroundColor Cyan


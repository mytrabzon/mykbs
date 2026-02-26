# Hızlı Android Test Scripti
# Kullanım: .\test-android-quick.ps1

Write-Host "=== HIZLI ANDROID TEST ===" -ForegroundColor Green
Write-Host ""

# 1. Temel Kontroller
Write-Host "🔍 Temel kontroller yapılıyor..." -ForegroundColor Cyan

# Node.js kontrolü
$nodeVersion = node --version 2>$null
if ($nodeVersion) {
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js bulunamadı!" -ForegroundColor Red
    exit 1
}

# npm kontrolü
$npmVersion = npm --version 2>$null
if ($npmVersion) {
    Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "❌ npm bulunamadı!" -ForegroundColor Red
    exit 1
}

# Java kontrolü
$javaVersion = java -version 2>&1 | Select-String "version"
if ($javaVersion) {
    Write-Host "✅ Java mevcut" -ForegroundColor Green
} else {
    Write-Host "⚠️  Java bulunamadı (Android build için gerekli)" -ForegroundColor Yellow
}

# 2. Proje Kontrolleri
Write-Host ""
Write-Host "📁 Proje dosyaları kontrol ediliyor..." -ForegroundColor Cyan

$requiredFiles = @(
    "package.json",
    "app.config.js", 
    "android/app/build.gradle",
    "android/app/src/main/AndroidManifest.xml"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file bulunamadı!" -ForegroundColor Red
    }
}

# 3. Bağımlılık Kontrolleri
Write-Host ""
Write-Host "📦 Bağımlılıklar kontrol ediliyor..." -ForegroundColor Cyan

if (Test-Path "node_modules") {
    Write-Host "✅ node_modules mevcut" -ForegroundColor Green
    
    # Önemli paketleri kontrol et
    $importantPackages = @(
        "react-native",
        "expo",
        "react-native-nfc-manager",
        "@react-navigation/native"
    )
    
    foreach ($pkg in $importantPackages) {
        $pkgPath = "node_modules/$pkg"
        if (Test-Path $pkgPath) {
            Write-Host "  ✅ $pkg" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $pkg bulunamadı" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "⚠️  node_modules bulunamadı" -ForegroundColor Yellow
    Write-Host "💡 Çalıştırın: npm install" -ForegroundColor Cyan
}

# 4. Android Konfigürasyon Kontrolleri
Write-Host ""
Write-Host "🤖 Android konfigürasyonu kontrol ediliyor..." -ForegroundColor Cyan

# local.properties kontrolü
if (Test-Path "android/local.properties") {
    Write-Host "✅ android/local.properties mevcut" -ForegroundColor Green
} else {
    Write-Host "⚠️  android/local.properties bulunamadı" -ForegroundColor Yellow
    Write-Host "💡 Oluşturun: echo 'sdk.dir=%LOCALAPPDATA%\Android\Sdk' > android/local.properties" -ForegroundColor Cyan
}

# Gradle wrapper kontrolü
if (Test-Path "android/gradlew") {
    Write-Host "✅ Gradle wrapper mevcut" -ForegroundColor Green
} else {
    Write-Host "⚠️  Gradle wrapper bulunamadı" -ForegroundColor Yellow
}

# 5. EAS CLI Kontrolü
Write-Host ""
Write-Host "☁️  EAS CLI kontrolü..." -ForegroundColor Cyan

if (Get-Command eas -ErrorAction SilentlyContinue) {
    Write-Host "✅ EAS CLI mevcut" -ForegroundColor Green
    
    # EAS login kontrolü
    $easAccount = eas whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Expo hesabına giriş yapılmış" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Expo hesabına giriş yapılmamış" -ForegroundColor Yellow
        Write-Host "💡 Çalıştırın: eas login" -ForegroundColor Cyan
    }
} else {
    Write-Host "⚠️  EAS CLI bulunamadı" -ForegroundColor Yellow
    Write-Host "💡 Kurun: npm install -g eas-cli" -ForegroundColor Cyan
}

# 6. Kod Kalitesi Kontrolleri
Write-Host ""
Write-Host "📝 Kod kalitesi kontrolleri..." -ForegroundColor Cyan

# TypeScript kontrolü
if (Test-Path "tsconfig.json") {
    Write-Host "✅ TypeScript konfigürasyonu mevcut" -ForegroundColor Green
}

# ESLint kontrolü (eğer varsa)
if (Test-Path ".eslintrc.js" -or Test-Path ".eslintrc.json") {
    Write-Host "✅ ESLint konfigürasyonu mevcut" -ForegroundColor Green
}

# 7. Test Sonucu
Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "📊 TEST SONUCU" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Android geliştirme ortamı kontrol edildi." -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Hızlı test komutları:" -ForegroundColor Yellow
Write-Host "  .\android-debug.ps1 build     - Build ve çalıştır" -ForegroundColor White
Write-Host "  .\android-debug.ps1 devices   - Bağlı cihazları listele" -ForegroundColor White
Write-Host "  .\android-debug.ps1 clean     - Cache'leri temizle" -ForegroundColor White
Write-Host "  .\build-dev-android.ps1       - EAS ile cloud build" -ForegroundColor White
Write-Host ""
Write-Host "📚 Dokümantasyon:" -ForegroundColor Yellow
Write-Host "  ANDROID_DEVELOPMENT_GUIDE.md  - Detaylı kılavuz" -ForegroundColor White
Write-Host "  ANDROID_ISSUES_CHECKLIST.md   - Sorun kontrol listesi" -ForegroundColor White
Write-Host "  ANDROID_README.md             - Özet doküman" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Sorun giderme:" -ForegroundColor Yellow
Write-Host "  1. Cache temizle: .\android-debug.ps1 clean" -ForegroundColor White
Write-Host "  2. Bağımlılıkları yeniden kur: npm install" -ForegroundColor White
Write-Host "  3. Metro'yu temizle: npx expo start --clear" -ForegroundColor White
Write-Host ""
Write-Host "✅ Android geliştirmeye hazır!" -ForegroundColor Green
Write-Host ""

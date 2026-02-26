# Android Geliştirme Ortamı Kurulum Scripti
# Kullanım: .\android-setup.ps1

Write-Host "=== ANDROID GELİŞTİRME ORTAMI KURULUMU ===" -ForegroundColor Green
Write-Host ""

# 1. Gereksinim Kontrolleri
Write-Host "🔍 Gereksinimler kontrol ediliyor..." -ForegroundColor Cyan

# Node.js kontrolü
Write-Host "📦 Node.js kontrolü..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "❌ Node.js bulunamadı!" -ForegroundColor Red
    Write-Host "📥 Node.js indirin: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green

# Java kontrolü
Write-Host "☕ Java kontrolü..." -ForegroundColor Yellow
$javaVersion = java -version 2>&1 | Select-String "version"
if (-not $javaVersion) {
    Write-Host "❌ Java bulunamadı!" -ForegroundColor Red
    Write-Host "📥 Java JDK 17+ indirin: https://adoptium.net/" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Java mevcut" -ForegroundColor Green

# Android SDK kontrolü
Write-Host "🤖 Android SDK kontrolü..." -ForegroundColor Yellow
$androidHome = $env:ANDROID_HOME
if (-not $androidHome) {
    $androidHome = "$env:LOCALAPPDATA\Android\Sdk"
    Write-Host "⚠️  ANDROID_HOME ortam değişkeni ayarlanmamış" -ForegroundColor Yellow
    Write-Host "📁 Varsayılan yol kullanılıyor: $androidHome" -ForegroundColor Cyan
}

if (-not (Test-Path $androidHome)) {
    Write-Host "❌ Android SDK bulunamadı!" -ForegroundColor Red
    Write-Host "📥 Android Studio indirin: https://developer.android.com/studio" -ForegroundColor Yellow
    Write-Host "💡 Kurulumdan sonra SDK Manager'dan API 34'ü kurun" -ForegroundColor Cyan
    exit 1
}
Write-Host "✅ Android SDK: $androidHome" -ForegroundColor Green

# 2. Ortam Değişkenleri Ayarlama
Write-Host ""
Write-Host "⚙️  Ortam değişkenleri ayarlanıyor..." -ForegroundColor Cyan

# JAVA_HOME ayarla
$javaHome = (Get-Command java).Source | Split-Path -Parent | Split-Path -Parent
$env:JAVA_HOME = $javaHome
Write-Host "✅ JAVA_HOME: $javaHome" -ForegroundColor Green

# ANDROID_HOME ayarla
$env:ANDROID_HOME = $androidHome

# PATH'e ekle
$androidPaths = @(
    "$androidHome\platform-tools",
    "$androidHome\tools",
    "$androidHome\tools\bin",
    "$javaHome\bin"
)

foreach ($path in $androidPaths) {
    if (-not ($env:PATH -like "*$path*")) {
        $env:PATH = "$path;$env:PATH"
    }
}

Write-Host "✅ PATH güncellendi" -ForegroundColor Green

# 3. Proje Bağımlılıkları
Write-Host ""
Write-Host "📦 Proje bağımlılıkları kuruluyor..." -ForegroundColor Cyan
cd C:\MYKBS\mobile

if (Test-Path "node_modules") {
    Write-Host "📁 node_modules mevcut, temizleniyor..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
}

Write-Host "📥 npm install çalıştırılıyor..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install başarısız!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Bağımlılıklar kuruldu" -ForegroundColor Green

# 4. Android Konfigürasyonu
Write-Host ""
Write-Host "⚙️  Android konfigürasyonu kontrol ediliyor..." -ForegroundColor Cyan

# local.properties dosyası
$localProperties = "android\local.properties"
if (-not (Test-Path $localProperties)) {
    Write-Host "📄 local.properties oluşturuluyor..." -ForegroundColor Yellow
    "sdk.dir=$androidHome" | Out-File -FilePath $localProperties -Encoding ASCII
    Write-Host "✅ local.properties oluşturuldu" -ForegroundColor Green
}

# Gradle wrapper kontrolü
if (-not (Test-Path "android\gradlew")) {
    Write-Host "⚠️  Gradle wrapper bulunamadı" -ForegroundColor Yellow
    Write-Host "📥 Gradle wrapper indiriliyor..." -ForegroundColor Cyan
    # Gradle wrapper'ı yeniden oluştur
    cd android
    gradle wrapper
    cd ..
}

# 5. Android SDK Bileşenleri Kontrolü
Write-Host ""
Write-Host "🔧 Android SDK bileşenleri kontrol ediliyor..." -ForegroundColor Cyan

$sdkManager = "$androidHome\tools\bin\sdkmanager.bat"
if (Test-Path $sdkManager) {
    Write-Host "📋 Gerekli paketler:" -ForegroundColor Yellow
    Write-Host "  - platforms;android-34" -ForegroundColor Cyan
    Write-Host "  - build-tools;34.0.0" -ForegroundColor Cyan
    Write-Host "  - platform-tools" -ForegroundColor Cyan
    Write-Host "  - emulator" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 Eksik paketleri SDK Manager'dan kurun" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  sdkmanager bulunamadı" -ForegroundColor Yellow
}

# 6. EAS CLI Kurulumu
Write-Host ""
Write-Host "☁️  EAS CLI kontrolü..." -ForegroundColor Cyan
if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
    Write-Host "📦 EAS CLI kuruluyor..." -ForegroundColor Yellow
    npm install -g eas-cli
    Write-Host "✅ EAS CLI kuruldu" -ForegroundColor Green
} else {
    Write-Host "✅ EAS CLI mevcut" -ForegroundColor Green
}

# 7. Test Build
Write-Host ""
Write-Host "🚀 Test build başlatılıyor..." -ForegroundColor Green
Write-Host "💡 Bu işlem birkaç dakika sürebilir..." -ForegroundColor Yellow
Write-Host ""

# Metro server'ı arka planda başlat
Write-Host "🌐 Metro server başlatılıyor..." -ForegroundColor Cyan
Start-Process -NoNewWindow -FilePath "powershell" -ArgumentList "-Command `"cd C:\MYKBS\mobile; npx expo start --clear`""

# Bekle
Start-Sleep -Seconds 5

# Android build başlat
Write-Host "🤖 Android build başlatılıyor..." -ForegroundColor Cyan
try {
    npx expo run:android
} catch {
    Write-Host "⚠️  Build sırasında hata oluştu" -ForegroundColor Yellow
    Write-Host "💡 Manuel olarak deneyin: npx expo run:android" -ForegroundColor Cyan
}

# 8. Kurulum Tamamlandı
Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "✅ ANDROID GELİŞTİRME ORTAMI HAZIR!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Kullanılabilir komutlar:" -ForegroundColor Cyan
Write-Host "  npx expo run:android      - Android emulator'da çalıştır" -ForegroundColor Yellow
Write-Host "  npx expo start --clear    - Metro server'ı temizleyerek başlat" -ForegroundColor Yellow
Write-Host "  .\build-dev-android.ps1   - EAS ile cloud build" -ForegroundColor Yellow
Write-Host "  adb devices               - Bağlı cihazları listele" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔧 Sorun giderme:" -ForegroundColor Cyan
Write-Host "  - Emulator açık değilse Android Studio'dan açın" -ForegroundColor Yellow
Write-Host "  - USB debugging aktif değilse cihazda açın" -ForegroundColor Yellow
Write-Host "  - Cache temizlemek için: cd android && ./gradlew clean" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎯 Sonraki adımlar:" -ForegroundColor Cyan
Write-Host "  1. Android Studio'yu kurun" -ForegroundColor Yellow
Write-Host "  2. SDK Manager'dan API 34'ü kurun" -ForegroundColor Yellow
Write-Host "  3. Emulator oluşturun (Pixel 6 API 34)" -ForegroundColor Yellow
Write-Host "  4. Uygulamayı test edin" -ForegroundColor Yellow
Write-Host ""

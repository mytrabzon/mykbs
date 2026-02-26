# Android Debug ve Test Scripti
# Kullanım: .\android-debug.ps1 [komut]
# Komutlar: build, log, devices, clean, test, emulator

param(
    [string]$Command = "help"
)

function Show-Help {
    Write-Host "=== ANDROID DEBUG VE TEST SCRIPTİ ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Kullanım: .\android-debug.ps1 [komut]" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Komutlar:" -ForegroundColor Yellow
    Write-Host "  build     - Android uygulamasını build et ve çalıştır" -ForegroundColor White
    Write-Host "  log       - Android log'larını göster (React Native filtresi)" -ForegroundColor White
    Write-Host "  devices   - Bağlı cihazları listele" -ForegroundColor White
    Write-Host "  clean     - Cache'leri temizle" -ForegroundColor White
    Write-Host "  test      - Test modunda başlat" -ForegroundColor White
    Write-Host "  emulator  - Emulator başlat" -ForegroundColor White
    Write-Host "  help      - Bu yardım mesajını göster" -ForegroundColor White
    Write-Host ""
}

function Start-Build {
    Write-Host "🚀 Android build başlatılıyor..." -ForegroundColor Green
    Write-Host ""
    
    # Metro server'ı arka planda başlat
    Write-Host "🌐 Metro server başlatılıyor..." -ForegroundColor Cyan
    $metroProcess = Start-Process -NoNewWindow -PassThru -FilePath "powershell" `
        -ArgumentList "-Command `"cd C:\MYKBS\mobile; npx expo start --clear`""
    
    # Metro'un başlaması için bekle
    Write-Host "⏳ Metro başlatılıyor (5 saniye)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Android build başlat
    Write-Host "🤖 Android build başlatılıyor..." -ForegroundColor Cyan
    Write-Host "💡 Bu işlem birkaç dakika sürebilir..." -ForegroundColor Yellow
    Write-Host ""
    
    cd C:\MYKBS\mobile
    npx expo run:android
    
    # Build tamamlandıktan sonra Metro'yu kapat
    Write-Host ""
    Write-Host "🛑 Metro server kapatılıyor..." -ForegroundColor Yellow
    Stop-Process -Id $metroProcess.Id -Force -ErrorAction SilentlyContinue
}

function Show-Logs {
    Write-Host "📋 Android log'ları gösteriliyor..." -ForegroundColor Green
    Write-Host "🔍 React Native log'ları filtreleniyor..." -ForegroundColor Cyan
    Write-Host "🛑 Durdurmak için Ctrl+C" -ForegroundColor Yellow
    Write-Host ""
    
    # React Native log'larını göster
    adb logcat *:S ReactNative:V ReactNativeJS:V
}

function Show-Devices {
    Write-Host "📱 Bağlı cihazlar listeleniyor..." -ForegroundColor Green
    Write-Host ""
    
    adb devices
}

function Clean-Cache {
    Write-Host "🧹 Cache temizleniyor..." -ForegroundColor Green
    Write-Host ""
    
    cd C:\MYKBS\mobile
    
    # Android cache
    Write-Host "🤖 Android cache temizleniyor..." -ForegroundColor Cyan
    cd android
    .\gradlew clean
    cd ..
    
    # Metro cache
    Write-Host "🌐 Metro cache temizleniyor..." -ForegroundColor Cyan
    npx expo start --clear --force-cache 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    
    # Node modules (opsiyonel)
    Write-Host ""
    $choice = Read-Host "❓ node_modules'i de temizlemek istiyor musunuz? (e/h)"
    if ($choice -eq 'e' -or $choice -eq 'E') {
        Write-Host "📦 node_modules temizleniyor..." -ForegroundColor Cyan
        Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
        Write-Host "📥 Bağımlılıklar yeniden kuruluyor..." -ForegroundColor Cyan
        npm install
    }
    
    Write-Host ""
    Write-Host "✅ Cache temizlendi!" -ForegroundColor Green
}

function Start-Test {
    Write-Host "🧪 Test modunda başlatılıyor..." -ForegroundColor Green
    Write-Host ""
    
    # Environment variables ayarla
    $env:NODE_ENV = "test"
    $env:EXPO_PUBLIC_TEST_MODE = "true"
    
    Write-Host "🔧 Test ortam değişkenleri ayarlandı:" -ForegroundColor Cyan
    Write-Host "  NODE_ENV: $env:NODE_ENV" -ForegroundColor Yellow
    Write-Host "  EXPO_PUBLIC_TEST_MODE: $env:EXPO_PUBLIC_TEST_MODE" -ForegroundColor Yellow
    Write-Host ""
    
    # Metro'yu test modunda başlat
    Write-Host "🌐 Test modunda Metro başlatılıyor..." -ForegroundColor Cyan
    cd C:\MYKBS\mobile
    npx expo start --clear --dev-client
}

function Start-Emulator {
    Write-Host "📱 Emulator başlatılıyor..." -ForegroundColor Green
    Write-Host ""
    
    # Mevcut emulator'ları listele
    Write-Host "📋 Mevcut emulator'lar:" -ForegroundColor Cyan
    emulator -list-avds
    Write-Host ""
    
    # Emulator seç
    $avdName = Read-Host "🔤 Başlatmak istediğiniz emulator adını girin (boş bırakırsanız ilkini seçer)"
    
    if ([string]::IsNullOrWhiteSpace($avdName)) {
        # İlk emulator'ı al
        $avds = emulator -list-avds
        if ($avds) {
            $avdName = $avds[0]
            Write-Host "🤖 İlk emulator seçildi: $avdName" -ForegroundColor Yellow
        } else {
            Write-Host "❌ Hiç emulator bulunamadı!" -ForegroundColor Red
            Write-Host "💡 Android Studio'dan emulator oluşturun" -ForegroundColor Yellow
            exit 1
        }
    }
    
    # Emulator'ı başlat
    Write-Host "🚀 Emulator başlatılıyor: $avdName" -ForegroundColor Cyan
    Write-Host "💡 Bu işlem birkaç dakika sürebilir..." -ForegroundColor Yellow
    Write-Host ""
    
    Start-Process -NoNewWindow -FilePath "emulator" -ArgumentList "-avd $avdName"
    
    # Emulator'ın başlamasını bekle
    Write-Host "⏳ Emulator başlatılıyor (30 saniye)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    # Cihazları kontrol et
    Write-Host ""
    Show-Devices
}

# Ana script
cd C:\MYKBS\mobile

switch ($Command.ToLower()) {
    "build" {
        Start-Build
    }
    "log" {
        Show-Logs
    }
    "devices" {
        Show-Devices
    }
    "clean" {
        Clean-Cache
    }
    "test" {
        Start-Test
    }
    "emulator" {
        Start-Emulator
    }
    "help" {
        Show-Help
    }
    default {
        Write-Host "❌ Geçersiz komut: $Command" -ForegroundColor Red
        Write-Host ""
        Show-Help
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "✅ İşlem tamamlandı!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

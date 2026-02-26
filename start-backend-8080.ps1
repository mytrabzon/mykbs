# Backend Başlatma Scripti - Port 8080 için
# Kökten çözüm: Hata kontrolü, bağımlılık kontrolü ve otomatik düzeltme

Write-Host "=== BACKEND BAŞLATILIYOR (PORT 8080) ===" -ForegroundColor Green
Write-Host ""

$backendPath = "C:\MYKBS\backend"
if (-not (Test-Path $backendPath)) {
    Write-Host "❌ Backend klasörü bulunamadı: $backendPath" -ForegroundColor Red
    pause
    exit 1
}

cd $backendPath

# Node.js kontrolü
Write-Host "🔍 Node.js kontrol ediliyor..." -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js bulunamadı!" -ForegroundColor Red
    Write-Host "💡 Node.js'i yükleyin: https://nodejs.org/" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ Node.js: $(node --version)" -ForegroundColor Green

# node_modules kontrolü
Write-Host "🔍 Bağımlılıklar kontrol ediliyor..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules bulunamadı! Yükleniyor..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm install başarısız!" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "✅ Bağımlılıklar yüklendi" -ForegroundColor Green
} else {
    Write-Host "✅ Bağımlılıklar mevcut" -ForegroundColor Green
}

# Prisma kontrolü
Write-Host "🔍 Prisma kontrol ediliyor..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules\.prisma")) {
    Write-Host "⚠️  Prisma client oluşturulmamış! Oluşturuluyor..." -ForegroundColor Yellow
    npm run generate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Prisma generate başarısız!" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "✅ Prisma client oluşturuldu" -ForegroundColor Green
}

# Port 8080'ı kullanan process'leri temizle
Write-Host "🔧 Port 8080 temizleniyor..." -ForegroundColor Yellow
$processes = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Select-Object -Unique OwningProcess
if ($processes) {
    foreach ($proc in $processes) {
        if ($proc.OwningProcess) {
            try {
                $procName = (Get-Process -Id $proc.OwningProcess -ErrorAction SilentlyContinue).ProcessName
                Write-Host "   ⚠️  PID $($proc.OwningProcess) ($procName) durduruluyor..." -ForegroundColor Yellow
                Stop-Process -Id $proc.OwningProcess -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
                Write-Host "   ✅ PID $($proc.OwningProcess) durduruldu" -ForegroundColor Green
            } catch {
                Write-Host "   ⚠️  PID $($proc.OwningProcess) durdurulamadı (zaten kapanmış olabilir)" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "   ✅ Port 8080 boş" -ForegroundColor Green
}

# Kısa bir bekleme
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "🚀 Backend başlatılıyor..." -ForegroundColor Green
Write-Host "📋 Backend URL: http://localhost:8080" -ForegroundColor Cyan
Write-Host "📋 API Base URL: http://localhost:8080/api" -ForegroundColor Cyan
Write-Host "📋 Health Check: http://localhost:8080/health" -ForegroundColor Cyan
Write-Host "📋 Mobile URL (Emulator): http://10.0.2.2:8080/api" -ForegroundColor Cyan
Write-Host "📋 Mobile URL (Fiziksel): http://192.168.4.105:8080/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Durdurmak için: Ctrl+C" -ForegroundColor Yellow
Write-Host ""

# Backend'i başlat
try {
    node src/server.js
} catch {
    Write-Host ""
    Write-Host "❌ Backend başlatılamadı!" -ForegroundColor Red
    Write-Host "Hata: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 Kontrol edin:" -ForegroundColor Yellow
    Write-Host "   1. src/server.js dosyası var mı?" -ForegroundColor White
    Write-Host "   2. Tüm bağımlılıklar yüklü mü? (npm install)" -ForegroundColor White
    Write-Host "   3. Prisma client oluşturuldu mu? (npm run generate)" -ForegroundColor White
    Write-Host "   4. Veritabanı hazır mı? (npm run migrate)" -ForegroundColor White
    Write-Host ""
    pause
    exit 1
}

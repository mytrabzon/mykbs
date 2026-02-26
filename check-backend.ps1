# Backend Durum Kontrol Scripti
Write-Host "=== BACKEND DURUM KONTROLÜ ===" -ForegroundColor Cyan
Write-Host ""

# 1. Port 8080 kontrolü
Write-Host "1. Port 8080 Kontrolü:" -ForegroundColor Yellow
$port8080 = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($port8080) {
    Write-Host "   ✅ Port 8080 dinleniyor" -ForegroundColor Green
    $port8080 | ForEach-Object {
        Write-Host "      - LocalAddress: $($_.LocalAddress)" -ForegroundColor White
        Write-Host "      - State: $($_.State)" -ForegroundColor White
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "      - Process: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor White
        }
    }
} else {
    Write-Host "   ❌ Port 8080 dinlenmiyor!" -ForegroundColor Red
    Write-Host "   → Backend başlatın: .\start-backend-8080.ps1" -ForegroundColor Yellow
}

Write-Host ""

# 2. Health Check
Write-Host "2. Health Check:" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend çalışıyor!" -ForegroundColor Green
        Write-Host "      Response: $($response.Content)" -ForegroundColor White
    } else {
        Write-Host "   ⚠️  Backend yanıt verdi ama status code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Backend'e erişilemiyor!" -ForegroundColor Red
    Write-Host "      Hata: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   → Backend başlatın: .\start-backend-8080.ps1" -ForegroundColor Yellow
}

Write-Host ""

# 3. Backend klasörü kontrolü
Write-Host "3. Backend Klasörü:" -ForegroundColor Yellow
$backendPath = "C:\MYKBS\backend"
if (Test-Path $backendPath) {
    Write-Host "   ✅ Backend klasörü mevcut" -ForegroundColor Green
    
    # node_modules kontrolü
    if (Test-Path "$backendPath\node_modules") {
        Write-Host "   ✅ node_modules mevcut" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  node_modules eksik! Yükleniyor..." -ForegroundColor Yellow
        Set-Location $backendPath
        npm install
    }
    
    # server.js kontrolü
    if (Test-Path "$backendPath\src\server.js") {
        Write-Host "   ✅ server.js mevcut" -ForegroundColor Green
    } else {
        Write-Host "   ❌ server.js bulunamadı!" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Backend klasörü bulunamadı: $backendPath" -ForegroundColor Red
}

Write-Host ""

# 4. Node.js kontrolü
Write-Host "4. Node.js:" -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js kurulu: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "   ❌ Node.js bulunamadı!" -ForegroundColor Red
    Write-Host "   → Yükleyin: https://nodejs.org/" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== KONTROL TAMAMLANDI ===" -ForegroundColor Cyan


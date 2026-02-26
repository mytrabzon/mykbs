# Expo Development Mode Başlatma Scripti

Write-Host "🚀 Expo Development Mode Başlatılıyor..." -ForegroundColor Green

# Environment variable ayarla
$env:NODE_ENV = "development"
$env:EXPO_PUBLIC_ENV = "development"

# Mevcut process'leri durdur
Write-Host "📤 Mevcut process'ler kontrol ediliyor..." -ForegroundColor Yellow
$expoProcesses = Get-Process | Where-Object {
    $_.ProcessName -eq "node"
} -ErrorAction SilentlyContinue | Where-Object {
    try {
        $_.CommandLine -like "*expo*"
    } catch {
        $false
    }
}

if ($expoProcesses) {
    Write-Host "⚠️  Mevcut Expo process'leri durduruluyor..." -ForegroundColor Yellow
    $expoProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Port kontrolü ve temizleme
$port = 8081
$portInUse = netstat -ano | findstr ":$port"

if ($portInUse) {
    Write-Host "⚠️  Port $port kullanılıyor, temizleniyor..." -ForegroundColor Yellow
    $pid = ($portInUse -split '\s+')[-1]
    if ($pid) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# .env dosyasını yükle
if (Test-Path ".env") {
    Write-Host "📝 Environment variables yükleniyor..." -ForegroundColor Cyan
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
    }
}

Write-Host ""
Write-Host "🎯 Expo Development Server başlatılıyor..." -ForegroundColor Cyan
Write-Host "   Mode: Development" -ForegroundColor Yellow
Write-Host "   Port: $port" -ForegroundColor Yellow
Write-Host ""

# Development modunda başlat
npx expo start --dev-client --clear


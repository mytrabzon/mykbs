# Expo Başlatma Scripti

Write-Host "🚀 Expo Başlatılıyor..." -ForegroundColor Green

# Mevcut Expo process'lerini durdur
Write-Host "📤 Mevcut process'ler kontrol ediliyor..." -ForegroundColor Yellow
$expoProcesses = Get-Process | Where-Object {
    $_.ProcessName -eq "node" -and 
    ($_.CommandLine -like "*expo*" -or $_.Path -like "*expo*")
} -ErrorAction SilentlyContinue

if ($expoProcesses) {
    Write-Host "⚠️  Mevcut Expo process'leri durduruluyor..." -ForegroundColor Yellow
    $expoProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Port kontrolü
$port = 8081
$portInUse = netstat -ano | findstr ":$port"

if ($portInUse) {
    Write-Host "⚠️  Port $port kullanılıyor, 8083 kullanılacak" -ForegroundColor Yellow
    $port = 8083
}

# Expo başlat
Write-Host ""
Write-Host "🎯 Expo Development Server başlatılıyor (Port: $port)..." -ForegroundColor Cyan
Write-Host ""

npx expo start --clear --port $port


# Expo Test Scripti

Write-Host "=== EXPO TEST SCRIPTI ===" -ForegroundColor Cyan
Write-Host ""

# Dizin kontrolü
Write-Host "1. Dizin kontrolü..." -ForegroundColor Yellow
$currentDir = Get-Location
if ($currentDir.Path -notlike "*mobile*") {
    Write-Host "   ⚠️  Yanlış dizin! mobile klasörüne gidin:" -ForegroundColor Red
    Write-Host "   cd C:\MYKBS\mobile" -ForegroundColor White
    exit 1
}
Write-Host "   ✅ Doğru dizin: $currentDir" -ForegroundColor Green

# package.json kontrolü
Write-Host "`n2. package.json kontrolü..." -ForegroundColor Yellow
if (-not (Test-Path "package.json")) {
    Write-Host "   ❌ package.json bulunamadı!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ package.json bulundu" -ForegroundColor Green

# node_modules kontrolü
Write-Host "`n3. node_modules kontrolü..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "   ❌ node_modules bulunamadı! npm install çalıştırın" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "node_modules/expo")) {
    Write-Host "   ❌ Expo yüklü değil! npm install çalıştırın" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ node_modules ve Expo yüklü" -ForegroundColor Green

# .env kontrolü
Write-Host "`n4. .env dosyası kontrolü..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "   ⚠️  .env dosyası yok, oluşturuluyor..." -ForegroundColor Yellow
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -like "192.168.*"
    } | Select-Object -First 1).IPAddress
    
    @"
# API Configuration
EXPO_PUBLIC_API_URL=http://$ip:3000/api

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
"@ | Out-File -FilePath ".env" -Encoding utf8
    Write-Host "   ✅ .env dosyası oluşturuldu" -ForegroundColor Green
} else {
    Write-Host "   ✅ .env dosyası var" -ForegroundColor Green
}

# Port kontrolü
Write-Host "`n5. Port kontrolü..." -ForegroundColor Yellow
$port8081 = netstat -ano | findstr ":8081.*LISTENING"
if ($port8081) {
    Write-Host "   ⚠️  Port 8081 kullanılıyor, temizleniyor..." -ForegroundColor Yellow
    $pid = ($port8081 -split '\s+')[-1]
    if ($pid) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

# Expo başlat
Write-Host "`n=== EXPO BAŞLATILIYOR ===" -ForegroundColor Green
Write-Host "Komut: npx expo start --clear" -ForegroundColor Cyan
Write-Host ""

npx expo start --clear


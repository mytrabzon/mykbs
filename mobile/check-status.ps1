# Expo ve Backend Durum Kontrolü

Write-Host "`n=== MYKBS DURUM KONTROLÜ ===" -ForegroundColor Cyan
Write-Host ""

# 1. IP Adresi
Write-Host "1. IP Adresi:" -ForegroundColor Yellow
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -like "192.168.*" -or 
    $_.IPAddress -like "10.*"
} | Select-Object -First 1).IPAddress

if ($ip) {
    Write-Host "   IP: $ip" -ForegroundColor Green
} else {
    Write-Host "   IP bulunamadı!" -ForegroundColor Red
}

# 2. Backend Kontrolü
Write-Host "`n2. Backend Server (Port 3000):" -ForegroundColor Yellow
$backend = netstat -ano | findstr ":3000.*LISTENING"
if ($backend) {
    Write-Host "   ✅ Backend ÇALIŞIYOR" -ForegroundColor Green
} else {
    Write-Host "   ❌ Backend ÇALIŞMIYOR!" -ForegroundColor Red
    Write-Host "   → Çözüm: Yeni terminal açın ve çalıştırın:" -ForegroundColor Yellow
    Write-Host "     cd C:\MYKBS\backend" -ForegroundColor White
    Write-Host "     npm run dev" -ForegroundColor White
}

# 3. Expo Kontrolü
Write-Host "`n3. Expo Server (Port 8081):" -ForegroundColor Yellow
$expo = netstat -ano | findstr ":8081.*LISTENING"
if ($expo) {
    Write-Host "   ✅ Expo ÇALIŞIYOR" -ForegroundColor Green
} else {
    Write-Host "   ❌ Expo ÇALIŞMIYOR!" -ForegroundColor Red
    Write-Host "   → Çözüm: Şu komutu çalıştırın:" -ForegroundColor Yellow
    Write-Host "     npx expo start --clear" -ForegroundColor White
}

# 4. .env Kontrolü
Write-Host "`n4. Environment Variables:" -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "192\.168\.\d+\.\d+") {
        Write-Host "   ✅ IP adresi ayarlı" -ForegroundColor Green
        $match = [regex]::Match($envContent, "http://(\d+\.\d+\.\d+\.\d+):3000")
        if ($match.Success) {
            Write-Host "   API URL: $($match.Value)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   ⚠️  localhost kullanılıyor - Telefon erişemez!" -ForegroundColor Red
        Write-Host "   → .env dosyasını güncelleyin: EXPO_PUBLIC_API_URL=http://$ip:3000/api" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ .env dosyası yok!" -ForegroundColor Red
    Write-Host "   → Oluşturuluyor..." -ForegroundColor Yellow
    @"
# API Configuration
EXPO_PUBLIC_API_URL=http://$ip:3000/api

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
"@ | Out-File -FilePath ".env" -Encoding utf8
    Write-Host "   ✅ .env dosyası oluşturuldu" -ForegroundColor Green
}

Write-Host "`n=== ÖNERİLER ===" -ForegroundColor Green
Write-Host "1. Backend başlat (YENİ TERMINAL): cd ..\backend && npm run dev" -ForegroundColor White
Write-Host "2. Expo başlat: npx expo start --clear" -ForegroundColor White
Write-Host "3. Telefon ve bilgisayar AYNI WiFi'de olmalı" -ForegroundColor White
Write-Host "4. QR kodu tarayın" -ForegroundColor White
Write-Host ""


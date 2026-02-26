# Bilgisayarın IP adresini bul ve .env dosyasını güncelle

Write-Host "🔍 IP Adresi Bulunuyor..." -ForegroundColor Green
Write-Host ""

# IPv4 adresini bul
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -like "192.168.*" -or 
    $_.IPAddress -like "10.*" -or 
    $_.IPAddress -like "172.16.*"
} | Select-Object -First 1).IPAddress

if ($ipAddress) {
    Write-Host "✅ IP Adresi Bulundu: $ipAddress" -ForegroundColor Green
    Write-Host ""
    
    # .env dosyasını güncelle
    $envFile = ".env"
    $apiUrl = "http://$ipAddress:3000/api"
    
    if (Test-Path $envFile) {
        $content = Get-Content $envFile
        $updated = $false
        
        $newContent = $content | ForEach-Object {
            if ($_ -match "^EXPO_PUBLIC_API_URL=") {
                $updated = $true
                "EXPO_PUBLIC_API_URL=$apiUrl"
            } else {
                $_
            }
        }
        
        if (-not $updated) {
            $newContent += "EXPO_PUBLIC_API_URL=$apiUrl"
        }
        
        $newContent | Set-Content $envFile
        Write-Host "✅ .env dosyası güncellendi" -ForegroundColor Green
        Write-Host "   API URL: $apiUrl" -ForegroundColor Cyan
    } else {
        Write-Host "📝 .env dosyası oluşturuluyor..." -ForegroundColor Yellow
        $envContent = @"
# API Configuration
EXPO_PUBLIC_API_URL=$apiUrl

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xzlZ7XfGyx9CfBaQyLWgKw_ic_v5K1J
"@
        $envContent | Out-File -FilePath $envFile -Encoding utf8
        Write-Host "✅ .env dosyası oluşturuldu" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "🚀 Şimdi yapmanız gerekenler:" -ForegroundColor Yellow
    Write-Host "1. Backend server'ı başlatın: cd ..\backend && npm run dev" -ForegroundColor White
    Write-Host "2. Expo'yu yeniden başlatın: npm start" -ForegroundColor White
    Write-Host "3. Telefon ve bilgisayar aynı WiFi ağında olmalı" -ForegroundColor White
} else {
    Write-Host "❌ IP adresi bulunamadı!" -ForegroundColor Red
    Write-Host "Manuel olarak ipconfig komutu ile bulun:" -ForegroundColor Yellow
    Write-Host "   ipconfig" -ForegroundColor White
}


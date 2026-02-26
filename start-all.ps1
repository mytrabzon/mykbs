# MyKBS - Tüm Servisleri Başlatma Scripti

Write-Host "🚀 MyKBS Servisleri Başlatılıyor..." -ForegroundColor Green
Write-Host ""

# Backend'i başlat (yeni terminal)
Write-Host "1. Backend Server başlatılıyor..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\MYKBS\backend; Write-Host 'Backend Server Başlatılıyor...' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 3

# Expo'yu başlat
Write-Host "2. Expo Development Server başlatılıyor..." -ForegroundColor Cyan
Set-Location C:\MYKBS\mobile
npx expo start --clear


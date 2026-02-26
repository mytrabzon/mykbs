# IP Kısıtlamasını Devre Dışı Bırakma Scripti
Write-Host "=== IP KISITLAMASI DEVRE DIŞI BIRAKILIYOR ===" -ForegroundColor Yellow
Write-Host ""

cd C:\MYKBS\backend

Write-Host "🔧 IP kısıtlaması kapatılıyor..." -ForegroundColor Cyan
Write-Host ""

# Script'i çalıştır
node scripts/disable-ip-restriction.js

Write-Host ""
Write-Host "Islem tamamlandi!" -ForegroundColor Green
Write-Host ""
Write-Host "Artik IP kisitlamasi aktif degil." -ForegroundColor Cyan
Write-Host "KBS servisleri IP kontrolu yapmayacak." -ForegroundColor Cyan
Write-Host ""

pause


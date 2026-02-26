# Backend Başlatma Script
Write-Host "=== BACKEND BAŞLATILIYOR ===" -ForegroundColor Green
Write-Host ""

cd backend

Write-Host "📦 Bağımlılıklar kontrol ediliyor..." -ForegroundColor Cyan
if (!(Test-Path "node_modules")) {
    Write-Host "⚠️ node_modules bulunamadı, npm install çalıştırılıyor..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "🚀 Backend başlatılıyor..." -ForegroundColor Cyan
Write-Host "   Port: 3000" -ForegroundColor White
Write-Host "   URL: http://localhost:3000" -ForegroundColor White
Write-Host "   API: http://localhost:3000/api" -ForegroundColor White
Write-Host ""

npm run dev


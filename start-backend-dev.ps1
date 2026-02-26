# Backend Başlatma Scripti
Write-Host "=== BACKEND BAŞLATILIYOR ===" -ForegroundColor Green
Write-Host ""

cd C:\MYKBS\backend

# .env dosyası kontrolü
if (-not (Test-Path .env)) {
    Write-Host "⚠️  .env dosyası bulunamadı!" -ForegroundColor Yellow
    Write-Host "📋 DATABASE_URL ayarlanmalı" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "🔍 Node.js ve npm kontrol ediliyor..." -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js bulunamadı!" -ForegroundColor Red
    Write-Host "💡 Node.js'i yükleyin: https://nodejs.org/" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ Node.js: $(node --version)" -ForegroundColor Green
Write-Host "✅ npm: $(npm --version)" -ForegroundColor Green
Write-Host ""

# Dependencies kontrolü
if (-not (Test-Path node_modules)) {
    Write-Host "📦 Dependencies yükleniyor..." -ForegroundColor Cyan
    npm install
    Write-Host ""
}

Write-Host "🚀 Backend başlatılıyor..." -ForegroundColor Green
Write-Host "📋 Backend URL: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📋 API Base URL: http://localhost:3000/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Durdurmak için: Ctrl+C" -ForegroundColor Yellow
Write-Host ""

# Backend'i başlat
npm run dev


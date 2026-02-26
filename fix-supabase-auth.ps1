# Supabase Yetkilendirme ve Deploy Script
# Bu script Supabase'e login olur, projeyi link eder ve Edge Function deploy eder

Write-Host "=== SUPABASE YETKİLENDİRME VE DEPLOY ===" -ForegroundColor Green
Write-Host ""

# 1. Login
Write-Host "1. Supabase'e login yapılıyor..." -ForegroundColor Yellow
Write-Host "   (Tarayıcı açılacak, lütfen login yapın)" -ForegroundColor Cyan
supabase login

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Login başarısız!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Login başarılı!" -ForegroundColor Green
Write-Host ""

# 2. Projeyi link et
Write-Host "2. Proje linkleniyor..." -ForegroundColor Yellow
Write-Host "   Project ID: iuxnpxszfvyrdifchwvr" -ForegroundColor Cyan
supabase link --project-ref iuxnpxszfvyrdifchwvr

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Proje linklenemedi!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Proje linklendi!" -ForegroundColor Green
Write-Host ""

# 3. Edge Function deploy et
Write-Host "3. Edge Function deploy ediliyor..." -ForegroundColor Yellow
supabase functions deploy trpc

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deploy başarısız!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Tüm işlemler tamamlandı!" -ForegroundColor Green
Write-Host ""


# Supabase Doğru Hesap ile Login ve Deploy Script
# Bu script doğru hesap ile login yapar ve projeyi link eder

Write-Host "=== SUPABASE DOĞRU HESAP İLE LOGIN ===" -ForegroundColor Green
Write-Host ""

# Önce logout yap
Write-Host "1. Mevcut oturum sonlandırılıyor..." -ForegroundColor Yellow
Write-Host "   (Y tuşuna basın)" -ForegroundColor Cyan
echo y | supabase logout

Write-Host ""
Write-Host "2. Doğru hesap ile login yapılıyor..." -ForegroundColor Yellow
Write-Host "   Email: developerlitxtech@gmail.com" -ForegroundColor Cyan
Write-Host "   Proje: iuxnpxszfvyrdifchwvr" -ForegroundColor Cyan
Write-Host "   (Tarayıcı açılacak, doğru hesap ile login yapın)" -ForegroundColor Cyan
Write-Host ""
supabase login

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Login başarısız!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Login başarılı!" -ForegroundColor Green
Write-Host ""

# Projeyi link et
Write-Host "3. Proje linkleniyor..." -ForegroundColor Yellow
Write-Host "   Project ID: iuxnpxszfvyrdifchwvr" -ForegroundColor Cyan
supabase link --project-ref iuxnpxszfvyrdifchwvr

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Proje linklenemedi!" -ForegroundColor Red
    Write-Host "`n💡 Alternatif: Access token kullanabilirsiniz:" -ForegroundColor Yellow
    Write-Host "   supabase link --password <access-token>" -ForegroundColor White
    Write-Host "   (Access token'ı Supabase Dashboard'dan alabilirsiniz)" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Proje linklendi!" -ForegroundColor Green
Write-Host ""

# Edge Function deploy et
Write-Host "4. Edge Function deploy ediliyor..." -ForegroundColor Yellow
supabase functions deploy trpc

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deploy başarısız!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Tüm işlemler tamamlandı!" -ForegroundColor Green
Write-Host ""


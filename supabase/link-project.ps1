# MyKBS Projesine Bağlanma Scripti
# Proje: iuxnpxszfvyrdifchwvr (developerlitxtech@gmail.com's Project)

Write-Host "🔗 MyKBS Projesine Bağlanılıyor..." -ForegroundColor Green
Write-Host "Proje Ref: iuxnpxszfvyrdifchwvr" -ForegroundColor Cyan
Write-Host ""

# Supabase klasörüne git
Set-Location supabase

# Önce logout yap (eğer yanlış hesaba bağlıysa)
Write-Host "📤 Mevcut bağlantı kontrol ediliyor..." -ForegroundColor Yellow
$currentLink = supabase status 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "⚠️  Mevcut bağlantı var. Kaldırılıyor..." -ForegroundColor Yellow
    supabase unlink
}

# Doğru projeye bağlan
Write-Host ""
Write-Host "🔗 Projeye bağlanılıyor: iuxnpxszfvyrdifchwvr" -ForegroundColor Cyan
Write-Host "Not: Eğer hesap farklıysa, önce doğru hesaba login olun:" -ForegroundColor Yellow
Write-Host "   supabase login" -ForegroundColor White
Write-Host ""

# Direkt link dene
supabase link --project-ref iuxnpxszfvyrdifchwvr

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Bağlantı başarılı!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Proje Durumu:" -ForegroundColor Cyan
    supabase status
} else {
    Write-Host ""
    Write-Host "❌ Bağlantı başarısız!" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Çözüm Önerileri:" -ForegroundColor Yellow
    Write-Host "1. Doğru hesaba login olun:" -ForegroundColor White
    Write-Host "   supabase logout" -ForegroundColor Gray
    Write-Host "   supabase login" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Access Token ile bağlanın:" -ForegroundColor White
    Write-Host "   Supabase Dashboard → Settings → Access Tokens" -ForegroundColor Gray
    Write-Host "   supabase link --project-ref iuxnpxszfvyrdifchwvr --password <token>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Projeleri kontrol edin:" -ForegroundColor White
    Write-Host "   supabase projects list" -ForegroundColor Gray
}

Set-Location ..


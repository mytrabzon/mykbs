# MyKBS Supabase Edge Function Deploy Script
# Bu script doğru projeye bağlanıp deploy eder

Write-Host "🚀 MyKBS Supabase Deploy Başlatılıyor..." -ForegroundColor Green

# Supabase klasörüne git
Set-Location supabase

# Mevcut bağlantıyı kontrol et
Write-Host "`n📋 Mevcut bağlantı kontrol ediliyor..." -ForegroundColor Yellow
$status = supabase status 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Supabase bağlantısı bulunamadı. Bağlanılıyor..." -ForegroundColor Yellow
    
    # Doğru projeye bağlan
    Write-Host "`n🔗 Projeye bağlanılıyor: iuxnpxszfvyrdifchwvr" -ForegroundColor Cyan
    supabase link --project-ref iuxnpxszfvyrdifchwvr
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Bağlantı başarısız! Lütfen manuel olarak bağlanın:" -ForegroundColor Red
        Write-Host "   supabase link --project-ref iuxnpxszfvyrdifchwvr" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "✅ Supabase bağlantısı mevcut" -ForegroundColor Green
}

# Proje bilgilerini göster
Write-Host "`n📊 Proje Bilgileri:" -ForegroundColor Cyan
supabase status

# Deploy et
Write-Host "`n🚀 Edge Function deploy ediliyor..." -ForegroundColor Green
supabase functions deploy trpc --no-verify-jwt

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deploy başarılı!" -ForegroundColor Green
    Write-Host "`n🌐 Function URL:" -ForegroundColor Cyan
    Write-Host "   https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1/trpc" -ForegroundColor Yellow
} else {
    Write-Host "`n❌ Deploy başarısız!" -ForegroundColor Red
    exit 1
}

# Ana dizine dön
Set-Location ..

Write-Host "`n✨ Tamamlandı!" -ForegroundColor Green


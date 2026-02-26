#!/bin/bash
# MyKBS Supabase Edge Function Deploy Script
# Bu script doğru projeye bağlanıp deploy eder

echo "🚀 MyKBS Supabase Deploy Başlatılıyor..."

# Supabase klasörüne git
cd supabase

# Mevcut bağlantıyı kontrol et
echo ""
echo "📋 Mevcut bağlantı kontrol ediliyor..."
if ! supabase status > /dev/null 2>&1; then
    echo "⚠️  Supabase bağlantısı bulunamadı. Bağlanılıyor..."
    
    # Doğru projeye bağlan
    echo ""
    echo "🔗 Projeye bağlanılıyor: iuxnpxszfvyrdifchwvr"
    supabase link --project-ref iuxnpxszfvyrdifchwvr
    
    if [ $? -ne 0 ]; then
        echo "❌ Bağlantı başarısız! Lütfen manuel olarak bağlanın:"
        echo "   supabase link --project-ref iuxnpxszfvyrdifchwvr"
        exit 1
    fi
else
    echo "✅ Supabase bağlantısı mevcut"
fi

# Proje bilgilerini göster
echo ""
echo "📊 Proje Bilgileri:"
supabase status

# Deploy et
echo ""
echo "🚀 Edge Function deploy ediliyor..."
supabase functions deploy trpc --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deploy başarılı!"
    echo ""
    echo "🌐 Function URL:"
    echo "   https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1/trpc"
else
    echo ""
    echo "❌ Deploy başarısız!"
    exit 1
fi

# Ana dizine dön
cd ..

echo ""
echo "✨ Tamamlandı!"


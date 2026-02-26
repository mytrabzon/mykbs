// Admin Tesis Oluşturma Scripti (Supabase Client ile)
// Kullanım: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ile çalışır

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Supabase client oluştur
const supabaseUrl = process.env.SUPABASE_URL || 'https://iuxnpxszfvyrdifchwvr.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.error('❌ Hata: SUPABASE_SERVICE_ROLE_KEY bulunamadı!');
  console.error('💡 Supabase Dashboard > Settings > API > service_role key');
  console.error('💡 .env dosyasına ekleyin: SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminTesis() {
  try {
    const tesisKodu = '1';
    const telefon = '5330483061';
    const pin = '611633';

    console.log('🔍 Mevcut tesis kontrol ediliyor...');
    
    // Tesis var mı kontrol et (Supabase'de table isimleri küçük harfle)
    const { data: existingTesisData, error: findError } = await supabase
      .from('Tesis')
      .select('*')
      .eq('tesisKodu', tesisKodu)
      .maybeSingle();

    const existingTesis = existingTesisData;

    let tesis;
    if (existingTesis && !findError) {
      console.log('⚠️  Tesis zaten mevcut, güncelleniyor...');
      
      // Tesis durumunu aktif yap
      const { data: updatedTesisData, error: updateError } = await supabase
        .from('Tesis')
        .update({
          durum: 'aktif',
          paket: 'pro',
          kota: 10000
        })
        .eq('id', existingTesis.id)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }
      tesis = updatedTesisData;
      console.log('✅ Tesis güncellendi:', tesis.tesisKodu);
    } else {
      console.log('📝 Yeni tesis oluşturuluyor...');
      
      // Yeni tesis oluştur
      const { data: newTesisData, error: createError } = await supabase
        .from('Tesis')
        .insert({
          tesisKodu,
          tesisAdi: 'Admin Tesis',
          yetkiliAdSoyad: 'Admin Kullanıcı',
          telefon,
          email: 'admin@mykbs.com',
          il: 'İstanbul',
          ilce: 'Kadıköy',
          adres: 'Admin Adresi',
          odaSayisi: 10,
          tesisTuru: 'otel',
          durum: 'aktif',
          paket: 'pro',
          kota: 10000
        })
        .select()
        .single();

      if (createError) {
        console.error('Create error:', createError);
        throw createError;
      }
      tesis = newTesisData;
      console.log('✅ Tesis oluşturuldu:', tesis.tesisKodu);
    }

    // PIN hash'le
    const hashedPin = await bcrypt.hash(pin, 10);
    console.log('🔐 PIN hash\'lendi');

    // Kullanıcı var mı kontrol et
    const { data: existingKullaniciData, error: kullaniciFindError } = await supabase
      .from('Kullanici')
      .select('*')
      .eq('tesisId', tesis.id)
      .eq('telefon', telefon)
      .maybeSingle();

    const existingKullanici = existingKullaniciData;

    let kullanici;
    if (existingKullanici && !kullaniciFindError) {
      console.log('⚠️  Kullanıcı zaten mevcut, admin yetkisi veriliyor...');
      
      // Kullanıcıyı admin (sahip) yap
      const { data: updatedKullaniciData, error: kullaniciUpdateError } = await supabase
        .from('Kullanici')
        .update({
          rol: 'sahip',
          pin: hashedPin,
          checkInYetki: true,
          odaDegistirmeYetki: true,
          bilgiDuzenlemeYetki: true
        })
        .eq('id', existingKullanici.id)
        .select()
        .single();

      if (kullaniciUpdateError) {
        console.error('Kullanici update error:', kullaniciUpdateError);
        throw kullaniciUpdateError;
      }
      kullanici = updatedKullaniciData;
      console.log('✅ Kullanıcı admin yapıldı');
    } else {
      console.log('📝 Yeni admin kullanıcı oluşturuluyor...');
      
      // Yeni admin kullanıcı oluştur
      const { data: newKullaniciData, error: kullaniciCreateError } = await supabase
        .from('Kullanici')
        .insert({
          tesisId: tesis.id,
          adSoyad: 'Admin Kullanıcı',
          telefon,
          email: 'admin@mykbs.com',
          pin: hashedPin,
          rol: 'sahip', // Admin rolü
          checkInYetki: true,
          odaDegistirmeYetki: true,
          bilgiDuzenlemeYetki: true
        })
        .select()
        .single();

      if (kullaniciCreateError) {
        console.error('Kullanici create error:', kullaniciCreateError);
        throw kullaniciCreateError;
      }
      kullanici = newKullaniciData;
      console.log('✅ Admin kullanıcı oluşturuldu');
    }

    console.log('\n✅ İşlem tamamlandı!');
    console.log('\n📋 Giriş Bilgileri:');
    console.log('   Tesis Kodu:', tesisKodu);
    console.log('   Telefon:', telefon);
    console.log('   PIN:', pin);
    console.log('   Rol:', kullanici.rol);
    console.log('   Durum:', tesis.durum);
    console.log('   Paket:', tesis.paket);
    console.log('   Kota:', tesis.kota);

  } catch (error) {
    console.error('❌ Hata:', error);
    if (error.message) {
      console.error('Hata mesajı:', error.message);
    }
    throw error;
  }
}

// Script'i çalıştır
createAdminTesis()
  .then(() => {
    console.log('\n✅ Script başarıyla tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script hatası:', error);
    process.exit(1);
  });


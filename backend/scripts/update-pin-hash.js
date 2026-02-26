// PIN Hash Güncelleme Scripti (Supabase Client ile)
// Kullanım: SUPABASE_SERVICE_ROLE_KEY ile çalışır
// Bu script PIN'i hash'leyip veritabanında günceller

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL || 'https://iuxnpxszfvyrdifchwvr.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.error('❌ Hata: SUPABASE_SERVICE_ROLE_KEY bulunamadı!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updatePinHash() {
  try {
    const telefon = '5330483061';
    const pin = '611633';

    console.log('🔐 PIN hash\'leniyor...');
    const hashedPin = await bcrypt.hash(pin, 10);
    console.log('✅ PIN hash\'lendi');

    console.log('🔍 Kullanıcı aranıyor...');
    const { data: kullanici, error: findError } = await supabase
      .from('Kullanici')
      .select('*')
      .eq('telefon', telefon)
      .maybeSingle();

    if (findError) {
      console.error('Find error:', findError);
      throw findError;
    }

    if (!kullanici) {
      console.error('❌ Kullanıcı bulunamadı! Önce SQL script ile tesis ve kullanıcı oluşturun.');
      process.exit(1);
    }

    console.log('📝 PIN hash\'i güncelleniyor...');
    const { data: updatedKullanici, error: updateError } = await supabase
      .from('Kullanici')
      .update({
        pin: hashedPin
      })
      .eq('id', kullanici.id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    console.log('\n✅ PIN hash\'i güncellendi!');
    console.log('\n📋 Giriş Bilgileri:');
    console.log('   Tesis Kodu: 1');
    console.log('   Telefon:', telefon);
    console.log('   PIN:', pin);
    console.log('   Rol:', updatedKullanici.rol);

  } catch (error) {
    console.error('❌ Hata:', error);
    throw error;
  }
}

updatePinHash()
  .then(() => {
    console.log('\n✅ Script başarıyla tamamlandı!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script hatası:', error);
    process.exit(1);
  });


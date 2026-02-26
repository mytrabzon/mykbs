// Admin Hesap Kontrol Scripti
// Kullanım: node scripts/check-admin-account.js

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkAdminAccount() {
  try {
    console.log('=== ADMIN HESAP KONTROL ===\n');
    
    // Tesis kontrolü
    const tesis = await prisma.tesis.findUnique({
      where: { tesisKodu: '1' },
      include: {
        kullanicilar: true
      }
    });

    if (!tesis) {
      console.log('❌ Tesis bulunamadı (Tesis Kodu: 1)');
      console.log('\n💡 Çözüm: SQL script\'i çalıştırın:');
      console.log('   backend/scripts/create-all-tables-and-admin.sql');
      return;
    }

    console.log('✅ Tesis bulundu:');
    console.log(`   ID: ${tesis.id}`);
    console.log(`   Adı: ${tesis.tesisAdi}`);
    console.log(`   Durum: ${tesis.durum}`);
    console.log(`   Paket: ${tesis.paket}`);
    console.log(`   Kullanıcı Sayısı: ${tesis.kullanicilar.length}`);

    if (tesis.durum !== 'aktif') {
      console.log('\n⚠️  Tesis durumu aktif değil!');
      console.log('   Durum:', tesis.durum);
      console.log('\n💡 Çözüm: Tesis durumunu "aktif" yapın');
    }

    if (tesis.kullanicilar.length === 0) {
      console.log('\n❌ Tesis için kullanıcı bulunamadı!');
      console.log('\n💡 Çözüm: SQL script\'i çalıştırın:');
      console.log('   backend/scripts/create-all-tables-and-admin.sql');
      return;
    }

    console.log('\n📋 Kullanıcılar:');
    for (const kullanici of tesis.kullanicilar) {
      console.log(`\n   Kullanıcı ID: ${kullanici.id}`);
      console.log(`   Ad Soyad: ${kullanici.adSoyad}`);
      console.log(`   Telefon: ${kullanici.telefon}`);
      console.log(`   Rol: ${kullanici.rol}`);
      console.log(`   PIN var mı: ${kullanici.pin ? '✅ Evet' : '❌ Hayır'}`);
      
      if (kullanici.pin) {
        // PIN testi
        const testPin = '611633';
        const pinMatch = await bcrypt.compare(testPin, kullanici.pin);
        console.log(`   PIN testi (611633): ${pinMatch ? '✅ Eşleşiyor' : '❌ Eşleşmiyor'}`);
      }
    }

    // PIN testi
    console.log('\n🔐 PIN Testi:');
    const testPin = '611633';
    let foundMatch = false;
    
    for (const kullanici of tesis.kullanicilar) {
      if (kullanici.pin) {
        const pinMatch = await bcrypt.compare(testPin, kullanici.pin);
        if (pinMatch) {
          console.log(`✅ PIN eşleşti! Kullanıcı: ${kullanici.adSoyad}`);
          foundMatch = true;
          break;
        }
      }
    }

    if (!foundMatch) {
      console.log('❌ PIN eşleşmedi!');
      console.log('\n💡 Çözüm: PIN hash\'ini güncelleyin veya SQL script\'i çalıştırın');
    }

    console.log('\n✅ Kontrol tamamlandı!');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
    console.error('\n💡 Veritabanı bağlantısını kontrol edin:');
    console.error('   - DATABASE_URL environment variable');
    console.error('   - Supabase bağlantısı');
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminAccount();


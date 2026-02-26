// Admin Tesis Oluşturma Scripti (Supabase için)
// Kullanım: node scripts/create-admin-supabase.js
// Veya: SUPABASE_DB_URL="postgresql://..." node scripts/create-admin-supabase.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Supabase DATABASE_URL formatı:
// Direct connection: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
// Pooler connection: postgresql://postgres:[PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres
// Connection string'de ?pgbouncer=true parametresi eklenebilir
// Örnek: postgresql://postgres:password@db.iuxnpxszfvyrdifchwvr.supabase.co:5432/postgres?pgbouncer=true

// DATABASE_URL kontrolü
let databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!databaseUrl) {
  console.error('❌ Hata: DATABASE_URL veya SUPABASE_DB_URL bulunamadı!');
  console.error('💡 Supabase Database URL formatı:');
  console.error('   postgresql://postgres:[PASSWORD]@db.iuxnpxszfvyrdifchwvr.supabase.co:5432/postgres');
  console.error('💡 .env dosyasına ekleyin:');
  console.error('   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.iuxnpxszfvyrdifchwvr.supabase.co:5432/postgres"');
  process.exit(1);
}

// Prisma client'ı DATABASE_URL ile oluştur
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

async function createAdminTesis() {
  try {
    const tesisKodu = '1';
    const telefon = '5330483061';
    const pin = '611633';

    console.log('🔍 Mevcut tesis kontrol ediliyor...');
    
    // Tesis var mı kontrol et
    let tesis = await prisma.tesis.findUnique({
      where: { tesisKodu }
    });

    if (tesis) {
      console.log('⚠️  Tesis zaten mevcut, güncelleniyor...');
      
      // Tesis durumunu aktif yap
      tesis = await prisma.tesis.update({
        where: { id: tesis.id },
        data: {
          durum: 'aktif',
          paket: 'pro',
          kota: 10000
        }
      });
      
      console.log('✅ Tesis güncellendi:', tesis.tesisKodu);
    } else {
      console.log('📝 Yeni tesis oluşturuluyor...');
      
      // Yeni tesis oluştur
      tesis = await prisma.tesis.create({
        data: {
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
        }
      });
      
      console.log('✅ Tesis oluşturuldu:', tesis.tesisKodu);
    }

    // PIN hash'le
    const hashedPin = await bcrypt.hash(pin, 10);
    console.log('🔐 PIN hash\'lendi');

    // Kullanıcı var mı kontrol et
    let kullanici = await prisma.kullanici.findFirst({
      where: {
        tesisId: tesis.id,
        telefon
      }
    });

    if (kullanici) {
      console.log('⚠️  Kullanıcı zaten mevcut, admin yetkisi veriliyor...');
      
      // Kullanıcıyı admin (sahip) yap
      kullanici = await prisma.kullanici.update({
        where: { id: kullanici.id },
        data: {
          rol: 'sahip',
          pin: hashedPin,
          checkInYetki: true,
          odaDegistirmeYetki: true,
          bilgiDuzenlemeYetki: true
        }
      });
      
      console.log('✅ Kullanıcı admin yapıldı');
    } else {
      console.log('📝 Yeni admin kullanıcı oluşturuluyor...');
      
      // Yeni admin kullanıcı oluştur
      kullanici = await prisma.kullanici.create({
        data: {
          tesisId: tesis.id,
          adSoyad: 'Admin Kullanıcı',
          telefon,
          email: 'admin@mykbs.com',
          pin: hashedPin,
          rol: 'sahip', // Admin rolü
          checkInYetki: true,
          odaDegistirmeYetki: true,
          bilgiDuzenlemeYetki: true
        }
      });
      
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
    if (error.code === 'P1001') {
      console.error('💡 Veritabanı bağlantı hatası! DATABASE_URL\'i kontrol edin.');
    }
    throw error;
  } finally {
    await prisma.$disconnect();
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


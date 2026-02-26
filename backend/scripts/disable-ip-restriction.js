/**
 * IP Kısıtlamasını Devre Dışı Bırakma Scripti
 * 
 * Bu script tüm tesislerde IP kısıtlamasını kapatır
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function disableIpRestriction() {
  try {
    console.log('🔧 IP kısıtlaması devre dışı bırakılıyor...');
    
    // Tüm tesislerde IP kısıtlamasını kapat
    const result = await prisma.tesis.updateMany({
      where: {
        ipKisitAktif: true
      },
      data: {
        ipKisitAktif: false,
        ipAdresleri: '' // IP adreslerini de temizle
      }
    });

    console.log(`✅ ${result.count} tesis için IP kısıtlaması kapatıldı`);
    console.log('✅ IP kısıtlaması artık aktif değil');
    
    // Tüm tesisleri listele
    const tesisler = await prisma.tesis.findMany({
      select: {
        id: true,
        tesisAdi: true,
        tesisKodu: true,
        ipKisitAktif: true,
        ipAdresleri: true
      }
    });

    console.log('\n📋 Tesis IP Kısıtlama Durumu:');
    tesisler.forEach(tesis => {
      console.log(`  - ${tesis.tesisAdi} (${tesis.tesisKodu}): IP Kısıtı ${tesis.ipKisitAktif ? 'Aktif ❌' : 'Kapalı ✅'}`);
    });

  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Script'i çalıştır
disableIpRestriction();

